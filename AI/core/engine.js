// AI/core/engine.js — главный движок OzvyX
// Объединяет сессию, навыки, анализирует контекст и обрабатывает сообщения

import { Session } from './session.js';
import {
    GreetingSkill,
    GoodbyeSkill,
    CalculatorSkill,
    WeatherSkill,
    TranslateSkill,
    WebSearchSkill,
    CodeGenSkill,
    IdeaGenSkill,
    FileAnalysisSkill,
    SpellCheckSkill,
    KnowledgeBaseSkill,
    EmbeddingSearchSkill,
    ConversationSkill
} from './skills.js';
import { randomPick, extractWords } from './utils.js';
import { embeddingSearch } from '../embedding-search.js';

// ============================================================
// ДВИЖОК
// ============================================================
export class OzvyXEngine {
    constructor() {
        this.session = new Session();
        this.skills = [
            new GreetingSkill(),
            new GoodbyeSkill(),
            new CalculatorSkill(),
            new WeatherSkill(),
            new TranslateSkill(),
            new WebSearchSkill(),
            new CodeGenSkill(),
            new IdeaGenSkill(),
            new FileAnalysisSkill(),
            new SpellCheckSkill(),
            new KnowledgeBaseSkill(),
            new EmbeddingSearchSkill(), // поиск по смыслу
            new ConversationSkill()     // всегда последним
        ];
        this.intentKeywords = {
            greeting: ['привет', 'здравствуй', 'хай', 'салют', 'здорово', 'ку', 'hello', 'hi'],
            goodbye: ['пока', 'до свидания', 'до встречи', 'бывай', 'чао', 'bye', 'goodbye'],
            weather: ['погода', 'weather', 'температура', 'дождь', 'снег', 'ветер', 'прогноз', 'холодно', 'жарко'],
            translate: ['переведи', 'translate', 'перевод', 'как будет', 'how to say'],
            web_search: ['найди', 'поиск', 'search', 'загугли', 'google', 'информация о', 'кто такой', 'что такое'],
            code_generation: ['код', 'функция', 'скрипт', 'программа', 'program', 'function', 'напиши код', 'напиши функцию'],
            idea_generation: ['идея', 'придумай', 'предложи', 'brainstorm', 'suggest']
        };
        this.debug = false;
    }

    /**
     * Определяет намерение (intent) из сообщения
     */
    classifyIntent(message) {
        const lower = message.toLowerCase();
        for (const [intent, keywords] of Object.entries(this.intentKeywords)) {
            if (keywords.some(k => lower.includes(k))) return intent;
        }
        // Вопрос
        if (/\b(что|как|почему|зачем|кто|где|когда|сколько)\b/.test(lower)) {
            return 'question';
        }
        // Математика
        if (/[\d+\-*/%^()]/.test(message) && /[\d]/.test(message)) {
            return 'calculator';
        }
        return 'conversation';
    }

    /**
     * Анализирует контекст: тему, эмоцию, ключевые объекты
     */
    analyzeContext(message) {
        const lower = message.toLowerCase();
        let theme = 'general';
        if (/работа|офис|начальник|коллега|зарплата|увольн|проект|дедлайн/.test(lower)) theme = 'work';
        else if (/любов|отношен|девушк|парень|свидан|романтик|встреч|разрыв/.test(lower)) theme = 'relationships';
        else if (/друг|подруг|кореш|бро|приятел|компания/.test(lower)) theme = 'friendship';
        else if (/здоров|болезн|симптом|лечени|таблетк|врач|болит|голов|давлени/.test(lower)) theme = 'health';
        else if (/деньг|финанс|бюджет|зарплат|цен|дорог|копить|трат/.test(lower)) theme = 'money';
        else if (/техник|телефон|компьютер|ноутбук|гаджет|интернет|приложен|сайт/.test(lower)) theme = 'tech';
        else if (/смысл|жизн|смерт|время|быти|сознан|философ/.test(lower)) theme = 'philosophy';
        else if (/путешеств|тур|отпуск|билет|отель|город|страна/.test(lower)) theme = 'travel';
        else if (/еда|готовк|рецепт|блюд|вкусн|ужин|обед/.test(lower)) theme = 'food';

        let emotion = 'neutral';
        if (/плохо|грустно|печаль|устал|бесит|достало|хреново|жопа|депресс/.test(lower)) emotion = 'negative';
        else if (/хорошо|рад|отлично|классно|круто|супер|кайф|зашибись/.test(lower)) emotion = 'positive';
        else if (/страшно|боюсь|тревога|паника|волнуюсь|беспокоюсь/.test(lower)) emotion = 'anxious';
        else if (/злой|гнев|бешеный|ярость|ненавижу|бесит/.test(lower)) emotion = 'angry';

        return {
            theme,
            emotion,
            objects: extractWords(message)
        };
    }

    /**
     * Инициализация поиска по эмбеддингам
     */
    async initEmbeddingSearch(knowledge) {
        if (!knowledge) {
            knowledge = window.EXTRA_KNOWLEDGE || {};
        }
        if (Object.keys(knowledge).length === 0) {
            console.warn('База знаний пуста, эмбеддинги не инициализированы.');
            return;
        }
        await embeddingSearch.init(knowledge);
        console.log('✅ Эмбеддинги загружены и готовы.');
    }

    /**
     * Основная функция обработки сообщения
     */
    async process(message, files = []) {
        const session = this.session;
        const startTime = Date.now();

        // Добавляем сообщение пользователя в историю
        session.addMessage('user', message, files);

        // Определяем намерение и контекст
        const intent = this.classifyIntent(message);
        session.lastIntent = intent;
        const context = this.analyzeContext(message);
        session.currentTopic = context.theme;

        if (this.debug) {
            console.log(`[OzvyX] Intent: ${intent}, Theme: ${context.theme}, Emotion: ${context.emotion}`);
        }

        // Проходим по всем навыкам в порядке регистрации
        let result = null;
        for (const skill of this.skills) {
            if (await skill.canHandle(intent, message, context, files)) {
                try {
                    const r = await skill.execute(message, context, files);
                    if (r !== null && r !== undefined) {
                        result = r;
                        break;
                    }
                } catch (err) {
                    console.warn(`[OzvyX] Ошибка в навыке ${skill.name}:`, err);
                }
            }
        }

        // Если ни один навык не дал ответа — fallback
        if (result === null || result === undefined) {
            const fallbacks = [
                "Не совсем понял. Можешь переформулировать?",
                "Извини, я не совсем понял. Уточни, пожалуйста.",
                "Давай попробуем ещё раз. Что ты имеешь в виду?",
                "Не уловил суть. Расскажи по-другому."
            ];
            result = randomPick(fallbacks);
        }

        // Постобработка: персонализация по эмоции
        if (context.emotion === 'negative' || context.emotion === 'anxious') {
            result = randomPick(["Понимаю, ", "Сочувствую. "]) + result;
        } else if (context.emotion === 'positive') {
            result = randomPick(["Отлично! ", "Класс! "]) + result;
        }

        // Добавляем вопрос для коротких ответов
        if (result.length < 80 && !result.endsWith('?') && !result.endsWith('.')) {
            const tails = [
                " Что ещё?",
                " Хочешь что-то уточнить?",
                " Рассказывай дальше.",
                " Что думаешь по этому поводу?"
            ];
            result += randomPick(tails);
        }

        // Сохраняем ответ в историю
        session.addMessage('assistant', result);

        if (this.debug) {
            console.log(`[OzvyX] Ответ за ${Date.now() - startTime} мс`);
        }

        return result;
    }

    /**
     * Сброс сессии
     */
    reset() {
        this.session.reset();
        return "✅ Сессия сброшена. Начинаем заново.";
    }

    /**
     * Получение текущей сессии (для внешнего доступа)
     */
    getSession() {
        return this.session;
    }

    /**
     * Включение/выключение режима отладки
     */
    setDebug(enable) {
        this.debug = !!enable;
    }
}

// ============================================================
// ЭКСПОРТ ПО УМОЛЧАНИЮ
// ============================================================
export default OzvyXEngine;
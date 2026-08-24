// AI/core/skills.js — все навыки OzvyX

import {
    normalize,
    extractWords,
    randomPick,
    safeCalc,
    getSynonyms,
    levenshteinDistance,
    extractKeywords,
    summarize
} from './utils.js';

// Импортируем поиск по эмбеддингам
import { embeddingSearch } from '../embedding-search.js';

// ============================================================
// БАЗОВЫЙ КЛАСС НАВЫКА
// ============================================================
export class Skill {
    constructor(name) {
        this.name = name;
    }
    canHandle(intent, message, context, files) {
        return false;
    }
    async execute(message, context, files) {
        return null;
    }
}

// ============================================================
// 1. ПРИВЕТСТВИЕ
// ============================================================
export class GreetingSkill extends Skill {
    constructor() {
        super('greeting');
    }
    canHandle(intent) {
        return intent === 'greeting';
    }
    async execute(message, context) {
        const greetings = [
            "Привет! Я OzvyX — твой умный помощник.",
            "Здравствуй! Рад тебя видеть.",
            "Хай! Как дела?",
            "Приветствую! Чем могу помочь?",
            "Добрый день! OzvyX на связи.",
            "О, привет! Давно не виделись.",
            "Здарова! Я OzvyX, к твоим услугам."
        ];
        return context.getGreeting() + randomPick(greetings);
    }
}

// ============================================================
// 2. ПРОЩАНИЕ
// ============================================================
export class GoodbyeSkill extends Skill {
    constructor() {
        super('goodbye');
    }
    canHandle(intent) {
        return intent === 'goodbye';
    }
    async execute() {
        return randomPick([
            "Пока! Буду ждать твоего возвращения.",
            "До встречи! Всего хорошего.",
            "Счастливо! Обращайся ещё.",
            "Чао! Не скучай.",
            "Бывай, братан! Удачи.",
            "Пока-пока! Я всегда на связи."
        ]);
    }
}

// ============================================================
// 3. КАЛЬКУЛЯТОР
// ============================================================
export class CalculatorSkill extends Skill {
    constructor() {
        super('calculator');
    }
    canHandle(intent, message) {
        const expr = message.replace(/,/g, '.');
        const m = expr.match(/[\d.+\-*/%()^]+/);
        if (!m) return false;
        return /[+\-*/%^()]/.test(m[0]);
    }
    async execute(message) {
        const expr = message.replace(/,/g, '.').match(/[\d.+\-*/%()^]+/);
        if (!expr) return "❌ Не нашёл математического выражения.";
        const result = safeCalc(expr[0].replace(/\^/g, '**'));
        if (result === null) return "❌ Не удалось вычислить. Проверь синтаксис.";
        return `✅ ${expr[0]} = ${result}`;
    }
}

// ============================================================
// 4. ПОГОДА
// ============================================================
export class WeatherSkill extends Skill {
    constructor() {
        super('weather');
        this.cache = {};
    }
    canHandle(intent, message) {
        const kw = ['погода', 'weather', 'температура', 'дождь', 'снег', 'ветер', 'прогноз', 'холодно', 'жарко'];
        return intent === 'weather' || kw.some(w => message.toLowerCase().includes(w));
    }
    async execute(message) {
        const cityMatch = message.match(/(?:в\s+|for\s+|город\s+)([а-яa-z\s]+)/i);
        const city = cityMatch ? cityMatch[1].trim() : 'Москва';
        try {
            const geoResp = await fetch(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(city)}&count=1&language=ru&format=json`);
            if (geoResp.ok) {
                const geo = await geoResp.json();
                if (geo.results && geo.results.length) {
                    const { latitude, longitude, name } = geo.results[0];
                    const wResp = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current_weather=true&timezone=auto&forecast_days=1`);
                    if (wResp.ok) {
                        const w = await wResp.json();
                        if (w.current_weather) {
                            const c = w.current_weather;
                            const codes = {
                                0:'☀️ Ясно',1:'⛅ Переменная облачность',2:'🌥️ Облачно с прояснениями',
                                3:'☁️ Пасмурно',45:'🌫️ Туман',48:'🌫️ Иней',
                                51:'🌦️ Морось',53:'🌦️ Морось',55:'🌦️ Морось',
                                61:'🌧️ Дождь',63:'🌧️ Дождь',65:'🌧️ Дождь',
                                80:'🌧️ Ливень',81:'🌧️ Ливень',82:'🌧️ Ливень',
                                95:'⛈️ Гроза',96:'⛈️ Гроза с градом',99:'⛈️ Гроза с градом'
                            };
                            return `🌤 Погода в ${name}: ${c.temperature}°C, ветер ${c.windspeed} м/с, ${codes[c.weathercode] || 'код '+c.weathercode}`;
                        }
                    }
                }
            }
        } catch {}
        const temps = [12,18,22,15,25,20,10,28];
        const conds = ['ясно','облачно','дождь','солнечно','ветрено','пасмурно'];
        return `🌤 Погода в ${city} (демо): ${randomPick(temps)}°C, ${randomPick(conds)}`;
    }
}

// ============================================================
// 5. ПЕРЕВОД
// ============================================================
export class TranslateSkill extends Skill {
    constructor() {
        super('translate');
    }
    canHandle(intent, message) {
        const kw = ['переведи', 'translate', 'перевод', 'как будет', 'how to say'];
        return intent === 'translate' || kw.some(w => message.toLowerCase().includes(w));
    }
    async execute(message) {
        const target = message.toLowerCase().includes('на русский') ? 'ru' : 'en';
        let text = message;
        for (const kw of ['переведи', 'translate', 'перевод', 'как будет', 'how to say', 'на русский', 'на английский', 'to russian', 'to english']) {
            text = text.replace(new RegExp(kw, 'gi'), '');
        }
        text = text.trim().replace(/^["']|["']$/g, '');
        if (!text) return "🌐 Напиши текст для перевода.";
        const source = /[а-яё]/i.test(text) ? 'ru' : 'en';
        if (source === target) return `🌐 Текст уже на ${target} языке.`;
        try {
            const resp = await fetch('https://libretranslate.com/translate', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ q: text, source, target, format: 'text' })
            });
            if (resp.ok) {
                const data = await resp.json();
                if (data.translatedText) return `🌐 Перевод:\n"${text}" → "${data.translatedText}"`;
            }
        } catch {}
        const dict = {
            'привет': 'hello', 'мир': 'world', 'спасибо': 'thank you',
            'как дела': 'how are you', 'пока': 'bye', 'доброе утро': 'good morning'
        };
        if (source === 'ru' && target === 'en' && dict[text.toLowerCase()]) {
            return `🌐 (база) "${text}" → "${dict[text.toLowerCase()]}"`;
        }
        return `🌐 Не удалось перевести "${text}".`;
    }
}

// ============================================================
// 6. ПОИСК В WIKIPEDIA
// ============================================================
export class WebSearchSkill extends Skill {
    constructor() {
        super('web_search');
    }
    canHandle(intent, message) {
        const kw = ['найди', 'поиск', 'search', 'загугли', 'google', 'информация о', 'кто такой', 'что такое'];
        return intent === 'web_search' || kw.some(w => message.toLowerCase().includes(w));
    }
    async execute(message) {
        const m = message.match(/(?:найди|поиск|search|загугли|google|информация о|кто такой|что такое)\s+(.+)/i);
        const query = m ? m[1].trim() : message;
        try {
            const resp = await fetch(`https://ru.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(query)}`);
            if (resp.ok) {
                const data = await resp.json();
                if (data.extract) {
                    const title = data.title || query;
                    return `📖 **${title}** (Wikipedia):\n${data.extract.substring(0, 500)}`;
                }
            }
        } catch {}
        return `🔍 По запросу "${query}" ничего не найдено в Wikipedia.`;
    }
}

// ============================================================
// 7. ГЕНЕРАЦИЯ КОДА
// ============================================================
export class CodeGenSkill extends Skill {
    constructor() {
        super('code_gen');
    }
    canHandle(intent, message) {
        const kw = ['код', 'функция', 'скрипт', 'программа', 'program', 'function', 'напиши код', 'напиши функцию'];
        return intent === 'code_generation' || kw.some(w => message.toLowerCase().includes(w));
    }
    async execute(message) {
        const isPy = /python|питон|py\b/.test(message);
        const isJS = /javascript|js\b|java script/.test(message);
        const lang = isPy ? 'python' : (isJS ? 'javascript' : 'python');
        const m = message.match(/(?:напиши|создай|code|напиши код|напиши функцию)\s*(?:на\s*(?:python|js|javascript))?\s*(?:для|который|которая|чтобы)?\s*(.+)/i);
        const task = m ? m[1].trim() : 'простую функцию';
        let code = '';
        if (lang === 'python') {
            code = `def solution():\n    """${task}"""\n    # TODO: реализовать логику\n    pass\n\nif __name__ == "__main__":\n    print(solution())`;
        } else {
            code = `/** ${task} */\nfunction solution() {\n  // TODO: implement logic\n  return null;\n}\nconsole.log(solution());`;
        }
        return `💻 Код на ${lang}:\n\`\`\`${lang}\n${code}\n\`\`\``;
    }
}

// ============================================================
// 8. ГЕНЕРАЦИЯ ИДЕЙ
// ============================================================
export class IdeaGenSkill extends Skill {
    constructor() {
        super('idea_gen');
    }
    canHandle(intent, message) {
        const kw = ['идея', 'придумай', 'предложи', 'brainstorm', 'suggest'];
        return intent === 'idea_generation' || kw.some(w => message.toLowerCase().includes(w));
    }
    async execute(message) {
        const m = message.match(/(?:идеи|придумай|предложи|о|про|на тему|for|about)\s+(.+)/i);
        const topic = m ? m[1].trim() : 'этой теме';
        const ideas = [
            `💡 Создай mind-map вокруг «${topic}».`,
            `💡 Разбей «${topic}» на 3 подзадачи.`,
            `💡 Посмотри на «${topic}» с противоположной стороны.`,
            `💡 Найди аналогию в другой области.`,
            `💡 Опиши «${topic}» для 5-летнего ребёнка.`,
            `💡 Примени метод SCAMPER к «${topic}».`,
            `💡 Представь «${topic}» через 10 лет.`
        ];
        const shuffled = [...ideas].sort(() => Math.random() - 0.5).slice(0, 3);
        return `💡 Идеи по «${topic}»:\n${shuffled.join('\n')}`;
    }
}

// ============================================================
// 9. АНАЛИЗ ФАЙЛОВ
// ============================================================
export class FileAnalysisSkill extends Skill {
    constructor() {
        super('file_analysis');
    }
    canHandle(intent, message, context, files) {
        return files && files.length > 0;
    }
    async execute(message, context, files) {
        if (!files || !files.length) return "📁 Нет файлов для анализа.";
        const results = [];
        for (const f of files.slice(0, 5)) {
            const name = f.name || 'неизвестный';
            const size = f.size || 0;
            const content = f.text || f.content || '';
            if (content) {
                const lines = (content.match(/\n/g) || []).length + 1;
                const words = content.split(/\s+/).length;
                const keywords = extractKeywords(content, 5);
                const summary = summarize(content, 2);
                results.push(`📄 ${name} (${size} байт)\n├─ Строк: ${lines}, слов: ${words}\n├─ Ключевые: ${keywords.length ? keywords.join(', ') : 'нет'}\n└─ Содержание: ${summary.substring(0, 200)}`);
            } else {
                results.push(`📎 ${name} (${size} байт) — не удалось извлечь текст.`);
            }
        }
        return `📁 Анализ файлов:\n\n${results.join('\n\n')}`;
    }
}

// ============================================================
// 10. ПРОВЕРКА ОРФОГРАФИИ (с использованием словаря)
// ============================================================
export class SpellCheckSkill extends Skill {
    constructor() {
        super('spell_check');
    }
    canHandle(intent, message) {
        const words = message.match(/[а-яё]+/gi) || [];
        if (!words.length) return false;
        if (window.RUSSIAN_WORDS) {
            const misspelled = words.filter(w => !window.RUSSIAN_WORDS.has(w.toLowerCase()));
            return misspelled.length > 0;
        }
        const dict = new Set(['привет','здравствуй','помощь','спасибо','пока','работа','начальник','любовь','друг']);
        const misspelled = words.filter(w => !dict.has(w.toLowerCase()));
        return misspelled.length > 0;
    }
    async execute(message) {
        const words = message.match(/[а-яё]+/gi) || [];
        const corrections = {};

        for (const w of words) {
            if (w in corrections) continue;
            const lower = w.toLowerCase();
            if (window.RUSSIAN_WORDS) {
                if (window.RUSSIAN_WORDS.has(lower)) continue;
                const close = findClosestWord(lower);
                if (close && close !== lower) {
                    corrections[w] = close;
                }
                continue;
            }
            // Встроенная проверка (для демо)
            if (w.endsWith('ть') && ['чита', 'писа', 'говори'].includes(w.slice(0, -2))) {
                corrections[w] = w.slice(0, -2) + 'ть';
            } else if (w.endsWith('тся') && ['чита', 'писа'].includes(w.slice(0, -3))) {
                corrections[w] = w.slice(0, -3) + 'ться';
            }
        }

        if (!Object.keys(corrections).length) return null;
        const suggestions = Object.entries(corrections)
            .slice(0, 3)
            .map(([orig, corr]) => `«${orig}» → «${corr}»`);
        return `🔍 Возможные опечатки:\n${suggestions.join('\n')}`;
    }
}

// Вспомогательная функция для поиска ближайшего слова (используется в SpellCheckSkill)
function findClosestWord(word, maxDist = 2) {
    if (!window.RUSSIAN_WORDS) return null;
    const target = word.toLowerCase();
    const candidates = Array.from(window.RUSSIAN_WORDS)
        .filter(w => Math.abs(w.length - target.length) <= 2);
    let best = null, bestDist = maxDist + 1;
    for (const candidate of candidates) {
        const dist = levenshteinDistance(target, candidate);
        if (dist < bestDist) {
            bestDist = dist;
            best = candidate;
        }
    }
    return bestDist <= maxDist ? best : null;
}

// ============================================================
// 11. ПОИСК В БАЗЕ ЗНАНИЙ (knowledge.js)
// ============================================================
export class KnowledgeBaseSkill extends Skill {
    constructor() {
        super('knowledge_base');
    }
    canHandle(intent, message) {
        return this.findMatch(message) !== null;
    }
    findMatch(message) {
        const kb = window.EXTRA_KNOWLEDGE || {};
        if (!kb) return null;
        const msgNorm = normalize(message);
        const msgWords = extractWords(message);
        let bestKey = null, bestScore = 0;

        for (const key of Object.keys(kb)) {
            const keyNorm = normalize(key);
            const keyWords = extractWords(key);
            if (msgNorm === keyNorm) return key;
            const common = msgWords.filter(w => keyWords.includes(w));
            if (common.length) {
                const score = common.length / Math.max(msgWords.length, 1);
                if (score > bestScore) {
                    bestScore = score;
                    bestKey = key;
                }
            }
        }
        const threshold = 0.25;
        if (bestScore >= threshold) return bestKey;

        // Поиск по синонимам
        for (const key of Object.keys(kb)) {
            const keyWords = extractWords(key);
            for (const w of msgWords) {
                const syns = getSynonyms(w);
                if (syns.some(s => keyWords.includes(s))) return key;
            }
        }
        return null;
    }
    async execute(message) {
        const kb = window.EXTRA_KNOWLEDGE || {};
        const key = this.findMatch(message);
        return key ? kb[key] : null;
    }
}

// ============================================================
// 12. ПОИСК ПО СМЫСЛУ (ЭМБЕДДИНГИ) — НОВЫЙ НАВЫК
// ============================================================
export class EmbeddingSearchSkill extends Skill {
    constructor() {
        super('embedding_search');
        this.threshold = 0.3;
    }

    canHandle(intent, message, context, files) {
        // Проверяем, что эмбеддинги инициализированы и есть база знаний
        return embeddingSearch.ready && window.EXTRA_KNOWLEDGE;
    }

    async execute(message, context, files) {
        const result = await embeddingSearch.search(message, 1);
        if (result.confidence >= this.threshold) {
            return result.answer;
        }
        return null; // низкая уверенность — пропускаем
    }
}

// ============================================================
// 13. ОБЩИЙ РАЗГОВОР (FALLBACK)
// ============================================================
export class ConversationSkill extends Skill {
    constructor() {
        super('conversation');
    }
    canHandle() {
        return true; // Всегда последний в цепочке
    }
    async execute(message, context) {
        const lower = message.toLowerCase();

        if (['да', 'нет', 'ок', 'окей', 'хорошо', 'ладно'].includes(lower)) {
            if (['да', 'ок', 'окей', 'хорошо', 'ладно'].includes(lower)) {
                return randomPick([
                    "Отлично! Продолжаем.",
                    "Договорились.",
                    "Так и сделаем.",
                    "Круто! Тогда давай дальше."
                ]);
            } else {
                return randomPick([
                    "Понял.",
                    "Хорошо, тогда по-другому.",
                    "Как скажешь.",
                    "Ясно, учтём."
                ]);
            }
        }

        if (/^(что|как|почему|зачем|кто|где|когда|откуда)\s*$/.test(lower)) {
            return "Уточни, пожалуйста, что именно интересует.";
        }

        if (/грустн|печаль|устал|плох|хренов|депресс|тоск|обид/.test(lower)) {
            return randomPick([
                "Держись, братан! Всё будет хорошо.",
                "Понимаю, бывает. Я рядом.",
                "Расскажи, что случилось, я слушаю.",
                "Не грусти, это временно.",
                "Хочешь поговорить об этом? Я помогу."
            ]);
        }
        if (/рад|отличн|хорош|крут|супер|классн|кайф|зашибись/.test(lower)) {
            return randomPick([
                "Отлично! Я рад за тебя.",
                "Супер! Продолжай в том же духе.",
                "Класс! Чем могу ещё помочь?",
                "Здорово! Так держать!"
            ]);
        }

        if (context.history.length > 1) {
            const last = context.history[context.history.length - 2]?.content || '';
            if (last && last.length > 10) {
                return `Помню, ты говорил: «${last.substring(0, 50)}...» Продолжим?`;
            }
        }

        const responses = [
            "Интересно. Расскажи подробнее.",
            "Понял. Что ты думаешь по этому поводу?",
            "Хороший вопрос. Давай разберёмся вместе.",
            "Слушаю внимательно. Продолжай.",
            "Я с тобой. Что ещё хочешь обсудить?",
            "Давай разложим по полочкам.",
            "Хорошая тема! Чего ты хочешь добиться?",
            "Непростой вопрос. Давай подумаем вместе."
        ];
        return randomPick(responses);
    }
}
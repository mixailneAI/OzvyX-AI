// AI/models/mistral.js — клиент для Mistral API
// Опциональный модуль. Используется только если выбрана модель через Mistral.

import { Mistral } from '@mistralai/mistralai';

// ============================================================
// 1. КОНФИГУРАЦИЯ (ключ можно передавать извне)
// ============================================================
const MISTRAL_API_KEY = 'Ваш_Ключ'; // можно заменить на свой

// ============================================================
// 2. КЛИЕНТ
// ============================================================
let mistralClient = null;

/**
 * Возвращает экземпляр клиента Mistral
 */
export function getMistralClient(apiKey = MISTRAL_API_KEY) {
    if (!apiKey || apiKey.trim() === '') {
        throw new Error('❌ Mistral API ключ не задан.');
    }
    if (!mistralClient) {
        mistralClient = new Mistral({ apiKey: apiKey.trim() });
    }
    return mistralClient;
}

// ============================================================
// 3. БАЗОВЫЙ ВЫЗОВ ЧАТА (для всех моделей, кроме experimental)
// ============================================================

/**
 * Подготавливает сообщения для Mistral с учётом системного промпта, истории и вложений
 */
export function prepareMistralMessages(attachments = [], userText = '', systemPrompt = '', history = []) {
    const sys = { role: 'system', content: systemPrompt || 'Ты — OzvyX, умный помощник.' };
    const curr = [];

    if (userText) curr.push({ type: 'text', text: userText });

    // Добавляем вложения (изображения для Vision, текст для других)
    for (const item of attachments) {
        if (item.type && item.type.startsWith('image/') && item.previewUrl) {
            curr.push({ type: 'image_url', imageUrl: item.dataUrl || item.previewUrl });
        }
        if (item.text) {
            curr.push({ type: 'text', text: `\n\n[Файл ${item.name}]\n${item.text}` });
        }
    }

    // История (предыдущие сообщения)
    const historyMessages = history.map(m => ({
        role: m.role === 'user' ? 'user' : 'assistant',
        content: m.content || ''
    }));

    // Если в текущем сообщении есть и текст, и вложения — передаём как массив
    const userContent = curr.length === 1 && curr[0].type === 'text'
        ? curr[0].text
        : curr;

    return [
        sys,
        ...historyMessages,
        { role: 'user', content: userContent }
    ];
}

/**
 * Вызов Mistral Chat Completion (для всех моделей, кроме experimental)
 */
export async function callMistral({
    message,
    attachments = [],
    systemPrompt = '',
    history = [],
    model = 'mistral-small-latest',
    temperature = 0.7,
    maxTokens = 1200
}) {
    const client = getMistralClient();
    const messages = prepareMistralMessages(attachments, message, systemPrompt, history);

    try {
        const response = await client.chat.complete({
            model: model,
            messages: messages,
            temperature: temperature,
            maxTokens: maxTokens
        });

        // Нормализуем ответ
        return normalizeMistralResponse(response);
    } catch (err) {
        const txt = String(err?.message || err);
        if (/browser|cors|origin/i.test(txt)) {
            throw new Error('❌ Mistral API отклонил браузерный запрос. Для продакшена нужен серверный прокси.');
        }
        throw err;
    }
}

/**
 * Нормализация ответа от Mistral (извлекает текст)
 */
function normalizeMistralResponse(r) {
    if (r == null) return '';
    if (typeof r === 'string') return r;
    if (r.content && typeof r.content === 'string') return r.content;
    if (Array.isArray(r.content)) {
        return r.content.map(x => typeof x === 'string' ? x : (x?.text || '')).join('');
    }
    if (r.output_text) return String(r.output_text);
    if (r.answer) return typeof r.answer === 'string' ? r.answer : JSON.stringify(r.answer);
    if (r.choices?.[0]?.message?.content) {
        const c = r.choices[0].message.content;
        return Array.isArray(c) ? c.map(x => x?.text || '').join('') : String(c);
    }
    if (r.choices?.[0]?.text) return String(r.choices[0].text);
    if (r.message?.content) return String(r.message.content);
    return JSON.stringify(r, null, 2);
}

// ============================================================
// 4. ГЕНЕРАЦИЯ ИЗОБРАЖЕНИЙ (через агента Mistral)
// ============================================================

/**
 * Генерирует изображение через Mistral (требуется агент с инструментом image_generation)
 */
export async function generateImageWithMistral(prompt, temperature = 0.7) {
    const client = getMistralClient();

    // Проверяем наличие beta-методов (только в некоторых SDK)
    if (!client.beta?.agents?.create || !client.beta?.conversations?.start || !client.files?.download) {
        throw new Error('❌ SDK не поддерживает beta.agents / beta.conversations / files.download.');
    }

    // Создаём агента для генерации (или берём из сессии)
    let agentId = sessionStorage.getItem('ozvyx_image_agent_id');
    if (!agentId) {
        const agent = await client.beta.agents.create({
            model: 'mistral-medium-latest',
            name: 'OzvyX Image Generator',
            description: 'Агент OzvyX для генерации изображений по запросу пользователя.',
            instructions: 'Используй инструмент image_generation, когда пользователь просит создать изображение. Не добавляй лишних пояснений.',
            tools: [{ type: 'image_generation' }],
            completionArgs: { temperature: Math.min(temperature, 1.0) }
        });
        agentId = agent.id || agent.agentId;
        if (!agentId) throw new Error('❌ Mistral не вернул ID агента генерации.');
        sessionStorage.setItem('ozvyx_image_agent_id', agentId);
    }

    // Запускаем диалог с агентом
    const response = await client.beta.conversations.start({
        agentId: agentId,
        inputs: prompt
    });

    // Ищем file_id с изображением
    const chunks = [];
    const outputs = Array.isArray(response?.outputs) ? response.outputs : [];
    for (const output of outputs) {
        const content = Array.isArray(output?.content) ? output.content : [];
        for (const part of content) {
            const fileId = part?.fileId || part?.file_id;
            if (fileId) chunks.push(fileId);
        }
    }

    if (!chunks.length && response?.outputs) {
        const encoded = JSON.stringify(response);
        const match = encoded.match(/\"file[_ ]?id\":\"([^\"]+)\"/i);
        if (match) chunks.push(match[1]);
    }

    if (!chunks.length) {
        throw new Error('❌ В ответе Mistral не найден file_id с изображением.');
    }

    // Скачиваем файл
    const raw = await client.files.download({ fileId: chunks[0] });
    const blob = raw instanceof Blob ? raw : new Blob([raw], { type: 'image/png' });
    const url = URL.createObjectURL(blob);

    return {
        url: url,
        caption: 'Изображение сгенерировано через Mistral image_generation.'
    };
}

// ============================================================
// 5. ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ
// ============================================================

/**
 * Проверяет, доступна ли генерация изображений (бросит ошибку, если нет)
 */
export async function checkImageGenerationAvailable() {
    const client = getMistralClient();
    if (!client.beta?.agents?.create) {
        throw new Error('❌ Ваша версия Mistral SDK не поддерживает генерацию изображений.');
    }
    return true;
}

// ============================================================
// 6. ЭКСПОРТ ПО УМОЛЧАНИЮ
// ============================================================
export default {
    getMistralClient,
    callMistral,
    generateImageWithMistral,
    prepareMistralMessages,
    normalizeMistralResponse,
    checkImageGenerationAvailable
};
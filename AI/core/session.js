// AI/core/session.js — класс Session для хранения контекста диалога

import { normalize } from './utils.js';

// ============================================================
// КОНСТАНТЫ
// ============================================================
const MAX_HISTORY = 20; // максимальное количество сообщений в памяти

// ============================================================
// КЛАСС SESSION
// ============================================================
export class Session {
    constructor() {
        // История сообщений { role, content, files, timestamp }
        this.history = [];
        // Извлечённые факты о пользователе { name, city, age, ... }
        this.facts = {};
        // Предпочтения пользователя (для персонализации)
        this.preferences = {};
        // Счётчик сообщений
        this.messageCount = 0;
        // Текущая тема (последняя определённая)
        this.currentTopic = null;
        // Последний интент (greeting, goodbye, weather, ...)
        this.lastIntent = null;
    }

    /**
     * Добавляет сообщение в историю
     */
    addMessage(role, content, files = null) {
        this.history.push({
            role: role,
            content: content || '',
            files: files ? [...files] : null,
            timestamp: new Date().toISOString()
        });
        if (this.history.length > MAX_HISTORY) {
            this.history.shift();
        }
        this.messageCount++;
        if (role === 'user') {
            this.extractFacts(content);
        }
    }

    /**
     * Извлекает факты из сообщения пользователя (имя, город, возраст)
     */
    extractFacts(message) {
        const patterns = {
            name: [
                /меня зовут\s+([а-яa-z\s]+)/i,
                /моё имя\s+([а-яa-z\s]+)/i,
                /я\s+([а-яa-z\s]+),\s*(?:меня зовут|а зовут)/i,
                /называйте меня\s+([а-яa-z\s]+)/i
            ],
            city: [
                /я (?:из|живу в|проживаю в)\s+([а-яa-z\s]+)/i,
                /мой город\s+([а-яa-z\s]+)/i,
                /я в\s+([а-яa-z\s]+)/i
            ],
            age: [
                /мне\s+(\d+)\s+лет/i,
                /возраст\s+(\d+)/i
            ]
        };
        for (const [type, regexes] of Object.entries(patterns)) {
            for (const regex of regexes) {
                const m = message.match(regex);
                if (m) {
                    this.facts[type] = m[1].trim();
                    break;
                }
            }
        }
    }

    /**
     * Возвращает персонализированное приветствие на основе фактов
     */
    getGreeting() {
        const parts = [];
        if (this.facts.name) parts.push(this.facts.name);
        if (this.facts.city) parts.push(`из ${this.facts.city}`);
        return parts.length ? `Рад видеть, ${parts.join(', ')}! ` : '';
    }

    /**
     * Получить последние N сообщений из истории
     */
    getRecent(n = 5) {
        return this.history.slice(-n);
    }

    /**
     * Получить только сообщения пользователя (для анализа)
     */
    getUserMessages() {
        return this.history.filter(m => m.role === 'user').map(m => m.content);
    }

    /**
     * Сбросить сессию (очистить историю и факты)
     */
    reset() {
        this.history = [];
        this.facts = {};
        this.preferences = {};
        this.messageCount = 0;
        this.currentTopic = null;
        this.lastIntent = null;
    }

    /**
     * Сериализация для сохранения
     */
    toJSON() {
        return {
            history: this.history,
            facts: this.facts,
            preferences: this.preferences,
            messageCount: this.messageCount,
            currentTopic: this.currentTopic,
            lastIntent: this.lastIntent
        };
    }

    /**
     * Десериализация из сохранённого объекта
     */
    fromJSON(data) {
        this.history = data.history || [];
        this.facts = data.facts || {};
        this.preferences = data.preferences || {};
        this.messageCount = data.messageCount || 0;
        this.currentTopic = data.currentTopic || null;
        this.lastIntent = data.lastIntent || null;
    }
}

// ============================================================
// ЭКСПОРТ ПО УМОЛЧАНИЮ
// ============================================================
export default Session;
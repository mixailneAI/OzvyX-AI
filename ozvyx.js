// AI/ozvyx.js — скрепляющий файл (точка входа для всего приложения)

// ============================================================
// 1. ИМПОРТЫ ИЗ CORE
// ============================================================
import { OzvyXEngine } from './core/engine.js';
import { Session } from './core/session.js';
import * as Skills from './core/skills.js';
import * as Utils from './core/utils.js';

// ============================================================
// 2. ИМПОРТЫ ИЗ UI
// ============================================================
import { OzvyXApp } from './ui/app.js';
import * as Render from './ui/render.js';
import * as Storage from './ui/storage.js';
import * as Theme from './ui/theme.js';

// ============================================================
// 3. ИМПОРТ ИЗ MODELS (если есть)
// ============================================================
// import * as Mistral from './models/mistral.js';
// Пока оставим заглушку, если файла нет
const Mistral = {};

// ============================================================
// 4. ИМПОРТ ИЗ DATA (эмбеддинги)
// ============================================================
import { embeddingSearch } from './embedding-search.js';

// ============================================================
// 5. ЭКСПОРТЫ
// ============================================================

// Core
export { OzvyXEngine, Session, Skills, Utils };

// UI
export { OzvyXApp, Render, Storage, Theme };

// Models
export { Mistral };

// Embedding
export { embeddingSearch };

// ============================================================
// 6. УДОБНЫЕ ФУНКЦИИ ДЛЯ БЫСТРОГО СТАРТА
// ============================================================

/**
 * Быстрая обработка сообщения (без UI)
 * Для использования в консоли или тестирования
 */
export async function processExperimentalRequest(message, files = []) {
    const engine = new OzvyXEngine();
    return await engine.process(message, files);
}

/**
 * Инициализация полноценного приложения с UI
 * @param {Object} elements — DOM-элементы для рендеринга
 * @returns {OzvyXApp} — экземпляр приложения
 */
export async function initApp(elements) {
    const app = new OzvyXApp();
    await app.init(elements);
    return app;
}

/**
 * Быстрый сброс сессии (без UI)
 */
export function resetSession() {
    const engine = new OzvyXEngine();
    return engine.reset();
}

/**
 * Инициализация поиска по эмбеддингам (для внешнего использования)
 */
export async function initEmbeddingSearch(knowledge) {
    const engine = new OzvyXEngine();
    await engine.initEmbeddingSearch(knowledge);
}

// ============================================================
// 7. ЗАГРУЗКА СЛОВАРЕЙ (если нужно вручную)
// ============================================================

/**
 * Загружает словари (если они ещё не загружены)
 */
export async function loadDictionaries() {
    try {
        const dict = await import('./data/dictionary.js');
        if (dict.loadAllDictionaries) {
            await dict.loadAllDictionaries();
            console.log('✅ Словари загружены через ozvyx.js');
            return true;
        }
        return false;
    } catch (e) {
        console.warn('⚠️ Словари не загружены (файл dictionary.js не найден или ошибка):', e.message);
        return false;
    }
}

// ============================================================
// 8. ВЕРСИЯ И ИНФОРМАЦИЯ
// ============================================================
export const VERSION = '2.0.0';
export const NAME = 'OzvyX AI';
export const AUTHOR = 'OzvyX Labs';

console.log(`🧠 ${NAME} v${VERSION} загружен.`);

// ============================================================
// 9. ЭКСПОРТ ПО УМОЛЧАНИЮ (всё сразу)
// ============================================================
export default {
    // Core
    OzvyXEngine,
    Session,
    Skills,
    Utils,

    // UI
    OzvyXApp,
    Render,
    Storage,
    Theme,

    // Models
    Mistral,

    // Embedding
    embeddingSearch,

    // Функции
    processExperimentalRequest,
    initApp,
    resetSession,
    loadDictionaries,
    initEmbeddingSearch,

    // Инфо
    VERSION,
    NAME,
    AUTHOR
};
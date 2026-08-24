// AI/ui/storage.js — сохранение/загрузка данных в localStorage

// ============================================================
// 1. КЛЮЧИ ДЛЯ ХРАНЕНИЯ
// ============================================================
const KEYS = {
    HISTORY: 'ozvyx_chat_history',
    CURRENT: 'ozvyx_current_chat',
    SETTINGS: 'ozvyx_settings',
    THEME: 'ozvyx_theme'
};

// ============================================================
// 2. СОХРАНЕНИЕ/ЗАГРУЗКА ИСТОРИИ
// ============================================================

/**
 * Сохраняет всю историю чатов
 */
export function saveHistory(history) {
    try {
        localStorage.setItem(KEYS.HISTORY, JSON.stringify(history));
    } catch (e) {
        console.warn('Не удалось сохранить историю:', e);
    }
}

/**
 * Загружает историю чатов
 */
export function loadHistory() {
    try {
        const raw = localStorage.getItem(KEYS.HISTORY);
        if (!raw) return [];
        const parsed = JSON.parse(raw);
        return Array.isArray(parsed) ? parsed.filter(x => x && x.id && Array.isArray(x.messages)) : [];
    } catch (e) {
        return [];
    }
}

// ============================================================
// 3. ТЕКУЩИЙ ЧАТ
// ============================================================

/**
 * Сохраняет ID текущего чата
 */
export function saveCurrentChat(id) {
    try {
        localStorage.setItem(KEYS.CURRENT, id || '');
    } catch (e) {}
}

/**
 * Загружает ID текущего чата
 */
export function loadCurrentChat() {
    try {
        return localStorage.getItem(KEYS.CURRENT) || '';
    } catch (e) {
        return '';
    }
}

// ============================================================
// 4. НАСТРОЙКИ
// ============================================================

/**
 * Сохраняет настройки
 */
export function saveSettings(settings) {
    try {
        localStorage.setItem(KEYS.SETTINGS, JSON.stringify(settings));
    } catch (e) {}
}

/**
 * Загружает настройки
 */
export function loadSettings(defaultSettings = {}) {
    try {
        const raw = localStorage.getItem(KEYS.SETTINGS);
        if (!raw) return defaultSettings;
        const parsed = JSON.parse(raw);
        if (parsed && typeof parsed === 'object') {
            return { ...defaultSettings, ...parsed };
        }
        return defaultSettings;
    } catch (e) {
        return defaultSettings;
    }
}

// ============================================================
// 5. ТЕМА
// ============================================================

/**
 * Сохраняет тему
 */
export function saveTheme(theme) {
    try {
        localStorage.setItem(KEYS.THEME, theme);
    } catch (e) {}
}

/**
 * Загружает тему
 */
export function loadTheme(defaultTheme = 'light') {
    try {
        const theme = localStorage.getItem(KEYS.THEME);
        if (theme === 'dark' || theme === 'light') {
            return theme;
        }
        return defaultTheme;
    } catch (e) {
        return defaultTheme;
    }
}

// ============================================================
// 6. ОЧИСТКА
// ============================================================

/**
 * Очищает всё хранилище (все ключи)
 */
export function clearAllStorage() {
    try {
        Object.values(KEYS).forEach(key => localStorage.removeItem(key));
    } catch (e) {}
}

/**
 * Очищает только историю чатов
 */
export function clearHistory() {
    try {
        localStorage.removeItem(KEYS.HISTORY);
        localStorage.removeItem(KEYS.CURRENT);
    } catch (e) {}
}

// ============================================================
// 7. ЭКСПОРТ ПО УМОЛЧАНИЮ
// ============================================================
export default {
    KEYS,
    saveHistory,
    loadHistory,
    saveCurrentChat,
    loadCurrentChat,
    saveSettings,
    loadSettings,
    saveTheme,
    loadTheme,
    clearAllStorage,
    clearHistory
};
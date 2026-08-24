// AI/ui/theme.js — управление светлой/тёмной темой

// ============================================================
// 1. КОНСТАНТЫ
// ============================================================
const THEME_KEY = 'ozvyx_theme';
const THEMES = {
    LIGHT: 'light',
    DARK: 'dark'
};

// ============================================================
// 2. ОСНОВНЫЕ ФУНКЦИИ
// ============================================================

/**
 * Применяет тему к документу
 */
export function applyTheme(theme) {
    const root = document.documentElement;
    if (theme === THEMES.DARK) {
        root.setAttribute('data-theme', THEMES.DARK);
    } else {
        root.removeAttribute('data-theme');
    }
    // Сохраняем в localStorage
    try {
        localStorage.setItem(THEME_KEY, theme);
    } catch (e) {
        // игнорируем ошибки localStorage
    }
}

/**
 * Возвращает текущую тему (из localStorage или 'light' по умолчанию)
 */
export function getCurrentTheme() {
    try {
        const stored = localStorage.getItem(THEME_KEY);
        if (stored === THEMES.DARK || stored === THEMES.LIGHT) {
            return stored;
        }
    } catch (e) {
        // игнорируем ошибки localStorage
    }
    // Проверяем системные настройки
    if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
        return THEMES.DARK;
    }
    return THEMES.LIGHT;
}

/**
 * Переключает тему (светлая ↔ тёмная)
 */
export function toggleTheme() {
    const current = getCurrentTheme();
    const next = current === THEMES.DARK ? THEMES.LIGHT : THEMES.DARK;
    applyTheme(next);
    return next;
}

/**
 * Обновляет кнопки темы в UI
 */
export function updateThemeButtons(theme, mainBtn, sidebarBtn) {
    const icon = theme === THEMES.DARK ? '☀' : '◐';
    const title = theme === THEMES.DARK ? 'Светлая тема' : 'Тёмная тема';

    if (mainBtn) {
        mainBtn.textContent = icon;
        mainBtn.title = title;
    }
    if (sidebarBtn) {
        sidebarBtn.textContent = theme === THEMES.DARK ? '☀ Светлая тема' : '◐ Тёмная тема';
        sidebarBtn.title = title;
    }
}

/**
 * Инициализация темы (применяет сохранённую или системную)
 */
export function initTheme() {
    const theme = getCurrentTheme();
    applyTheme(theme);
    return theme;
}

// ============================================================
// 3. ЭКСПОРТ ПО УМОЛЧАНИЮ
// ============================================================
export default {
    THEMES,
    applyTheme,
    getCurrentTheme,
    toggleTheme,
    updateThemeButtons,
    initTheme
};
// AI/core/utils.js — базовые утилиты для всего проекта
// Строки, математика, работа с текстом, синонимы

// ============================================================
// 1. РАБОТА СО СТРОКАМИ
// ============================================================

/**
 * Нормализация текста: нижний регистр, удаление лишних символов, схлопывание пробелов
 */
export function normalize(text) {
    return text.toLowerCase()
        .replace(/[^а-яa-z0-9\s]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
}

/**
 * Извлечение значимых слов (минимальная длина, стоп-слова)
 */
export function extractWords(text, minLen = 2) {
    const words = text.toLowerCase().match(/[а-яa-z0-9]+/g) || [];
    const stop = new Set([
        'и','в','не','на','я','быть','он','с','что','а','по','это','она','к','но',
        'мы','как','из','у','то','за','свой','ее','так','его','который','от','такой',
        'для','же','все','the','is','a','an','and','or','but','in','on','at','to',
        'for','of','with','by','без','безо','близ','во','вместо','вне','для','до',
        'за','из','из-за','из-под','к','ко','между','на','над','о','об','от','перед',
        'по','под','при','про','ради','с','сквозь','у','через','чрез'
    ]);
    return words.filter(w => w.length >= minLen && !stop.has(w));
}

/**
 * Случайный элемент из массива
 */
export function randomPick(arr) {
    return arr[Math.floor(Math.random() * arr.length)];
}

// ============================================================
// 2. МАТЕМАТИКА
// ============================================================

/**
 * Безопасное вычисление математического выражения
 */
export function safeCalc(expr) {
    try {
        const sanitized = expr.replace(/[^0-9+\-*/%().]/g, '');
        if (!sanitized || /[a-zA-Z_]/.test(sanitized)) return null;
        const result = Function('"use strict"; return (' + sanitized + ')')();
        return typeof result === 'number' ? Math.round(result * 1e6) / 1e6 : null;
    } catch { return null; }
}

// ============================================================
// 3. РАССТОЯНИЕ ЛЕВЕНШТЕЙНА (для опечаток)
// ============================================================

/**
 * Расстояние Левенштейна между двумя строками
 */
export function levenshteinDistance(a, b) {
    if (a.length < b.length) [a, b] = [b, a];
    if (!b) return a.length;
    let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
    for (let i = 1; i <= a.length; i++) {
        const curr = [i];
        for (let j = 1; j <= b.length; j++) {
            const cost = a[i-1] === b[j-1] ? 0 : 1;
            curr[j] = Math.min(curr[j-1] + 1, prev[j] + 1, prev[j-1] + cost);
        }
        prev = curr;
    }
    return prev[b.length];
}

// ============================================================
// 4. РАБОТА С КЛЮЧЕВЫМИ СЛОВАМИ И РЕЗЮМЕ
// ============================================================

/**
 * Извлекает наиболее частотные ключевые слова
 */
export function extractKeywords(text, maxK = 5) {
    const words = extractWords(text);
    if (!words.length) return [];
    const freq = {};
    for (const w of words) freq[w] = (freq[w] || 0) + 1;
    return Object.entries(freq)
        .sort((a, b) => b[1] - a[1])
        .slice(0, maxK)
        .map(([w]) => w);
}

/**
 * Краткое изложение текста (первые и ключевые предложения)
 */
export function summarize(text, maxSentences = 3) {
    const sentences = text.match(/[^.!?]+[.!?]+/g) || [text];
    if (sentences.length <= maxSentences) return sentences.join(' ').trim();
    const key = extractKeywords(text, 3);
    const important = [];
    for (const s of sentences) {
        if (key.some(k => s.toLowerCase().includes(k))) important.push(s.trim());
    }
    const result = [sentences[0].trim()];
    for (const s of important.slice(1)) {
        if (result.length < maxSentences && !result.includes(s)) result.push(s);
    }
    if (result.length < maxSentences) result.push(sentences[sentences.length-1].trim());
    return result.join(' ');
}

// ============================================================
// 5. СИНОНИМЫ
// ============================================================

/**
 * Возвращает синонимы для слова (из встроенного словаря)
 */
export function getSynonyms(word) {
    const SYNONYMS = {
        'привет': ['здравствуй', 'хай', 'салют', 'здрасте', 'здорово', 'ку'],
        'пока': ['до свидания', 'до встречи', 'бывай', 'счастливо', 'чао'],
        'работа': ['офис', 'служба', 'занятие', 'должность', 'труд'],
        'начальник': ['босс', 'руководитель', 'шеф', 'лидер', 'менеджер'],
        'любовь': ['романтика', 'отношения', 'чувства', 'страсть', 'привязанность'],
        'друг': ['товарищ', 'приятель', 'кореш', 'братан', 'бро'],
        'грустно': ['печально', 'тоскливо', 'уныло', 'плохо', 'хреново'],
        'хорошо': ['отлично', 'классно', 'круто', 'супер', 'пиздато'],
        'еда': ['кушать', 'жрать', 'пища', 'обед', 'ужин'],
        'деньги': ['финансы', 'бюджет', 'капитал', 'средства', 'бабки'],
    };
    for (const [key, syns] of Object.entries(SYNONYMS)) {
        if (word === key || syns.includes(word)) return [key, ...syns];
    }
    return [word];
}

// ============================================================
// 6. РАБОТА С ФАЙЛАМИ (вспомогательные)
// ============================================================

/**
 * Определяет иконку для типа файла
 */
export function fileIcon(f) {
    if (!f) return '📄';
    if (f.type && f.type.startsWith('image/')) return '🖼️';
    if (f.type === 'application/pdf' || f.name?.toLowerCase().endsWith('.pdf')) return '📕';
    if (f.name?.toLowerCase().endsWith('.docx')) return '📘';
    if (f.type?.includes('wordprocessingml')) return '📘';
    return '📄';
}

/**
 * Форматирует размер файла в читаемый вид
 */
export function formatBytes(bytes) {
    if (!Number.isFinite(bytes) || bytes <= 0) return '0 Б';
    const units = ['Б', 'КБ', 'МБ', 'ГБ'];
    const e = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
    return `${(bytes / Math.pow(1024, e)).toFixed(e ? 1 : 0)} ${units[e]}`;
}

// ============================================================
// 7. ЭКСПОРТ ПО УМОЛЧАНИЮ
// ============================================================
export default {
    normalize,
    extractWords,
    randomPick,
    safeCalc,
    levenshteinDistance,
    extractKeywords,
    summarize,
    getSynonyms,
    fileIcon,
    formatBytes
};
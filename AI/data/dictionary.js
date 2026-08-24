// AI/data/dictionary.js — загрузчик словарей в Windows-1251
// Файлы russian.txt и Russian_surnames.txt лежат в той же папке

// ============================================================
// 1. ЗАГРУЗКА ОДНОГО ФАЙЛА
// ============================================================
export async function loadDictionaryWin1251(url) {
    try {
        const response = await fetch(url);
        const buffer = await response.arrayBuffer();
        const decoder = new TextDecoder('windows-1251');
        const text = decoder.decode(buffer);
        const words = text.split('\n')
            .map(w => w.trim().toLowerCase())
            .filter(w => w.length > 0);
        return new Set(words);
    } catch (err) {
        console.error(`❌ Ошибка загрузки ${url}:`, err);
        return new Set();
    }
}

// ============================================================
// 2. ЗАГРУЗКА ОСНОВНОГО СЛОВАРЯ
// ============================================================
export async function loadMainDictionary() {
    if (!window.RUSSIAN_WORDS) {
        // Путь от корня проекта (index.html)
        window.RUSSIAN_WORDS = await loadDictionaryWin1251('AI/data/russian.txt');
        console.log(`📚 Загружено русских слов: ${window.RUSSIAN_WORDS.size}`);
    }
    return window.RUSSIAN_WORDS;
}

// ============================================================
// 3. ЗАГРУЗКА ФАМИЛИЙ
// ============================================================
export async function loadSurnames() {
    if (!window.RUSSIAN_SURNAMES) {
        window.RUSSIAN_SURNAMES = await loadDictionaryWin1251('AI/data/Russian_surnames.txt');
        console.log(`📚 Загружено фамилий: ${window.RUSSIAN_SURNAMES.size}`);
    }
    return window.RUSSIAN_SURNAMES;
}

// ============================================================
// 4. ЗАГРУЗКА ВСЕХ СЛОВАРЕЙ
// ============================================================
export async function loadAllDictionaries() {
    await Promise.all([loadMainDictionary(), loadSurnames()]);
    console.log('✅ Все словари загружены (Windows-1251)');
}

// ============================================================
// 5. ФУНКЦИИ ДЛЯ РАБОТЫ СО СЛОВАРЯМИ (для удобства)
// ============================================================

/**
 * Проверяет, есть ли слово в словаре
 */
export function isRussianWord(word) {
    if (!window.RUSSIAN_WORDS) return false;
    return window.RUSSIAN_WORDS.has(word.toLowerCase());
}

/**
 * Проверяет, есть ли фамилия в словаре
 */
export function isRussianSurname(word) {
    if (!window.RUSSIAN_SURNAMES) return false;
    return window.RUSSIAN_SURNAMES.has(word.toLowerCase());
}

/**
 * Находит ближайшее слово в словаре (исправление опечаток)
 * Использует расстояние Левенштейна
 */
export function findClosestWord(word, maxDist = 2) {
    if (!window.RUSSIAN_WORDS) return null;
    if (window.RUSSIAN_WORDS.has(word.toLowerCase())) return word;

    // Если словарь большой, не будем перебирать все 1.5 млн слов
    // Возьмём только слова той же длины ±2 символа
    const target = word.toLowerCase();
    const targetLen = target.length;
    const candidates = Array.from(window.RUSSIAN_WORDS)
        .filter(w => Math.abs(w.length - targetLen) <= 2);

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

/**
 * Расстояние Левенштейна (для поиска опечаток)
 */
function levenshteinDistance(a, b) {
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
// 6. АВТОМАТИЧЕСКАЯ ЗАГРУЗКА ПРИ ИМПОРТЕ
// ============================================================
// Если файл подключается как модуль, словари загружаются сразу
// (но можно вызвать вручную для контроля)

// Загрузка при первом импорте (если не в режиме ожидания)
let loading = false;
let loaded = false;

export async function ensureDictionariesLoaded() {
    if (loaded) return;
    if (loading) {
        // Ждём текущую загрузку
        while (loading) await new Promise(r => setTimeout(r, 100));
        return;
    }
    loading = true;
    try {
        await loadAllDictionaries();
        loaded = true;
    } finally {
        loading = false;
    }
}

// Если этот файл импортируется, словари загружаются в фоне
ensureDictionariesLoaded();

// ============================================================
// 7. ЭКСПОРТ ПО УМОЛЧАНИЮ
// ============================================================
export default {
    loadDictionaryWin1251,
    loadMainDictionary,
    loadSurnames,
    loadAllDictionaries,
    isRussianWord,
    isRussianSurname,
    findClosestWord,
    ensureDictionariesLoaded
};
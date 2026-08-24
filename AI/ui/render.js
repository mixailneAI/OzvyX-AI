// AI/ui/render.js — рендеринг сообщений, Markdown, подсветка кода

// ============================================================
// 1. ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ
// ============================================================

/**
 * Экранирование HTML-спецсимволов
 */
export function esc(text) {
    return String(text ?? '').replace(/[&<>'"]/g, (c) => ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        "'": '&#39;',
        '"': '&quot;'
    }[c] || c));
}

/**
 * Форматирование даты
 */
export function formatDate(isoString) {
    try {
        return new Intl.DateTimeFormat('ru-RU', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        }).format(new Date(isoString));
    } catch {
        return isoString || '';
    }
}

/**
 * Форматирование размера файла
 */
export function formatBytes(bytes) {
    if (!Number.isFinite(bytes) || bytes <= 0) return '0 Б';
    const units = ['Б', 'КБ', 'МБ', 'ГБ'];
    const e = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
    return `${(bytes / Math.pow(1024, e)).toFixed(e ? 1 : 0)} ${units[e]}`;
}

// ============================================================
// 2. РЕНДЕРИНГ MESSAGES
// ============================================================

/**
 * Создаёт элемент сообщения
 */
export function createMessageElement(message, isUser = false) {
    const row = document.createElement('div');
    row.className = `message-row ${isUser ? 'user' : 'bot'}`;

    const box = document.createElement('div');
    box.className = 'message';

    const time = formatDate(message.timestamp);
    const label = isUser ? 'Вы' : 'OzvyX';

    let content = '';
    if (isUser) {
        content = renderUserMessage(message);
    } else {
        content = renderAssistantMessage(message);
    }

    box.innerHTML = `
        <div class="message-meta">
            <span>${label}</span>
            <span>${esc(time)}</span>
        </div>
        <div class="message-content">${content}</div>
    `;

    row.appendChild(box);
    return row;
}

/**
 * Рендеринг сообщения пользователя
 */
function renderUserMessage(message) {
    const body = esc(message.content || '').replace(/\n/g, '<br>');
    const files = Array.isArray(message.files) ? message.files : [];
    const att = files.length ? `
        <div class="attachment-inline">
            ${files.map(f => `<span class="attachment-badge">${esc(f.name)} · ${formatBytes(f.size || 0)}</span>`).join('')}
        </div>
    ` : '';
    return body + att;
}

/**
 * Рендеринг сообщения ассистента
 */
function renderAssistantMessage(message) {
    if (message.imageUrl) {
        return `<img class="bot-image" src="${esc(message.imageUrl)}" alt="Сгенерированное изображение">` +
            (message.content ? renderMarkdown(message.content) : '');
    }
    return renderMarkdown(message.content || '');
}

// ============================================================
// 3. РЕНДЕРИНГ MARKDOWN
// ============================================================

/**
 * Преобразует Markdown в HTML
 */
export function renderMarkdown(text) {
    let s = esc(text);

    // Блоки кода
    s = s.replace(/```([\w+-]*)\n([\s\S]*?)```/g, (_, lang, code) => {
        const safeLang = esc(lang || 'plaintext');
        const encoded = encodeURIComponent(code);
        return `<div class="code-wrap">
                    <div class="code-header">
                        <span>${safeLang || 'code'}</span>
                        <button class="copy-code" data-code="${encoded}">Копировать</button>
                    </div>
                    <pre><code class="language-${safeLang || 'plaintext'}">${code}</code></pre>
                </div>`;
    });

    // Заголовки
    s = s.replace(/^###### (.*)$/gm, '<h6>$1</h6>')
         .replace(/^##### (.*)$/gm, '<h5>$1</h5>')
         .replace(/^#### (.*)$/gm, '<h4>$1</h4>')
         .replace(/^### (.*)$/gm, '<h3>$1</h3>')
         .replace(/^## (.*)$/gm, '<h2>$1</h2>')
         .replace(/^# (.*)$/gm, '<h1>$1</h1>');

    // Цитаты
    s = s.replace(/^> (.*)$/gm, '<blockquote>$1</blockquote>');

    // Списки (маркированные)
    s = s.replace(/(?:^|\n)((?:[-*] .+(?:\n|$))+)/g, (_, block) => {
        const items = block.trim().split(/\n/).map(x => `<li>${x.replace(/^[-*] /, '')}</li>`).join('');
        return `<ul>${items}</ul>`;
    });

    // Списки (нумерованные)
    s = s.replace(/(?:^|\n)((?:\d+\. .+(?:\n|$))+)/g, (_, block) => {
        const items = block.trim().split(/\n/).map(x => `<li>${x.replace(/^\d+\. /, '')}</li>`).join('');
        return `<ol>${items}</ol>`;
    });

    // Жирный
    s = s.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
         .replace(/__(.+?)__/g, '<strong>$1</strong>');

    // Курсив
    s = s.replace(/\*(.+?)\*/g, '<em>$1</em>')
         .replace(/_(.+?)_/g, '<em>$1</em>');

    // Код в строке
    s = s.replace(/`([^`\n]+)`/g, '<code>$1</code>');

    // Ссылки
    s = s.replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g,
        '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>');

    // Параграфы
    s = s.replace(/\n{2,}/g, '</p><p>').replace(/\n/g, '<br>');

    return `<p>${s}</p>`;
}

// ============================================================
// 4. ПОДСВЕТКА КОДА И КОПИРОВАНИЕ
// ============================================================

/**
 * Активирует подсветку кода в контейнере
 */
export function enhanceCodeBlocks(container) {
    // Подсветка через highlight.js
    container.querySelectorAll('pre code').forEach((block) => {
        try {
            if (window.hljs) {
                window.hljs.highlightElement(block);
            }
        } catch (e) {
            // игнорируем ошибки подсветки
        }
    });

    // Кнопки копирования
    container.querySelectorAll('.copy-code').forEach((btn) => {
        btn.addEventListener('click', async () => {
            try {
                const code = decodeURIComponent(btn.dataset.code || '');
                await navigator.clipboard.writeText(code);
                btn.textContent = '✅ Скопировано';
                setTimeout(() => (btn.textContent = 'Копировать'), 2000);
            } catch {
                btn.textContent = '❌ Ошибка';
                setTimeout(() => (btn.textContent = 'Копировать'), 2000);
            }
        });
    });
}

// ============================================================
// 5. ИСТОРИЯ И ЗАГОЛОВОК
// ============================================================

/**
 * Рендерит список истории
 */
export function renderHistory(history, currentId, container) {
    if (!container) return;
    container.innerHTML = '';

    if (!history || !history.length) {
        container.innerHTML = '<div class="history-empty">История пока пуста.</div>';
        return;
    }

    for (const session of history) {
        const btn = document.createElement('button');
        btn.className = `session-item${session.id === currentId ? ' active' : ''}`;
        btn.type = 'button';
        btn.innerHTML = `
            <div class="session-title">${esc(session.title || 'Новый чат')}</div>
            <div class="session-meta">${formatDate(session.updatedAt || session.createdAt)}</div>
        `;
        btn.dataset.id = session.id;
        container.appendChild(btn);
    }
}

/**
 * Обновляет заголовок чата
 */
export function updateTitle(messages, titleElement) {
    if (!titleElement) return;
    const first = messages.find(x => x.role === 'user' && x.content);
    if (!first) {
        titleElement.textContent = 'Новый чат';
        return;
    }
    const plain = String(first.content).replace(/\s+/g, ' ').trim();
    titleElement.textContent = (plain.slice(0, 30) || 'Новый чат') + (plain.length > 30 ? '…' : '');
}

// ============================================================
// 6. АТТАЧМЕНТЫ (ФАЙЛЫ)
// ============================================================

/**
 * Рендерит список прикреплённых файлов
 */
export function renderAttachments(attachments, container) {
    if (!container) return;
    container.innerHTML = '';

    if (!attachments || !attachments.length) return;

    for (const item of attachments) {
        const chip = document.createElement('div');
        chip.className = 'file-chip';
        chip.title = item.contentPreview || `${item.name} · ${formatBytes(item.size)}`;

        const icon = item.type?.startsWith('image/') ? '🖼️' :
                     item.type === 'application/pdf' ? '📕' :
                     item.name?.toLowerCase().endsWith('.docx') ? '📘' : '📄';

        chip.innerHTML = `
            <span class="file-icon">${icon}</span>
            <span class="file-info">
                <span class="file-name">${esc(item.name)}</span>
                <span class="file-size">${formatBytes(item.size)}</span>
            </span>
            <button class="file-remove" data-id="${item.id}" title="Удалить">×</button>
        `;
        container.appendChild(chip);
    }
}

// ============================================================
// 7. WELCOME СООБЩЕНИЕ
// ============================================================

/**
 * Создаёт приветственное сообщение (когда нет истории)
 */
export function createWelcomeMessage() {
    const div = document.createElement('div');
    div.className = 'welcome';
    div.innerHTML = `
        <h1>🧠 OzvyX AI</h1>
        <p>Локальный JS-движок. Мгновенная работа без интернета.</p>
        <div class="chips">
            <span>🧪 Experimental (JS)</span>
            <span>📎 Файлы</span>
            <span>🧩 Markdown</span>
            <span>💾 Локальная история</span>
        </div>
    `;
    return div;
}

// ============================================================
// 8. ЭКСПОРТ ПО УМОЛЧАНИЮ
// ============================================================
export default {
    esc,
    formatDate,
    formatBytes,
    createMessageElement,
    renderMarkdown,
    enhanceCodeBlocks,
    renderHistory,
    updateTitle,
    renderAttachments,
    createWelcomeMessage
};// AI/ui/render.js — рендеринг сообщений, Markdown, подсветка кода

// ============================================================
// 1. ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ
// ============================================================

/**
 * Экранирование HTML-спецсимволов
 */
export function esc(text) {
    return String(text ?? '').replace(/[&<>'"]/g, (c) => ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        "'": '&#39;',
        '"': '&quot;'
    }[c] || c));
}

/**
 * Форматирование даты
 */
export function formatDate(isoString) {
    try {
        return new Intl.DateTimeFormat('ru-RU', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        }).format(new Date(isoString));
    } catch {
        return isoString || '';
    }
}

/**
 * Форматирование размера файла
 */
export function formatBytes(bytes) {
    if (!Number.isFinite(bytes) || bytes <= 0) return '0 Б';
    const units = ['Б', 'КБ', 'МБ', 'ГБ'];
    const e = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
    return `${(bytes / Math.pow(1024, e)).toFixed(e ? 1 : 0)} ${units[e]}`;
}

// ============================================================
// 2. РЕНДЕРИНГ MESSAGES
// ============================================================

/**
 * Создаёт элемент сообщения
 */
export function createMessageElement(message, isUser = false) {
    const row = document.createElement('div');
    row.className = `message-row ${isUser ? 'user' : 'bot'}`;

    const box = document.createElement('div');
    box.className = 'message';

    const time = formatDate(message.timestamp);
    const label = isUser ? 'Вы' : 'OzvyX';

    let content = '';
    if (isUser) {
        content = renderUserMessage(message);
    } else {
        content = renderAssistantMessage(message);
    }

    box.innerHTML = `
        <div class="message-meta">
            <span>${label}</span>
            <span>${esc(time)}</span>
        </div>
        <div class="message-content">${content}</div>
    `;

    row.appendChild(box);
    return row;
}

/**
 * Рендеринг сообщения пользователя
 */
function renderUserMessage(message) {
    const body = esc(message.content || '').replace(/\n/g, '<br>');
    const files = Array.isArray(message.files) ? message.files : [];
    const att = files.length ? `
        <div class="attachment-inline">
            ${files.map(f => `<span class="attachment-badge">${esc(f.name)} · ${formatBytes(f.size || 0)}</span>`).join('')}
        </div>
    ` : '';
    return body + att;
}

/**
 * Рендеринг сообщения ассистента
 */
function renderAssistantMessage(message) {
    if (message.imageUrl) {
        return `<img class="bot-image" src="${esc(message.imageUrl)}" alt="Сгенерированное изображение">` +
            (message.content ? renderMarkdown(message.content) : '');
    }
    return renderMarkdown(message.content || '');
}

// ============================================================
// 3. РЕНДЕРИНГ MARKDOWN
// ============================================================

/**
 * Преобразует Markdown в HTML
 */
export function renderMarkdown(text) {
    let s = esc(text);

    // Блоки кода
    s = s.replace(/```([\w+-]*)\n([\s\S]*?)```/g, (_, lang, code) => {
        const safeLang = esc(lang || 'plaintext');
        const encoded = encodeURIComponent(code);
        return `<div class="code-wrap">
                    <div class="code-header">
                        <span>${safeLang || 'code'}</span>
                        <button class="copy-code" data-code="${encoded}">Копировать</button>
                    </div>
                    <pre><code class="language-${safeLang || 'plaintext'}">${code}</code></pre>
                </div>`;
    });

    // Заголовки
    s = s.replace(/^###### (.*)$/gm, '<h6>$1</h6>')
         .replace(/^##### (.*)$/gm, '<h5>$1</h5>')
         .replace(/^#### (.*)$/gm, '<h4>$1</h4>')
         .replace(/^### (.*)$/gm, '<h3>$1</h3>')
         .replace(/^## (.*)$/gm, '<h2>$1</h2>')
         .replace(/^# (.*)$/gm, '<h1>$1</h1>');

    // Цитаты
    s = s.replace(/^> (.*)$/gm, '<blockquote>$1</blockquote>');

    // Списки (маркированные)
    s = s.replace(/(?:^|\n)((?:[-*] .+(?:\n|$))+)/g, (_, block) => {
        const items = block.trim().split(/\n/).map(x => `<li>${x.replace(/^[-*] /, '')}</li>`).join('');
        return `<ul>${items}</ul>`;
    });

    // Списки (нумерованные)
    s = s.replace(/(?:^|\n)((?:\d+\. .+(?:\n|$))+)/g, (_, block) => {
        const items = block.trim().split(/\n/).map(x => `<li>${x.replace(/^\d+\. /, '')}</li>`).join('');
        return `<ol>${items}</ol>`;
    });

    // Жирный
    s = s.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
         .replace(/__(.+?)__/g, '<strong>$1</strong>');

    // Курсив
    s = s.replace(/\*(.+?)\*/g, '<em>$1</em>')
         .replace(/_(.+?)_/g, '<em>$1</em>');

    // Код в строке
    s = s.replace(/`([^`\n]+)`/g, '<code>$1</code>');

    // Ссылки
    s = s.replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g,
        '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>');

    // Параграфы
    s = s.replace(/\n{2,}/g, '</p><p>').replace(/\n/g, '<br>');

    return `<p>${s}</p>`;
}

// ============================================================
// 4. ПОДСВЕТКА КОДА И КОПИРОВАНИЕ
// ============================================================

/**
 * Активирует подсветку кода в контейнере
 */
export function enhanceCodeBlocks(container) {
    // Подсветка через highlight.js
    container.querySelectorAll('pre code').forEach((block) => {
        try {
            if (window.hljs) {
                window.hljs.highlightElement(block);
            }
        } catch (e) {
            // игнорируем ошибки подсветки
        }
    });

    // Кнопки копирования
    container.querySelectorAll('.copy-code').forEach((btn) => {
        btn.addEventListener('click', async () => {
            try {
                const code = decodeURIComponent(btn.dataset.code || '');
                await navigator.clipboard.writeText(code);
                btn.textContent = '✅ Скопировано';
                setTimeout(() => (btn.textContent = 'Копировать'), 2000);
            } catch {
                btn.textContent = '❌ Ошибка';
                setTimeout(() => (btn.textContent = 'Копировать'), 2000);
            }
        });
    });
}

// ============================================================
// 5. ИСТОРИЯ И ЗАГОЛОВОК
// ============================================================

/**
 * Рендерит список истории
 */
export function renderHistory(history, currentId, container) {
    if (!container) return;
    container.innerHTML = '';

    if (!history || !history.length) {
        container.innerHTML = '<div class="history-empty">История пока пуста.</div>';
        return;
    }

    for (const session of history) {
        const btn = document.createElement('button');
        btn.className = `session-item${session.id === currentId ? ' active' : ''}`;
        btn.type = 'button';
        btn.innerHTML = `
            <div class="session-title">${esc(session.title || 'Новый чат')}</div>
            <div class="session-meta">${formatDate(session.updatedAt || session.createdAt)}</div>
        `;
        btn.dataset.id = session.id;
        container.appendChild(btn);
    }
}

/**
 * Обновляет заголовок чата
 */
export function updateTitle(messages, titleElement) {
    if (!titleElement) return;
    const first = messages.find(x => x.role === 'user' && x.content);
    if (!first) {
        titleElement.textContent = 'Новый чат';
        return;
    }
    const plain = String(first.content).replace(/\s+/g, ' ').trim();
    titleElement.textContent = (plain.slice(0, 30) || 'Новый чат') + (plain.length > 30 ? '…' : '');
}

// ============================================================
// 6. АТТАЧМЕНТЫ (ФАЙЛЫ)
// ============================================================

/**
 * Рендерит список прикреплённых файлов
 */
export function renderAttachments(attachments, container) {
    if (!container) return;
    container.innerHTML = '';

    if (!attachments || !attachments.length) return;

    for (const item of attachments) {
        const chip = document.createElement('div');
        chip.className = 'file-chip';
        chip.title = item.contentPreview || `${item.name} · ${formatBytes(item.size)}`;

        const icon = item.type?.startsWith('image/') ? '🖼️' :
                     item.type === 'application/pdf' ? '📕' :
                     item.name?.toLowerCase().endsWith('.docx') ? '📘' : '📄';

        chip.innerHTML = `
            <span class="file-icon">${icon}</span>
            <span class="file-info">
                <span class="file-name">${esc(item.name)}</span>
                <span class="file-size">${formatBytes(item.size)}</span>
            </span>
            <button class="file-remove" data-id="${item.id}" title="Удалить">×</button>
        `;
        container.appendChild(chip);
    }
}

// ============================================================
// 7. WELCOME СООБЩЕНИЕ
// ============================================================

/**
 * Создаёт приветственное сообщение (когда нет истории)
 */
export function createWelcomeMessage() {
    const div = document.createElement('div');
    div.className = 'welcome';
    div.innerHTML = `
        <h1>🧠 OzvyX AI</h1>
        <p>Локальный JS-движок. Мгновенная работа без интернета.</p>
        <div class="chips">
            <span>🧪 Experimental (JS)</span>
            <span>📎 Файлы</span>
            <span>🧩 Markdown</span>
            <span>💾 Локальная история</span>
        </div>
    `;
    return div;
}

// ============================================================
// 8. ЭКСПОРТ ПО УМОЛЧАНИЮ
// ============================================================
export default {
    esc,
    formatDate,
    formatBytes,
    createMessageElement,
    renderMarkdown,
    enhanceCodeBlocks,
    renderHistory,
    updateTitle,
    renderAttachments,
    createWelcomeMessage
};
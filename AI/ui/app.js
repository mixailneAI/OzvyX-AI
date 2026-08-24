// AI/ui/app.js — главный UI-класс OzvyXApp

import { OzvyXEngine } from '../core/engine.js';
import * as Storage from './storage.js';
import * as Render from './render.js';
import * as Theme from './theme.js';
import { embeddingSearch } from '../embedding-search.js';

// ============================================================
// ГЛАВНЫЙ КЛАСС
// ============================================================
export class OzvyXApp {
    constructor() {
        // Движок
        this.engine = new OzvyXEngine();

        // DOM элементы (задаются при инициализации)
        this.elements = {};

        // Состояние
        this.state = {
            busy: false,
            attachments: [],
            messages: [],
            history: [],
            currentId: null,
            settings: {
                model: 'experimental',
                mode: 'general',
                temperature: 0.7,
                maxTokens: 1200,
                systemPrompt: '',
                theme: 'light'
            }
        };

        // Флаги
        this._initialized = false;
    }

    // ============================================================
    // ИНИЦИАЛИЗАЦИЯ
    // ============================================================

    /**
     * Инициализация приложения с DOM-элементами
     */
    async init(elements) {
        if (this._initialized) return;
        this.elements = elements;

        // Загружаем данные из localStorage
        this.loadState();

        // Применяем настройки
        this.applySettings();

        // Рендерим всё
        this.renderAll();

        // Привязываем события
        this.bindEvents();

        // Показываем статус
        this.setStatus('Готово.');

        // Инициализируем эмбеддинги (если есть база)
        if (window.EXTRA_KNOWLEDGE && Object.keys(window.EXTRA_KNOWLEDGE).length > 0) {
            try {
                this.setStatus('Загрузка модели для поиска по смыслу...');
                await this.engine.initEmbeddingSearch(window.EXTRA_KNOWLEDGE);
                this.setStatus('✅ Поиск по смыслу готов.', 'success');
            } catch (err) {
                console.warn('Не удалось инициализировать эмбеддинги:', err);
                this.setStatus('⚠️ Поиск по смыслу недоступен.', 'error');
                // Продолжаем работу без эмбеддингов — старые навыки всё равно работают
            }
        }

        this._initialized = true;
        console.log('🔥 OzvyX UI инициализирован.');
    }

    // ============================================================
    // ЗАГРУЗКА/СОХРАНЕНИЕ
    // ============================================================

    loadState() {
        // История
        this.state.history = Storage.loadHistory();

        // Текущий чат
        const currentId = Storage.loadCurrentChat();
        const found = this.state.history.find(x => x.id === currentId);
        if (found) {
            this.state.currentId = found.id;
            this.state.messages = structuredClone(found.messages || []);
        } else {
            this.createNewChat(false);
        }

        // Настройки
        const defaultSettings = {
            model: 'experimental',
            mode: 'general',
            temperature: 0.7,
            maxTokens: 1200,
            systemPrompt: '',
            theme: 'light'
        };
        this.state.settings = Storage.loadSettings(defaultSettings);

        // Тема
        const savedTheme = Storage.loadTheme('light');
        if (savedTheme !== this.state.settings.theme) {
            this.state.settings.theme = savedTheme;
        }
    }

    saveState() {
        Storage.saveHistory(this.state.history);
        Storage.saveCurrentChat(this.state.currentId);
        Storage.saveSettings(this.state.settings);
        Storage.saveTheme(this.state.settings.theme);
    }

    // ============================================================
    // НАСТРОЙКИ
    // ============================================================

    applySettings() {
        const s = this.state.settings;
        const els = this.elements;

        if (els.modelSelect) els.modelSelect.value = s.model;
        if (els.modeSelect) els.modeSelect.value = s.mode;
        if (els.temperatureRange) els.temperatureRange.value = String(s.temperature);
        if (els.temperatureValue) els.temperatureValue.textContent = Number(s.temperature).toFixed(2);
        if (els.tokensRange) els.tokensRange.value = String(s.maxTokens);
        if (els.tokensValue) els.tokensValue.textContent = String(s.maxTokens);
        if (els.systemPrompt) els.systemPrompt.value = s.systemPrompt || '';

        Theme.applyTheme(s.theme);
        this.updateModelHelp();
    }

    updateModelHelp() {
        const els = this.elements;
        const isExperimental = this.state.settings.model === 'experimental';

        if (els.modelHelp) {
            els.modelHelp.textContent = isExperimental
                ? '🧠 Локальный JS-движок + эмбеддинги.'
                : 'Обработка через Mistral API.';
        }

        if (els.chatModel) {
            const label = isExperimental ? '🧪 Experimental (JS + эмбеддинги)' : this.state.settings.model;
            els.chatModel.textContent = label;
        }

        if (els.chatTitle) {
            Render.updateTitle(this.state.messages, els.chatTitle);
        }
    }

    // ============================================================
    // ЧАТ
    // ============================================================

    createNewChat(save = true) {
        this.state.currentId = 'id_' + Date.now() + '_' + Math.random().toString(36).slice(2, 9);
        this.state.messages = [];
        this.state.attachments = [];
        if (save) {
            this.persistCurrent();
            this.renderAll();
        }
    }

    persistCurrent() {
        const title = this.deriveTitle();
        const idx = this.state.history.findIndex(x => x.id === this.state.currentId);

        const session = {
            id: this.state.currentId,
            title: title,
            createdAt: idx >= 0 ? this.state.history[idx].createdAt : new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            messages: this.state.messages
        };

        if (idx >= 0) {
            this.state.history[idx] = session;
        } else {
            this.state.history.unshift(session);
        }

        this.state.history.sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));
        this.saveState();
        this.renderHistory();
        this.updateTitle();
    }

    deriveTitle() {
        const first = this.state.messages.find(x => x.role === 'user' && x.content);
        if (!first) return 'Новый чат';
        const plain = String(first.content).replace(/\s+/g, ' ').trim();
        return (plain.slice(0, 30) || 'Новый чат') + (plain.length > 30 ? '…' : '');
    }

    loadSession(id) {
        const session = this.state.history.find(x => x.id === id);
        if (!session) return;
        this.state.currentId = session.id;
        this.state.messages = structuredClone(session.messages || []);
        this.state.attachments = [];
        this.saveState();
        this.renderAll();
        this.closeSidebar();
    }

    // ============================================================
    // ОТПРАВКА СООБЩЕНИЯ
    // ============================================================

    async sendMessage() {
        if (this.state.busy) return;

        const input = this.elements.messageInput;
        const text = input.value.trim();
        if (!text && !this.state.attachments.length) return;

        this.state.busy = true;
        this.updateButtonState();

        // Собираем файлы для отправки
        const attachmentsForRequest = this.buildAttachmentPayload();

        // Сохраняем сообщение пользователя
        const userMessage = {
            role: 'user',
            content: text || 'Пожалуйста, обработай прикреплённые файлы.',
            timestamp: new Date().toISOString(),
            files: this.state.attachments.map(f => ({ name: f.name, size: f.size, type: f.type }))
        };
        this.state.messages.push(userMessage);
        this.persistCurrent();
        this.renderMessages();

        // Очищаем поле ввода
        input.value = '';
        this.autoResizeTextarea();

        // Показываем печатание
        this.renderTyping();

        this.setStatus('Обрабатываю запрос...');

        try {
            // Вызываем движок (он сам решит, использовать эмбеддинги или нет)
            const reply = await this.engine.process(text, attachmentsForRequest);

            this.removeTyping();

            const botMessage = {
                role: 'assistant',
                content: reply || 'Модель вернула пустой ответ.',
                timestamp: new Date().toISOString()
            };
            this.state.messages.push(botMessage);
            this.persistCurrent();
            this.renderMessages();
            this.setStatus('Готово.', 'success');

            // Предложение скачать Markdown, если это отчёт
            if (/\b(отч[её]т|исследовани[ея])\b/i.test(text)) {
                this.suggestMarkdownDownload(reply);
            }
        } catch (err) {
            this.removeTyping();
            const errorText = err?.message || String(err);
            this.state.messages.push({
                role: 'assistant',
                content: `**Ошибка:** ${errorText}`,
                timestamp: new Date().toISOString()
            });
            this.persistCurrent();
            this.renderMessages();
            this.setStatus(errorText, 'error');
        } finally {
            // Очищаем вложения
            for (const f of this.state.attachments) {
                if (f.previewUrl) URL.revokeObjectURL(f.previewUrl);
            }
            this.state.attachments = [];
            this.renderAttachments();
            this.state.busy = false;
            this.updateButtonState();
        }
    }

    // ============================================================
    // РЕНДЕРИНГ
    // ============================================================

    renderAll() {
        this.updateTitle();
        this.renderHistory();
        this.renderMessages();
        this.renderAttachments();
        this.updateButtonState();
        this.updateModelHelp();
        this.updateThemeUI();
    }

    updateTitle() {
        if (this.elements.chatTitle) {
            Render.updateTitle(this.state.messages, this.elements.chatTitle);
        }
        this.updateModelHelp();
    }

    renderHistory() {
        Render.renderHistory(
            this.state.history,
            this.state.currentId,
            this.elements.historyList
        );
    }

    renderMessages() {
        const container = this.elements.chatInner;
        if (!container) return;
        container.innerHTML = '';

        if (!this.state.messages.length) {
            container.appendChild(Render.createWelcomeMessage());
            return;
        }

        for (const msg of this.state.messages) {
            const el = Render.createMessageElement(msg, msg.role === 'user');
            container.appendChild(el);
            Render.enhanceCodeBlocks(el);
        }

        this.scrollToBottom();
    }

    renderAttachments() {
        Render.renderAttachments(this.state.attachments, this.elements.attachments);

        // Обработчики удаления
        if (this.elements.attachments) {
            this.elements.attachments.querySelectorAll('.file-remove').forEach(btn => {
                btn.addEventListener('click', () => {
                    const id = btn.dataset.id;
                    if (id) this.removeAttachment(id);
                });
            });
        }
    }

    renderTyping() {
        this.removeTyping();
        const row = document.createElement('div');
        row.className = 'message-row bot';
        row.id = 'typingRow';
        row.innerHTML = `
            <div class="message">
                <div class="message-meta">
                    <span>OzvyX</span>
                    <span>печатает…</span>
                </div>
                <div class="message-content">
                    <span class="typing">
                        <span></span><span></span><span></span>
                    </span>
                </div>
            </div>
        `;
        if (this.elements.chatInner) {
            this.elements.chatInner.appendChild(row);
            this.scrollToBottom();
        }
    }

    removeTyping() {
        const el = document.getElementById('typingRow');
        if (el) el.remove();
    }

    // ============================================================
    // ВСПОМОГАТЕЛЬНЫЕ UI
    // ============================================================

    updateThemeUI() {
        Theme.updateThemeButtons(
            this.state.settings.theme,
            this.elements.mainThemeBtn,
            this.elements.sidebarThemeBtn
        );
    }

    updateButtonState() {
        const btns = [
            this.elements.sendBtn,
            this.elements.generateBtn,
            this.elements.attachBtn
        ];
        for (const btn of btns) {
            if (btn) btn.disabled = this.state.busy;
        }
    }

    setStatus(text, type = '') {
        const bar = this.elements.statusBar;
        if (bar) {
            bar.textContent = text;
            bar.className = `statusbar${type ? ` ${type}` : ''}`;
        }
    }

    scrollToBottom() {
        const box = this.elements.chatBox;
        if (box) {
            requestAnimationFrame(() => {
                box.scrollTop = box.scrollHeight;
            });
        }
    }

    autoResizeTextarea() {
        const el = this.elements.messageInput;
        if (el) {
            el.style.height = 'auto';
            el.style.height = `${Math.min(190, Math.max(56, el.scrollHeight))}px`;
        }
    }

    closeSidebar() {
        const sidebar = this.elements.sidebar;
        const overlay = this.elements.overlay;
        if (sidebar) sidebar.classList.remove('open');
        if (overlay) overlay.classList.remove('open');
    }

    // ============================================================
    // ФАЙЛЫ
    // ============================================================

    buildAttachmentPayload() {
        return this.state.attachments.map(item => ({
            name: item.name,
            size: item.size,
            type: item.type,
            text: item.text || '',
            contentPreview: item.contentPreview || '',
            previewUrl: item.previewUrl || null,
            dataUrl: item.dataUrl || null,
            file: item.file || null
        }));
    }

    removeAttachment(id) {
        const idx = this.state.attachments.findIndex(x => x.id === id);
        if (idx < 0) return;
        if (this.state.attachments[idx].previewUrl) {
            URL.revokeObjectURL(this.state.attachments[idx].previewUrl);
        }
        this.state.attachments.splice(idx, 1);
        this.renderAttachments();
    }

    // ============================================================
    // ЭКСПОРТ
    // ============================================================

    suggestMarkdownDownload(content) {
        const container = this.elements.chatInner;
        if (!container) return;

        const row = document.createElement('div');
        row.className = 'message-row bot';
        row.innerHTML = `
            <div class="message">
                <div class="message-meta">
                    <span>OzvyX</span>
                    <span>отчёт</span>
                </div>
                <div class="message-content">
                    <p>Готов также файл <strong>.md</strong> с этим ответом.</p>
                    <button class="btn primary" type="button">Скачать Markdown</button>
                </div>
            </div>
        `;

        row.querySelector('button').addEventListener('click', () => {
            const blob = new Blob([content || ''], { type: 'text/markdown;charset=utf-8' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `ozvyx-report-${Date.now()}.md`;
            a.click();
            setTimeout(() => URL.revokeObjectURL(url), 1000);
        });

        container.appendChild(row);
        this.scrollToBottom();
    }

    // ============================================================
    // СОБЫТИЯ
    // ============================================================

    bindEvents() {
        const els = this.elements;

        // Отправка
        if (els.sendBtn) {
            els.sendBtn.addEventListener('click', () => this.sendMessage());
        }

        if (els.messageInput) {
            els.messageInput.addEventListener('keydown', (e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    this.sendMessage();
                }
            });
            els.messageInput.addEventListener('input', () => this.autoResizeTextarea());
        }

        // Настройки
        if (els.modelSelect) {
            els.modelSelect.addEventListener('change', (e) => {
                this.state.settings.model = e.target.value;
                this.saveState();
                this.updateModelHelp();
            });
        }

        if (els.modeSelect) {
            els.modeSelect.addEventListener('change', (e) => {
                this.state.settings.mode = e.target.value;
                this.saveState();
            });
        }

        if (els.temperatureRange) {
            els.temperatureRange.addEventListener('input', (e) => {
                this.state.settings.temperature = Number(e.target.value);
                if (els.temperatureValue) {
                    els.temperatureValue.textContent = this.state.settings.temperature.toFixed(2);
                }
                this.saveState();
            });
        }

        if (els.tokensRange) {
            els.tokensRange.addEventListener('input', (e) => {
                this.state.settings.maxTokens = Number(e.target.value);
                if (els.tokensValue) {
                    els.tokensValue.textContent = String(this.state.settings.maxTokens);
                }
                this.saveState();
            });
        }

        if (els.systemPrompt) {
            els.systemPrompt.addEventListener('input', (e) => {
                this.state.settings.systemPrompt = e.target.value;
                this.saveState();
            });
        }

        // Файлы
        if (els.attachBtn && els.fileInput) {
            els.attachBtn.addEventListener('click', () => els.fileInput.click());
            els.fileInput.addEventListener('change', (e) => {
                const files = e.target.files;
                if (files && files.length) {
                    this.attachFiles(files);
                }
                els.fileInput.value = '';
            });
        }

        // Тема
        if (els.mainThemeBtn) {
            els.mainThemeBtn.addEventListener('click', () => this.toggleTheme());
        }
        if (els.sidebarThemeBtn) {
            els.sidebarThemeBtn.addEventListener('click', () => this.toggleTheme());
        }

        // История
        if (els.newChatBtn) {
            els.newChatBtn.addEventListener('click', () => {
                this.createNewChat(true);
                this.closeSidebar();
                this.setStatus('Создан новый чат.');
            });
        }

        if (els.clearChatBtn) {
            els.clearChatBtn.addEventListener('click', () => this.clearChat());
        }

        if (els.clearAllBtn) {
            els.clearAllBtn.addEventListener('click', () => this.clearEverything());
        }

        // Экспорт/импорт
        if (els.exportBtn) {
            els.exportBtn.addEventListener('click', () => this.exportHistory());
        }

        if (els.importBtn && els.importInput) {
            els.importBtn.addEventListener('click', () => els.importInput.click());
            els.importInput.addEventListener('change', (e) => {
                const file = e.target.files?.[0];
                if (file) this.importHistory(file);
                els.importInput.value = '';
            });
        }

        // Генерация изображения (если есть кнопка)
        if (els.generateBtn) {
            els.generateBtn.addEventListener('click', () => this.generateImage());
        }

        // Меню (мобилка)
        if (els.menuBtn) {
            els.menuBtn.addEventListener('click', () => {
                const sidebar = els.sidebar;
                const overlay = els.overlay;
                if (sidebar) sidebar.classList.add('open');
                if (overlay) overlay.classList.add('open');
            });
        }

        if (els.overlay) {
            els.overlay.addEventListener('click', () => this.closeSidebar());
        }

        // Drag and drop
        if (els.chatBox) {
            ['dragenter', 'dragover'].forEach(type => {
                els.chatBox.addEventListener(type, (e) => {
                    e.preventDefault();
                    this.setStatus('Перетащите файлы сюда…');
                });
            });
            els.chatBox.addEventListener('drop', (e) => {
                e.preventDefault();
                const files = e.dataTransfer?.files;
                if (files && files.length) {
                    this.attachFiles(files);
                }
            });
        }
    }

    // ============================================================
    // ДОПОЛНИТЕЛЬНЫЕ ДЕЙСТВИЯ
    // ============================================================

    toggleTheme() {
        this.state.settings.theme = Theme.toggleTheme();
        this.updateThemeUI();
        this.saveState();
    }

    clearChat() {
        if (this.state.busy) return;
        if (!this.state.messages.length || confirm('Очистить текущий чат?')) {
            this.state.messages = [];
            this.persistCurrent();
            this.renderAll();
            this.setStatus('Текущий чат очищен.');
        }
    }

    clearEverything() {
        if (!confirm('Удалить всю историю и настройки?')) return;
        Storage.clearAllStorage();
        this.state.history = [];
        this.state.settings = {
            model: 'experimental',
            mode: 'general',
            temperature: 0.7,
            maxTokens: 1200,
            systemPrompt: '',
            theme: 'light'
        };
        this.createNewChat(false);
        this.applySettings();
        this.renderAll();
        this.setStatus('История и настройки удалены.', 'success');
    }

    exportHistory() {
        const payload = {
            version: 1,
            exportedAt: new Date().toISOString(),
            history: this.state.history,
            settings: { ...this.state.settings }
        };
        const json = JSON.stringify(payload, null, 2);
        const blob = new Blob([json], { type: 'application/json;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `ozvyx-backup-${new Date().toISOString().slice(0, 10)}.json`;
        a.click();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
    }

    async importHistory(file) {
        try {
            const text = await file.text();
            const data = JSON.parse(text);
            if (!Array.isArray(data.history)) {
                throw new Error('Некорректный JSON резервной копии.');
            }
            this.state.history = data.history.filter(x => x && x.id && Array.isArray(x.messages));
            if (data.settings && typeof data.settings === 'object') {
                this.state.settings = { ...this.state.settings, ...data.settings };
            }
            const first = this.state.history[0];
            if (first) {
                this.state.currentId = first.id;
                this.state.messages = structuredClone(first.messages || []);
            } else {
                this.createNewChat(false);
            }
            this.saveState();
            this.applySettings();
            this.renderAll();
            this.setStatus('История импортирована.', 'success');
        } catch (err) {
            this.setStatus(`Импорт не выполнен: ${err.message}`, 'error');
        }
    }

    // ============================================================
    // ГЕНЕРАЦИЯ ИЗОБРАЖЕНИЯ (опционально, через Mistral)
    // ============================================================

    async generateImage() {
        const input = this.elements.messageInput;
        const prompt = input.value.trim();
        if (!prompt) {
            this.setStatus('Введите описание изображения перед генерацией.', 'error');
            return;
        }
        this.setStatus('Генерация изображений требует Mistral API или другой сервис.', 'error');
        // Здесь можно вызвать внешний API, если он настроен
    }

    // ============================================================
    // ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ ДЛЯ ФАЙЛОВ
    // ============================================================

    async attachFiles(files) {
        const list = Array.from(files || []);
        if (!list.length) return;
        this.setStatus('Подготавливаю файлы…');

        for (const file of list) {
            if (this.state.attachments.some(x => x.name === file.name && x.size === file.size && x.lastModified === file.lastModified)) {
                continue;
            }
            try {
                const meta = {
                    id: 'file_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6),
                    name: file.name,
                    size: file.size,
                    type: file.type || 'application/octet-stream',
                    lastModified: file.lastModified,
                    file: file,
                    previewUrl: file.type.startsWith('image/') ? URL.createObjectURL(file) : null,
                    dataUrl: null,
                    text: null,
                    contentPreview: null
                };

                // Для изображений — dataUrl
                if (file.type.startsWith('image/')) {
                    meta.dataUrl = await this.readFileAsDataUrl(file);
                }

                // Для текстовых файлов — извлечение текста
                if (!file.type.startsWith('image/')) {
                    meta.text = await this.fileToText(file);
                    if (meta.text) {
                        meta.contentPreview = meta.text.slice(0, 6000);
                    }
                }

                this.state.attachments.push(meta);
            } catch (err) {
                this.setStatus(`Не удалось прочитать ${file.name}: ${err.message}`, 'error');
            }
        }

        this.renderAttachments();
        this.setStatus(this.state.attachments.length ? `Прикреплено файлов: ${this.state.attachments.length}.` : 'Готово.');
    }

    readFileAsDataUrl(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(String(reader.result || ''));
            reader.onerror = () => reject(reader.error || new Error('Не удалось прочитать файл.'));
            reader.readAsDataURL(file);
        });
    }

    async fileToText(file) {
        const ext = file.name.split('.').pop()?.toLowerCase();

        // Текстовые файлы
        if (file.type.startsWith('text/') ||
            ['txt', 'md', 'csv', 'json', 'js', 'ts', 'jsx', 'tsx', 'css', 'html', 'xml', 'yaml', 'yml', 'sql', 'py', 'java', 'c', 'cpp', 'h', 'hpp', 'log'].includes(ext)) {
            return await file.text();
        }

        // PDF
        if (file.type === 'application/pdf' || ext === 'pdf') {
            return await this.extractPdfText(file);
        }

        // DOCX
        if (file.type.includes('wordprocessingml') || ext === 'docx') {
            return await this.extractDocxText(file);
        }

        return '';
    }

    async extractPdfText(file) {
        if (!window.pdfjsLib) throw new Error('pdf.js не загрузился.');
        const buf = await file.arrayBuffer();
        const pdf = await window.pdfjsLib.getDocument({ data: buf }).promise;
        const pages = [];
        for (let i = 1; i <= pdf.numPages; i++) {
            const page = await pdf.getPage(i);
            const content = await page.getTextContent();
            pages.push(content.items.map(item => item.str).join(' '));
        }
        return pages.join('\n\n');
    }

    async extractDocxText(file) {
        if (!window.mammoth) throw new Error('mammoth.js не загрузился.');
        const buf = await file.arrayBuffer();
        const result = await window.mammoth.extractRawText({ arrayBuffer: buf });
        return result.value || '';
    }
}

// ============================================================
// ЭКСПОРТ ПО УМОЛЧАНИЮ
// ============================================================
export default OzvyXApp;
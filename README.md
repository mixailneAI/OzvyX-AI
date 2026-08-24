# Ozvyx AI
🧠 OzvyX AI — локальный интеллектуальный помощник

Русская версия / Russian version

OzvyX — это полностью локальный AI-чат-бот, работающий прямо в вашем браузере. Он понимает смысл ваших вопросов (благодаря эмбеддингам), а не просто ищет по ключевым словам. Всё, что ему нужно для работы, — это ваш браузер и база знаний. Никаких серверов, никаких API-ключей, никакой передачи данных в интернет.

---

🚀 Особенности

· 🔍 Поиск по смыслу — использует Transformers.js для создания векторных представлений (эмбеддингов) вопросов и поиска наиболее подходящего ответа из базы знаний.
· 🧠 12+ встроенных навыков:
  · Приветствие / прощание
  · Калькулятор
  · Прогноз погоды (через Open-Meteo)
  · Перевод текста (через LibreTranslate)
  · Поиск в Wikipedia
  · Генерация кода (Python / JavaScript)
  · Генерация идей
  · Анализ файлов (текстовые, PDF, DOCX, изображения)
  · Проверка орфографии (с поддержкой русского словаря)
· 📚 Огромная база знаний — вы можете пополнить её своими вопросами и ответами в файле knowledge.js.
· 🌐 Полностью локально — не требует интернета (кроме загрузки модели эмбеддингов при первом запуске).
· 🌗 Тёмная / светлая тема — адаптируется под ваши предпочтения.
· 📎 Работа с файлами — прикрепляйте изображения, PDF, DOCX, текстовые файлы — бот проанализирует их содержимое.
· 💾 История чатов — все диалоги сохраняются локально в вашем браузере.

---

🧪 Как использовать

· Просто напишите вопрос на русском или английском — OzvyX найдёт ответ по смыслу, даже если вы перефразируете его.
· Введите /reset — чтобы сбросить текущую сессию и начать новый диалог.
· Прикрепите файл (изображение, PDF, DOCX, текстовый файл) — бот проанализирует его и ответит на основе содержимого.
· Используйте специальные команды, например:
  · «какая погода в Москве» — получите прогноз.
  · «переведи на английский "привет мир"» — перевод.
  · «напиши функцию на Python, которая суммирует два числа» — генерация кода.

---

🛠️ Технологический стек

· JavaScript (ES Modules) — весь код написан на чистом JS.
· Transformers.js — эмбеддинги и работа с моделями в браузере.
· Highlight.js — подсветка синтаксиса в ответах.
· PDF.js и Mammoth.js — чтение PDF и DOCX файлов.
· Open-Meteo API — прогноз погоды (необязательно, работает в демо-режиме при отсутствии сети).
· LibreTranslate API — перевод (также опционально).

---

📂 Структура проекта

```
ozvyx-ai/
├── index.html              # главная страница
├── AI/
│   ├── ozvyx.js            # точка входа, экспорт всего
│   ├── embedding-search.js # поиск по эмбеддингам
│   ├── core/               # ядро
│   │   ├── engine.js       # главный движок
│   │   ├── session.js      # управление сессией
│   │   ├── skills.js       # все навыки
│   │   └── utils.js        # утилиты
│   ├── ui/                 # интерфейс
│   │   ├── app.js          # главный UI-класс
│   │   ├── render.js       # рендеринг
│   │   ├── storage.js      # localStorage
│   │   └── theme.js        # тема
│   ├── data/               # данные
│   │   ├── knowledge.js    # база знаний (ваша)
│   │   ├── dictionary.js   # загрузчик словарей
│   │   ├── russian.txt     # словарь (~1.5 млн слов)
│   │   └── Russian_surnames.txt # фамилии
│   └── libs/               # библиотеки
│       └── transformers.web.min.js # Transformers.js
└── README.md               # этот файл
```

---

🤝 Вклад в проект

Если вы хотите улучшить OzvyX — добавляйте новые навыки, улучшайте интерфейс, расширяйте базу знаний.
Сделайте форк, внесите изменения и отправьте pull request.

---

📄 Лицензия

Проект распространяется под лицензией Apache License 2.0 — вы можете использовать, изменять и распространять код, при условии сохранения уведомления об авторстве и соблюдения условий лицензии.

---

👤 Автор

OzvyX Labs
Создано с любовью для тех, кто ценит приватность и интеллектуальные технологии.

---

---

🧠 OzvyX AI — Local Intelligent Assistant

English version

OzvyX is a fully local AI chatbot that runs directly in your browser. It understands the meaning of your questions (thanks to embeddings), not just keywords. Everything it needs is your browser and the knowledge base — no servers, no API keys, no data sent to the internet.

---

🚀 Features

· 🔍 Semantic search — uses Transformers.js to create vector embeddings of questions and find the most relevant answer from the knowledge base.
· 🧠 12+ built-in skills:
  · Greeting / Goodbye
  · Calculator
  · Weather forecast (via Open-Meteo)
  · Text translation (via LibreTranslate)
  · Wikipedia search
  · Code generation (Python / JavaScript)
  · Idea generation
  · File analysis (text, PDF, DOCX, images)
  · Spell checking (with Russian dictionary support)
· 📚 Huge knowledge base — you can extend it with your own Q&A pairs in knowledge.js.
· 🌐 Fully local — no internet required (except for the initial download of the embedding model).
· 🌗 Dark / Light theme — adapts to your preferences.
· 📎 File support — attach images, PDFs, DOCX, text files; the bot will analyze their content.
· 💾 Chat history — all conversations are stored locally in your browser.

---

🧪 How to use

· Just type your question in Russian or English — OzvyX will find the answer by meaning, even if you rephrase it.
· Type /reset to clear the current session and start a new conversation.
· Attach a file (image, PDF, DOCX, text file) — the bot will analyze it and respond based on its content.
· Use special commands, e.g.:
  · "what's the weather in Moscow" — get a forecast.
  · "translate 'hello world' to Russian" — translation.
  · "write a Python function that adds two numbers" — code generation.

---

🛠️ Tech Stack

· JavaScript (ES Modules) — all code is pure JS.
· Transformers.js — embeddings and model handling in the browser.
· Highlight.js — syntax highlighting in responses.
· PDF.js and Mammoth.js — PDF and DOCX file reading.
· Open-Meteo API — weather forecast (optional; works in demo mode offline).
· LibreTranslate API — translation (also optional).

---

📂 Project Structure

```
ozvyx-ai/
├── index.html              # main page
├── AI/
│   ├── ozvyx.js            # entry point, exports everything
│   ├── embedding-search.js # semantic search
│   ├── core/               # core engine
│   │   ├── engine.js       # main engine
│   │   ├── session.js      # session management
│   │   ├── skills.js       # all skills
│   │   └── utils.js        # utilities
│   ├── ui/                 # UI
│   │   ├── app.js          # main UI class
│   │   ├── render.js       # rendering
│   │   ├── storage.js      # localStorage
│   │   └── theme.js        # theme
│   ├── data/               # data
│   │   ├── knowledge.js    # knowledge base (yours)
│   │   ├── dictionary.js   # dictionary loader
│   │   ├── russian.txt     # dictionary (~1.5M words)
│   │   └── Russian_surnames.txt # surnames
│   └── libs/               # libraries
│       └── transformers.web.min.js # Transformers.js
└── README.md               # this file
```

---

🤝 Contributing

If you’d like to improve OzvyX — add new skills, enhance the UI, expand the knowledge base.
Fork the repo, make your changes, and submit a pull request.

---

📄 License

This project is licensed under the Apache License 2.0 — you can use, modify, and distribute the code, provided you keep the copyright notice and comply with the license terms.

---

👤 Author

OzvyX Labs
Made with love for those who value privacy and smart technology.
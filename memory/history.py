"""Память диалога для OzvyX-small.

Хранит последние реплики (user/assistant) в списке и синхронизирует его с
JSON-файлом. `get_context()` склеивает реплики в строку формата

    Вы: ...
    OzvyX: ...
    Вы: ...

которую main.py подставляет в промпт перед вызовом generate.

Обрезка: не более `max_turns` полных пар user+assistant. Старые реплики
отбрасываются. Это защищает от разрастания контекста и от того, что модель
начнёт «видеть» слишком длинную историю, не влезающую в block_size.

Путь к файлу задаётся из SETTINGS.history_path (по умолчанию
memory/history.json). Если файл не существует или повреждён — память стартует
пустой, никаких падений.
"""

import json
import os

from config.settings import SETTINGS


class ConversationMemory:
    """История диалога с автосохранением в JSON."""

    def __init__(self, path: str = None, max_turns: int = 6):
        self.path = path or SETTINGS.history_path
        self.max_turns = max_turns
        self.messages = []
        self._load()

    # ---------------------------------------------------------- api
    def add_user(self, text: str) -> None:
        self.messages.append({"role": "user", "content": text})
        self._trim()

    def add_assistant(self, text: str) -> None:
        self.messages.append({"role": "assistant", "content": text})
        self._trim()
        self._save()

    def get_context(self) -> str:
        """Склеивает историю в промпт-строку."""
        lines = []
        for m in self.messages:
            prefix = "Вы" if m["role"] == "user" else "OzvyX"
            lines.append(f"{prefix}: {m['content']}")
        return "\n".join(lines)

    def clear(self) -> None:
        self.messages = []
        self._save()

    # ---------------------------------------------------------- io
    def _load(self) -> None:
        if not os.path.exists(self.path):
            return
        try:
            with open(self.path, encoding="utf-8") as f:
                data = json.load(f)
            if not isinstance(data, list):
                raise ValueError("история должна быть списком")
            # простая валидация полей
            cleaned = []
            for item in data:
                if (isinstance(item, dict)
                        and item.get("role") in ("user", "assistant")
                        and isinstance(item.get("content"), str)):
                    cleaned.append({"role": item["role"],
                                    "content": item["content"]})
            self.messages = cleaned
        except Exception:
            # повреждённый файл — начинаем с чистой истории
            self.messages = []

    def _save(self) -> None:
        d = os.path.dirname(self.path)
        if d:
            os.makedirs(d, exist_ok=True)
        with open(self.path, "w", encoding="utf-8") as f:
            json.dump(self.messages, f, ensure_ascii=False, indent=2)

    def _trim(self) -> None:
        """Оставляет не более max_turns полных пар user+assistant."""
        cap = self.max_turns * 2
        if len(self.messages) > cap:
            self.messages = self.messages[-cap:]

"""Все гиперпараметры и пути проекта OzvyX-small.

Единственное место, где задаются числа модели, обучения, инференса и путей.
Никаких магических констант в других модулях — только импорт SETTINGS.
"""

from dataclasses import dataclass


@dataclass
class Settings:
    # ---------- Архитектура модели ----------
    n_layer: int = 5          # число трансформер-блоков
    n_head: int = 4           # число голов внимания
    n_embd: int = 128          # размерность эмбеддинга (должна делиться на n_head)
    block_size: int = 96      # длина контекста (в токенах)

    # ---------- Обучение ----------
    batch_size: int = 32
    learning_rate: float = 2e-3
    iterations: int = 1500
    eval_interval: int = 200
    eval_batches: int = 20
    train_split: float = 0.9

    # ---------- Инференс ----------
    temperature: float = 0.8
    top_k: int = 40
    max_tokens: int = 150

    # ---------- Пути (относительно корня проекта) ----------
    data_path: str = "data/input.txt"
    checkpoint_path: str = "checkpoints/brain_v2.npz"
    tokenizer_path: str = "checkpoints/dict_v2.json"
    history_path: str = "memory/history.json"

    # ---------- Данные ----------
    # Замените URL на свой корпус, если хотите обучать на другом тексте.
    data_url: str = (
        "https://raw.githubusercontent.com/karpathy/"
        "char-rnn/master/data/tinyshakespeare/input.txt"
    )

    def validate(self) -> None:
        """Проверяет базовые инварианты архитектуры."""
        if self.n_embd % self.n_head != 0:
            raise ValueError(
                f"n_embd ({self.n_embd}) должно делиться на n_head ({self.n_head})"
            )
        if self.n_layer < 1:
            raise ValueError("n_layer должен быть >= 1")
        if self.block_size < 2:
            raise ValueError("block_size должен быть >= 2")
        if not (0.0 < self.train_split < 1.0):
            raise ValueError("train_split должен быть в (0, 1)")


# Глобальный экземпляр — импортируется во всех модулях.
SETTINGS = Settings()
SETTINGS.validate()

"""Цикл обучения OzvyX-small.

Запуск «как есть» (полные настройки из SETTINGS):

    python -m training.trainer

Логика:
1. Читает `settings.data_path`, строит CharTokenizer по всему тексту.
2. Делит закодированные данные на train/val по `settings.train_split`.
3. Создаёт OzvyxSmall и Adam.
4. Крутит `settings.iterations` шагов: forward → backward → Adam.step.
5. Каждые `settings.eval_interval` шагов считает средний val-loss.
6. По завершении сохраняет чекпоинт (`.npz`) и токенизатор (`.json`).

Функция `train` принимает `settings` явно — это нужно для быстрых тестов
(маленькая модель, мало итераций), не трогая глобальный SETTINGS.
"""

import os
import sys
from dataclasses import replace

import numpy as np

from config.settings import SETTINGS, Settings
from model.transformer import OzvyxSmall, Adam
from model.tokenizer import CharTokenizer
from training.dataset import get_batch
from utils.logger import get_logger

logger = get_logger(__name__)


def _evaluate(model: OzvyxSmall, val_data: np.ndarray,
              settings: Settings, rng: np.random.Generator) -> float:
    """Средний val-loss на `settings.eval_batches` случайных батчах."""
    losses = []
    for _ in range(settings.eval_batches):
        xv, yv = get_batch(val_data, settings.block_size,
                           settings.batch_size, rng=rng)
        _, loss, _ = model.forward(xv, yv)
        losses.append(loss)
    return float(np.mean(losses))


def train(settings: Settings = None) -> str:
    """Обучает модель. Возвращает путь к сохранённому чекпоинту."""
    s = settings or SETTINGS
    s.validate()

    if not os.path.exists(s.data_path):
        raise FileNotFoundError(
            f"Корпус не найден: {s.data_path}. "
            f"Сначала: python -m training.prepare_data"
        )

    # --- данные и токенизатор ---
    with open(s.data_path, encoding="utf-8") as f:
        text = f.read()
    if len(text) < s.block_size + 2:
        raise ValueError(
            f"Корпус слишком короткий: {len(text)} символов, "
            f"нужно минимум {s.block_size + 2}"
        )

    tokenizer = CharTokenizer(text)
    data = tokenizer.encode(text)
    n_train = int(s.train_split * len(data))
    train_data, val_data = data[:n_train], data[n_train:]

    logger.info(f"Корпус: {len(text)} символов, vocab={tokenizer.vocab_size}")
    logger.info(f"train: {len(train_data)} токенов, val: {len(val_data)} токенов")

    # --- модель и оптимизатор ---
    model = OzvyxSmall(
        vocab_size=tokenizer.vocab_size,
        block_size=s.block_size,
        n_layer=s.n_layer,
        n_head=s.n_head,
        n_embd=s.n_embd,
        seed=0,
    )
    n_params = sum(p.size for p in model.params.values())
    logger.info(f"Модель: {n_params:,} параметров, "
                f"{s.n_layer} слоёв, {s.n_head} голов, эмбеддинг {s.n_embd}")

    opt = Adam(model.params, lr=s.learning_rate)
    rng = np.random.default_rng(0)

    # --- цикл обучения ---
    for step in range(1, s.iterations + 1):
        xb, yb = get_batch(train_data, s.block_size, s.batch_size, rng=rng)
        _, loss, cache = model.forward(xb, yb)
        grads = model.backward(cache)
        opt.step(grads)

        if step % s.eval_interval == 0 or step == s.iterations:
            val_loss = _evaluate(model, val_data, s, rng)
            logger.info(
                f"step {step:5d}/{s.iterations}  "
                f"train={loss:.4f}  val={val_loss:.4f}  "
                f"lr={opt.lr:.2e}"
            )

    # --- сохранение ---
    model.save(s.checkpoint_path)
    tokenizer.save(s.tokenizer_path)
    logger.info(f"Чекпоинт: {s.checkpoint_path}")
    logger.info(f"Токенизатор: {s.tokenizer_path}")
    return s.checkpoint_path


if __name__ == "__main__":
    try:
        path = train()
    except FileNotFoundError as e:
        logger.error(str(e))
        sys.exit(1)
    print(f"OK: {path}")

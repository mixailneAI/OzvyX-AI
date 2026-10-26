"""Формирование батчей для обучения.

`get_batch` берёт B случайных окон длины block_size из 1-D массива токенов
и возвращает пару (x, y), где y — тот же x, сдвинутый на один токен вправо.
Именно так ставится задача next-token prediction для decoder-only модели:

    x = data[i : i + T]
    y = data[i + 1 : i + T + 1]

Границы: i ∈ [0, len(data) - T - 1], чтобы `i + T + 1` не вышел за массив.

Допускается передавать np.random.Generator как rng — это нужно для
воспроизводимости в тестах и в trainer.
"""

import numpy as np


def get_batch(data: np.ndarray,
              block_size: int,
              batch_size: int,
              rng: np.random.Generator = None):
    """Возвращает (x, y) формы (B, T) с int-индексами из data.

    :param data:       1-D массив токенов (int).
    :param block_size: длина контекста T.
    :param batch_size: число примеров B.
    :param rng:        опциональный np.random.Generator для воспроизводимости.
    :return: (x, y), оба (B, T).
    """
    if data.ndim != 1:
        raise ValueError(f"data должен быть 1-D, получили ndim={data.ndim}")
    if len(data) < block_size + 2:
        raise ValueError(
            f"data слишком короткий: len={len(data)}, нужно >= {block_size + 2}"
        )
    rng = rng or np.random.default_rng()

    # верхняя граница (включительно) для стартового индекса
    hi = len(data) - block_size - 1
    ix = rng.integers(0, hi + 1, size=batch_size)

    x = np.stack([data[i:i + block_size] for i in ix])
    y = np.stack([data[i + 1:i + block_size + 1] for i in ix])
    return x, y

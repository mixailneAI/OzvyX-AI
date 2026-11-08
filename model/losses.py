"""Кросс-энтропия для языкового моделирования.

Использование в `transformer.forward`:

    loss, dlogits = cross_entropy(logits, targets)

где logits: (B, T, V), targets: (B, T) — целые индексы в [0, V).
Градиент dlogits имеет ту же форму, что и logits, и уже нормирован
на общее число токенов (B*T), чтобы Adam не зависел от размера батча.
"""

import numpy as np


def cross_entropy(logits: np.ndarray, targets: np.ndarray):
    """Считает mean cross-entropy и градиент по logits.

    :param logits: (B, T, V) — «сырые» выходы модели.
    :param targets: (B, T) — правильные индексы (int).
    :return: (loss: float, dlogits: np.ndarray формы logits)
    """
    B, T, V = logits.shape
    x = logits.reshape(-1, V)               # (N, V)
    y = targets.reshape(-1).astype(np.int64)  # (N,)

    # log-softmax через max-shift (численная устойчивость)
    m = x.max(axis=-1, keepdims=True)
    shifted = x - m
    exp_shifted = np.exp(shifted)
    s = exp_shifted.sum(axis=-1, keepdims=True)
    log_probs = shifted - np.log(s)          # (N, V)

    n = y.shape[0]
    loss = -log_probs[np.arange(n), y].mean()

    # dL/dlogits = softmax - one_hot(target), усреднённый по N
    probs = exp_shifted / s                  # (N, V)
    dlogits = probs
    dlogits[np.arange(n), y] -= 1.0
    dlogits = (dlogits / n).reshape(B, T, V)

    return float(loss), dlogits

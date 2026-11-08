"""Численные примитивы трансформера: forward + ручной backward.

Каждая пара `*_forward` / `*_backward` следует контракту:
- `*_forward` возвращает (output, cache);
- `*_backward(dout, cache)` возвращает градиенты в порядке аргументов forward.

Никакого состояния модуль не хранит — только функции. Веса передаются снаружи.
Все расчёты в float64 (NumPy default) для стабильности ручного backprop на малых
моделях; на телефоне это не критично по скорости.
"""

import numpy as np


# ---------------------------------------------------------------- softmax
def softmax(x: np.ndarray) -> np.ndarray:
    """Softmax по последней оси с вычитанием максимума (численная устойчивость)."""
    shifted = x - x.max(axis=-1, keepdims=True)
    e = np.exp(shifted)
    return e / e.sum(axis=-1, keepdims=True)


# ---------------------------------------------------------------- GELU
# Аппроксимация tanh (как в GPT-2): 0.5*x*(1 + tanh(sqrt(2/pi)*(x + 0.044715*x^3)))
_GELU_C = np.sqrt(2.0 / np.pi)


def gelu(x: np.ndarray) -> np.ndarray:
    inner = _GELU_C * (x + 0.044715 * x ** 3)
    return 0.5 * x * (1.0 + np.tanh(inner))


def gelu_grad(x: np.ndarray) -> np.ndarray:
    """Производная GELU по x (используется в backward MLP)."""
    inner = _GELU_C * (x + 0.044715 * x ** 3)
    t = np.tanh(inner)
    d_inner = _GELU_C * (1.0 + 3.0 * 0.044715 * x ** 2)
    return 0.5 * (1.0 + t) + 0.5 * x * (1.0 - t ** 2) * d_inner


# ---------------------------------------------------------------- LayerNorm
def ln_forward(x: np.ndarray, gamma: np.ndarray, beta: np.ndarray,
               eps: float = 1e-5):
    """LayerNorm по последней оси. x: (..., C). Возвращает (y, cache)."""
    mu = x.mean(axis=-1, keepdims=True)
    var = x.var(axis=-1, keepdims=True)
    inv_std = 1.0 / np.sqrt(var + eps)
    xhat = (x - mu) * inv_std
    y = gamma * xhat + beta
    return y, (xhat, inv_std, gamma)


def ln_backward(dy: np.ndarray, cache):
    """Возвращает (dx, dgamma, dbeta).

    dgamma и dbeta аккумулируются по всем осям, кроме последней,
    поэтому их форма совпадает с формой gamma/beta (C,).
    """
    xhat, inv_std, gamma = cache
    reduce_axes = tuple(range(dy.ndim - 1))

    dgamma = (dy * xhat).sum(axis=reduce_axes)
    dbeta = dy.sum(axis=reduce_axes)

    dxhat = dy * gamma
    # Производная LN: dx = inv_std * (dxhat - mean(dxhat) - xhat*mean(dxhat*xhat))
    dx = inv_std * (
        dxhat
        - dxhat.mean(axis=-1, keepdims=True)
        - xhat * (dxhat * xhat).mean(axis=-1, keepdims=True)
    )
    return dx, dgamma, dbeta


# ---------------------------------------------------------------- Causal MHA
def attn_forward(x: np.ndarray,
                 Wq: np.ndarray, Wk: np.ndarray,
                 Wv: np.ndarray, Wo: np.ndarray,
                 n_head: int):
    """Causal multi-head self-attention.

    x: (B, T, C), C = n_head * head_dim.
    Возвращает (out, cache).
    """
    B, T, C = x.shape
    hd = C // n_head
    if C % n_head != 0:
        raise ValueError(f"C={C} не делится на n_head={n_head}")

    q = x @ Wq                       # (B, T, C)
    k = x @ Wk
    v = x @ Wv

    # (B, T, C) -> (B, n_head, T, hd)
    def split_heads(t):
        return t.reshape(B, T, n_head, hd).transpose(0, 2, 1, 3)

    qh, kh, vh = split_heads(q), split_heads(k), split_heads(v)

    scores = qh @ kh.transpose(0, 1, 3, 2) / np.sqrt(hd)   # (B, nh, T, T)
    mask = np.triu(np.ones((T, T), dtype=bool), k=1)       # True = запрещено
    scores = np.where(mask[None, None, :, :], -1e9, scores)

    probs = softmax(scores)                                # (B, nh, T, T)
    attn = probs @ vh                                      # (B, nh, T, hd)

    # (B, nh, T, hd) -> (B, T, C)
    am = attn.transpose(0, 2, 1, 3).reshape(B, T, C)
    out = am @ Wo                                          # (B, T, C)

    cache = (x, qh, kh, vh, probs, am, Wq, Wk, Wv, Wo, n_head, hd)
    return out, cache


def attn_backward(dout: np.ndarray, cache):
    """Возвращает (dx, dWq, dWk, dWv, dWo)."""
    x, qh, kh, vh, probs, am, Wq, Wk, Wv, Wo, n_head, hd = cache
    B, T, C = x.shape

    # 1) out = am @ Wo
    dWo = am.reshape(-1, C).T @ dout.reshape(-1, C)
    dam = dout @ Wo.T                                    # (B, T, C)

    # 2) обратно к (B, nh, T, hd)
    dattn = dam.reshape(B, T, n_head, hd).transpose(0, 2, 1, 3)

    # 3) attn = probs @ vh
    dprobs = dattn @ vh.transpose(0, 1, 3, 2)            # (B, nh, T, T)
    dvh = probs.transpose(0, 1, 3, 2) @ dattn            # (B, nh, T, hd)

    # 4) softmax backward (по последней оси): ds = s * (dp - sum(dp*s))
    dscores = probs * (dprobs - (dprobs * probs).sum(axis=-1, keepdims=True))
    dscores = dscores / np.sqrt(hd)

    # 5) scores = qh @ kh^T
    dqh = dscores @ kh                                   # (B, nh, T, hd)
    dkh = dscores.transpose(0, 1, 3, 2) @ qh             # (B, nh, T, hd)

    # 6) обратно (B, nh, T, hd) -> (B, T, C)
    dq = dqh.transpose(0, 2, 1, 3).reshape(B, T, C)
    dk = dkh.transpose(0, 2, 1, 3).reshape(B, T, C)
    dv = dvh.transpose(0, 2, 1, 3).reshape(B, T, C)

    # 7) q = x @ Wq, k = x @ Wk, v = x @ Wv
    x2 = x.reshape(-1, C)
    dWq = x2.T @ dq.reshape(-1, C)
    dWk = x2.T @ dk.reshape(-1, C)
    dWv = x2.T @ dv.reshape(-1, C)
    dx = dq @ Wq.T + dk @ Wk.T + dv @ Wv.T

    return dx, dWq, dWk, dWv, dWo


# ---------------------------------------------------------------- MLP
def mlp_forward(x: np.ndarray,
                W1: np.ndarray, b1: np.ndarray,
                W2: np.ndarray, b2: np.ndarray):
    """Двухслойный MLP: GELU(x @ W1 + b1) @ W2 + b2. Возвращает (out, cache)."""
    h = x @ W1 + b1
    a = gelu(h)
    out = a @ W2 + b2
    return out, (x, h, a, W1, W2)


def mlp_backward(dout: np.ndarray, cache):
    """Возвращает (dx, dW1, db1, dW2, db2)."""
    x, h, a, W1, W2 = cache
    B, T, C = x.shape
    H = W1.shape[1]

    # out = a @ W2 + b2
    dW2 = a.reshape(-1, H).T @ dout.reshape(-1, C)
    db2 = dout.sum(axis=(0, 1))
    da = dout @ W2.T                                     # (B, T, H)

    # a = gelu(h)
    dh = da * gelu_grad(h)

    # h = x @ W1 + b1
    dW1 = x.reshape(-1, C).T @ dh.reshape(-1, H)
    db1 = dh.sum(axis=(0, 1))
    dx = dh @ W1.T

    return dx, dW1, db1, dW2, db2

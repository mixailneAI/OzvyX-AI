"""OzvyX-small: decoder-only transformer с ручным backprop.

Собирается из примитивов `model.layers` и `model.losses`. Класс OzvyxSmall
хранит все параметры в одном dict[str, np.ndarray], что позволяет сохранять
чекпоинт одним np.savez и загружать его без реестра слоёв.

Соглашение об именах параметров:
    wte            (V, block)          token embedding
    wpe            (block_size, C)     positional embedding
    ln1_g_{i}      (C,)                LayerNorm 1 gamma, слой i
    ln1_b_{i}      (C,)                LayerNorm 1 beta
    wq_{i}         (C, C)              query projection
    wk_{i}         (C, C)              key projection
    wv_{i}         (C, C)              value projection
    wo_{i}         (C, C)              output projection
    ln2_g_{i}      (C,)                LayerNorm 2 gamma
    ln2_b_{i}      (C,)                LayerNorm 2 beta
    w1_{i}         (C, 4C)             MLP расширение
    b1_{i}         (4C,)
    w2_{i}         (4C, C)             MLP сжатие
    b2_{i}         (C,)
    lnf_g          (C,)                финальный LayerNorm gamma
    lnf_b          (C,)                финальный LayerNorm beta
    head           (C, V)              проекция на словарь
"""

import os
import numpy as np

from model.layers import (
    ln_forward, ln_backward,
    attn_forward, attn_backward,
    mlp_forward, mlp_backward,
)
from model.losses import cross_entropy


class OzvyxSmall:
    """Маленький decoder-only трансформер на NumPy."""

    def __init__(self, vocab_size: int, block_size: int,
                 n_layer: int, n_head: int, n_embd: int,
                 seed: int = 0):
        self.vocab_size = vocab_size
        self.block_size = block_size
        self.n_layer = n_layer
        self.n_head = n_head
        self.n_embd = n_embd
        self.rng = np.random.default_rng(seed)
        self.params = self._init_params()

    # ---------------------------------------------------------- init
    def _init_params(self) -> dict:
        V = self.vocab_size
        T = self.block_size
        C = self.n_embd
        L = self.n_layer
        s = 0.02
        p = {
            "wte": self.rng.normal(0, s, size=(V, C)),
            "wpe": self.rng.normal(0, s, size=(T, C)),
        }
        for i in range(L):
            p[f"ln1_g_{i}"] = np.ones(C)
            p[f"ln1_b_{i}"] = np.zeros(C)
            p[f"wq_{i}"]  = self.rng.normal(0, s, size=(C, C))
            p[f"wk_{i}"]  = self.rng.normal(0, s, size=(C, C))
            p[f"wv_{i}"]  = self.rng.normal(0, s, size=(C, C))
            p[f"wo_{i}"]  = self.rng.normal(0, s, size=(C, C))
            p[f"ln2_g_{i}"] = np.ones(C)
            p[f"ln2_b_{i}"] = np.zeros(C)
            p[f"w1_{i}"] = self.rng.normal(0, s, size=(C, 4 * C))
            p[f"b1_{i}"] = np.zeros(4 * C)
            p[f"w2_{i}"] = self.rng.normal(0, s, size=(4 * C, C))
            p[f"b2_{i}"] = np.zeros(C)
        p["lnf_g"] = np.ones(C)
        p["lnf_b"] = np.zeros(C)
        p["head"]  = self.rng.normal(0, s, size=(C, V))
        return p

    # ---------------------------------------------------------- forward
    def forward(self, idx: np.ndarray, targets: np.ndarray = None):
        """Возвращает (logits, loss, cache). Если targets is None, loss=None."""
        P = self.params
        B, T = idx.shape
        if T > self.block_size:
            raise ValueError(f"T={T} > block_size={self.block_size}")

        x = P["wte"][idx] + P["wpe"][:T]     # (B, T, C)

        block_caches = []
        for i in range(self.n_layer):
            x_ln1, c_ln1 = ln_forward(x, P[f"ln1_g_{i}"], P[f"ln1_b_{i}"])
            a, c_attn = attn_forward(
                x_ln1,
                P[f"wq_{i}"], P[f"wk_{i}"], P[f"wv_{i}"], P[f"wo_{i}"],
                self.n_head,
            )
            x = x + a
            x_ln2, c_ln2 = ln_forward(x, P[f"ln2_g_{i}"], P[f"ln2_b_{i}"])
            m, c_mlp = mlp_forward(
                x_ln2,
                P[f"w1_{i}"], P[f"b1_{i}"], P[f"w2_{i}"], P[f"b2_{i}"],
            )
            x = x + m
            block_caches.append({
                "ln1": c_ln1, "attn": c_attn,
                "ln2": c_ln2, "mlp": c_mlp,
            })

        x_f, c_lnf = ln_forward(x, P["lnf_g"], P["lnf_b"])
        logits = x_f @ P["head"]              # (B, T, V)

        loss, dlogits = None, None
        if targets is not None:
            loss, dlogits = cross_entropy(logits, targets)

        cache = {
            "idx": idx,
            "B": B, "T": T,
            "x_f": x_f,
            "c_lnf": c_lnf,
            "blocks": block_caches,
            "dlogits": dlogits,
        }
        return logits, loss, cache

    # ---------------------------------------------------------- backward
    def backward(self, cache: dict) -> dict:
        """Возвращает dict с градиентами для каждого параметра."""
        P = self.params
        C = self.n_embd
        grads = {}

        # head + финальный LN
        dlogits = cache["dlogits"]
        if dlogits is None:
            raise RuntimeError("backward требует forward с targets")
        x_f = cache["x_f"]
        grads["head"] = x_f.reshape(-1, C).T @ dlogits.reshape(-1, self.vocab_size)
        dx = dlogits @ P["head"].T
        dx, dg, db = ln_backward(dx, cache["c_lnf"])
        grads["lnf_g"] = dg
        grads["lnf_b"] = db

        # блоки в обратном порядке
        for i in reversed(range(self.n_layer)):
            bc = cache["blocks"][i]

            # residual 2 (MLP)
            dx_res = dx
            dmlp_in, dW1, db1, dW2, db2 = mlp_backward(dx, bc["mlp"])
            grads[f"w1_{i}"] = dW1
            grads[f"b1_{i}"] = db1
            grads[f"w2_{i}"] = dW2
            grads[f"b2_{i}"] = db2
            dx_ln2, dg, db = ln_backward(dmlp_in, bc["ln2"])
            grads[f"ln2_g_{i}"] = dg
            grads[f"ln2_b_{i}"] = db
            dx = dx_res + dx_ln2

            # residual 1 (attention)
            dx_res = dx
            dattn_in, dWq, dWk, dWv, dWo = attn_backward(dx, bc["attn"])
            grads[f"wq_{i}"] = dWq
            grads[f"wk_{i}"] = dWk
            grads[f"wv_{i}"] = dWv
            grads[f"wo_{i}"] = dWo
            dx_ln1, dg, db = ln_backward(dattn_in, bc["ln1"])
            grads[f"ln1_g_{i}"] = dg
            grads[f"ln1_b_{i}"] = db
            dx = dx_res + dx_ln1

        # embeddings
        idx = cache["idx"]
        T = cache["T"]
        grads["wte"] = np.zeros_like(P["wte"])
        np.add.at(grads["wte"], idx.reshape(-1), dx.reshape(-1, C))
        grads["wpe"] = np.zeros_like(P["wpe"])
        grads["wpe"][:T] = dx.sum(axis=0)
        return grads

    # ---------------------------------------------------------- io
    def save(self, path: str) -> None:
        d = os.path.dirname(path)
        if d:
            os.makedirs(d, exist_ok=True)
        cfg = np.array([self.n_layer, self.n_head, self.n_embd,
                        self.block_size, self.vocab_size], dtype=np.int64)
        np.savez(path, _cfg=cfg, **self.params)

    @classmethod
    def load(cls, path: str) -> "OzvyxSmall":
        d = np.load(path)
        c = d["_cfg"]
        m = cls(
            vocab_size=int(c[4]),
            block_size=int(c[3]),
            n_layer=int(c[0]),
            n_head=int(c[1]),
            n_embd=int(c[2]),
        )
        for k in m.params:
            m.params[k] = d[k].copy()
        return m


class Adam:
    """Adam для dict[str, np.ndarray]-параметров."""

    def __init__(self, params: dict, lr: float = 3e-3,
                 betas: tuple = (0.9, 0.999), eps: float = 1e-8):
        self.params = params
        self.lr = lr
        self.b1, self.b2 = betas
        self.eps = eps
        self.m = {k: np.zeros_like(v) for k, v in params.items()}
        self.v = {k: np.zeros_like(v) for k, v in params.items()}
        self.t = 0

    def step(self, grads: dict) -> None:
        self.t += 1
        for k in self.params:
            g = grads[k]
            self.m[k] = self.b1 * self.m[k] + (1 - self.b1) * g
            self.v[k] = self.b2 * self.v[k] + (1 - self.b2) * g * g
            mh = self.m[k] / (1 - self.b1 ** self.t)
            vh = self.v[k] / (1 - self.b2 ** self.t)
            self.params[k] -= self.lr * mh / (np.sqrt(vh) + self.eps)

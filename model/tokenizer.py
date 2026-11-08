"""Char-level токенизатор для OzvyX-small.

v0.1 использует посимвольное кодирование: каждый уникальный символ корпуса —
отдельный токен. Это минимально возможный токенизатор, зато нулевые зависимости
и полная прозрачность. BPE появится в v0.2 отдельным модулем, а интерфейс
(encode/decode/save/load) останется тем же.

Незнакомые символы (которых не было в корпусе) кодируются в id=0 — это
символ `unk`. При обучении на достаточном корпусе `unk` встречается редко.
"""

import json
import os
from typing import List

import numpy as np


class CharTokenizer:
    """Символьный токенизатор с фиксированным словарём."""

    UNK = "\x00"  # служебный символ для незнакомых

    def __init__(self, text: str = None, chars: List[str] = None):
        if chars is None:
            if text is None:
                raise ValueError("Нужен либо text, либо chars")
            chars = sorted(set(text) | {self.UNK})
        else:
            if self.UNK not in chars:
                chars = [self.UNK] + list(chars)
        self.chars = list(chars)
        self.stoi = {c: i for i, c in enumerate(self.chars)}
        self.itos = {i: c for i, c in enumerate(self.chars)}
        self.vocab_size = len(self.chars)
        self.unk_id = self.stoi[self.UNK]

    def encode(self, s: str) -> np.ndarray:
        """Строка -> np.ndarray[int32]. Незнакомые символы -> unk_id (0)."""
        return np.array(
            [self.stoi.get(c, self.unk_id) for c in s],
            dtype=np.int32,
        )

    def decode(self, ids) -> str:
        """np.ndarray[int] (или list) -> строка."""
        return "".join(self.itos.get(int(i), self.UNK) for i in ids)

    def save(self, path: str) -> None:
        d = os.path.dirname(path)
        if d:
            os.makedirs(d, exist_ok=True)
        with open(path, "w", encoding="utf-8") as f:
            json.dump({"chars": self.chars}, f, ensure_ascii=False)

    @classmethod
    def load(cls, path: str) -> "CharTokenizer":
        with open(path, encoding="utf-8") as f:
            d = json.load(f)
        return cls(chars=d["chars"])

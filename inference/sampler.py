"""Авторегрессивная генерация для OzvyX-small.

Основная функция — `generate(model, tokenizer, prompt, ...)`:
1. Кодирует prompt в токены.
2. Цикл: обрезает контекст до block_size, делает forward, берёт логиты
   последней позиции, делит на temperature, применяет top-k, сэмплирует
   следующий токен, добавляет к последовательности.
3. По завершении декодирует все токены и возвращает строку.

Обрезка контекста: модель видит только последние `block_size` токенов.
Это позволяет генерировать текст длиннее контекста без изменения модели.

Пустой prompt: модель не может работать без хотя бы одного токена контекста,
поэтому внутрь подставляется UNK как стартер. В возвращаемой строке этот
искусственный стартовый токен отбрасывается — результат для пустого prompt
содержит ровно `max_new_tokens` сгенерированных символов.
"""

import numpy as np

from model.layers import softmax


def _sample_next(logits_row: np.ndarray,
                 temperature: float,
                 top_k: int,
                 rng: np.random.Generator) -> int:
    """Выбирает один токен из 1-D массива логитов."""
    x = logits_row.astype(np.float64, copy=True)

    # temperature: чем меньше, тем «острее»; 0 = greedy
    if temperature <= 0:
        return int(x.argmax())

    x = x / temperature

    # top-k: оставляем только k наибольших значений
    if top_k is not None and top_k > 0 and top_k < x.shape[0]:
        kth = np.partition(x, -top_k)[-top_k]
        x = np.where(x < kth, -np.inf, x)

    probs = softmax(x)
    return int(rng.choice(probs.shape[0], p=probs))


def generate(model,
             tokenizer,
             prompt: str,
             max_new_tokens: int = 100,
             temperature: float = 0.8,
             top_k: int = 40,
             seed: int = None) -> str:
    """Генерирует продолжение промпта.

    :param model:           OzvyxSmall.
    :param tokenizer:       CharTokenizer.
    :param prompt:          начальный текст (может быть пустым).
    :param max_new_tokens:  сколько токенов добавить.
    :param temperature:     0 = greedy, >0 = сэмплирование.
    :param top_k:           ограничение словаря (None или 0 = без ограничения).
    :param seed:            для воспроизводимости.
    :return: prompt + сгенерированная часть (для пустого prompt — только сгенерированное).
    """
    rng = np.random.default_rng(seed)

    # Кодируем prompt. Если он пуст, подставляем UNK как стартовый токен
    # и запоминаем, что этот токен — искусственный (его не включаем в вывод).
    if len(prompt) == 0:
        prompt_ids = np.array([tokenizer.unk_id], dtype=np.int32)
        injected = 1
    else:
        prompt_ids = tokenizer.encode(prompt)
        if prompt_ids.size == 0:
            prompt_ids = np.array([tokenizer.unk_id], dtype=np.int32)
            injected = 1
        else:
            injected = 0

    seq = prompt_ids[None, :]
    bs = model.block_size

    for _ in range(max_new_tokens):
        ctx = seq[:, -bs:]
        logits, _, _ = model.forward(ctx)
        next_logits = logits[0, -1, :]
        nxt = _sample_next(next_logits, temperature, top_k, rng)
        seq = np.concatenate(
            [seq, np.array([[nxt]], dtype=seq.dtype)], axis=1
        )

    # Для пустого prompt отбрасываем искусственный стартовый токен.
    return tokenizer.decode(seq[0, injected:])

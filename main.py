"""Точка входа OzvyX-small.

OzvyX-small — это base-модель, обученная на текстах Шекспира. Она умеет
продолжать текст в шекспировском стиле, но не умеет вести диалог (для этого
нужно instruction tuning). Поэтому мы используем формат, который она знает:
`ROMEO:\\n<текст пользователя>\\n` — модель продолжает как шекспировский персонаж.
"""

import os
import sys

from config.settings import SETTINGS
from model.transformer import OzvyxSmall
from model.tokenizer import CharTokenizer
from inference.sampler import generate


def _ensure_checkpoint() -> bool:
    missing = [p for p in (SETTINGS.checkpoint_path, SETTINGS.tokenizer_path)
               if not os.path.exists(p)]
    if not missing:
        return True
    print("Не найдены файлы модели:")
    for p in missing:
        print(f"  {p}")
    print("\nСначала обучите модель:")
    print("  python -m training.prepare_data")
    print("  python -m training.trainer")
    return False


def _format_answer(raw: str, prompt: str) -> str:
    """Отрезает prompt, останавливается на следующем персонаже, чистит UNK."""
    body = raw[len(prompt):] if raw.startswith(prompt) else raw
    # Модель может продолжить другим персонажем — режем там
    for marker in ("\nROMEO:", "\nJULIET:", "\nHAMLET:", "\nMACBETH:",
                   "\nKING ", "\nQUEEN ", "\nDUKE ", "\nFirst ", "\nSecond "):
        if marker in body:
            body = body.split(marker, 1)[0]
    return body.replace("\x00", "").strip()


def _chat_loop(model, tokenizer) -> None:
    print("Команды: /exit — выход\n")
    while True:
        try:
            user = input("Вы: ").strip()
        except (EOFError, KeyboardInterrupt):
            print()
            break
        if not user:
            continue
        if user.lower() in ("exit", "quit", "/exit", "/quit"):
            break

        # Формат, который знает модель: имя персонажа + реплика.
        prompt = f"ROMEO:\n{user}\n"

        try:
            raw = generate(
                model, tokenizer, prompt,
                max_new_tokens=200,
                temperature=0.85,
                top_k=40,
            )
        except KeyboardInterrupt:
            print("\n[генерация прервана]\n")
            continue

        answer = _format_answer(raw, prompt) or "(пусто)"
        print(f"OzvyX: {answer}\n")


def main() -> int:
    if not _ensure_checkpoint():
        return 1

    print(f"Загрузка модели: {SETTINGS.checkpoint_path}")
    model = OzvyxSmall.load(SETTINGS.checkpoint_path)
    tokenizer = CharTokenizer.load(SETTINGS.tokenizer_path)

    n_params = sum(p.size for p in model.params.values())
    print(f"OzvyX-small готов. Параметров: {n_params:,}\n")

    _chat_loop(model, tokenizer)
    print("До встречи.")
    return 0


if __name__ == "__main__":
    sys.exit(main())

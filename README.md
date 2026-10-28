# OzvyX-AI (v1.0)

Собственная языковая модель, написанная с нуля.
- 50 миллионов параметров.
- Архитектура: Decoder-only Transformer.
- Обучение: PyTorch (на GPU в Kaggle).
- Инференс: Собственный движок на чистом C (без фреймворков).

## Запуск
1. Убедитесь, что в папке `checkpoints/` лежат `model.bin`, `tokenizer.json` и `config.json`.
2. Скомпилируйте движок: `clang -O3 -o engine engine.c -lm`
3. Запустите чат: `python chat.py`

"""Подготовка обучающего корпуса.

Скачивает текст по `SETTINGS.data_url` в `SETTINGS.data_path`.
Идемпотентен: если файл уже существует и не пуст — не перекачивает.

Запуск:
    python -m training.prepare_data
"""

import os
import sys
import urllib.request

from config.settings import SETTINGS
from utils.logger import get_logger

logger = get_logger(__name__)


def _human_size(n: int) -> str:
    for unit in ("B", "KB", "MB", "GB"):
        if n < 1024:
            return f"{n:.1f} {unit}"
        n /= 1024.0
    return f"{n:.1f} TB"


def prepare(data_path: str = None, data_url: str = None,
            force: bool = False) -> str:
    """Скачивает корпус, если нужно. Возвращает путь к файлу.

    :param data_path: переопределить SETTINGS.data_path (для тестов).
    :param data_url:  переопределить SETTINGS.data_url.
    :param force:     перекачать, даже если файл уже есть.
    """
    data_path = data_path or SETTINGS.data_path
    data_url = data_url or SETTINGS.data_url

    os.makedirs(os.path.dirname(data_path) or ".", exist_ok=True)

    if not force and os.path.exists(data_path) and os.path.getsize(data_path) > 0:
        size = os.path.getsize(data_path)
        logger.info(f"Корпус уже есть: {data_path} ({_human_size(size)})")
        return data_path

    logger.info(f"Скачивание: {data_url}")
    try:
        urllib.request.urlretrieve(data_url, data_path)
    except Exception as e:
        # чистим недокачанный файл, чтобы повторный запуск не «залип»
        if os.path.exists(data_path):
            os.remove(data_path)
        logger.error(f"Не удалось скачать корпус: {e}")
        raise

    size = os.path.getsize(data_path)
    if size == 0:
        os.remove(data_path)
        raise RuntimeError(f"Скачался пустой файл: {data_url}")

    logger.info(f"Сохранено: {data_path} ({_human_size(size)})")
    return data_path


if __name__ == "__main__":
    try:
        path = prepare()
    except Exception:
        sys.exit(1)
    print(f"OK: {path}")

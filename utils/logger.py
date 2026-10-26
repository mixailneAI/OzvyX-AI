"""Единый логгер проекта.

Использование в любом модуле:

    from utils.logger import get_logger
    logger = get_logger(__name__)
    logger.info("...")

get_logger идемпотентен: повторный вызов для того же имени не добавляет
второй handler (иначе сообщения дублировались бы).
"""

import logging

_FORMAT = "%(asctime)s [%(levelname)s] %(name)s: %(message)s"
_DATEFMT = "%H:%M:%S"
_LEVEL = logging.INFO


def get_logger(name: str) -> logging.Logger:
    """Возвращает настроенный logger с единственным StreamHandler.

    :param name: обычно __name__ вызывающего модуля.
    """
    logger = logging.getLogger(name)

    if not logger.handlers:
        handler = logging.StreamHandler()
        handler.setFormatter(logging.Formatter(fmt=_FORMAT, datefmt=_DATEFMT))
        logger.addHandler(handler)
        logger.setLevel(_LEVEL)
        # Не передаём записи в root logger, чтобы не было двойного вывода.
        logger.propagate = False

    return logger

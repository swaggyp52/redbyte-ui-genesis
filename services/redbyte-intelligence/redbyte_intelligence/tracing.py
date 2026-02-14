from __future__ import annotations

import logging
import uuid
from contextlib import contextmanager


def configure_logging(level: str) -> None:
    logging.basicConfig(
        level=getattr(logging, level.upper(), logging.INFO),
        format="%(asctime)s %(levelname)s %(name)s :: %(message)s",
    )


@contextmanager
def trace_scope(name: str, enabled: bool = True):
    trace_id = str(uuid.uuid4())
    logger = logging.getLogger("redbyte.intelligence")
    if enabled:
        logger.info("trace.start name=%s trace_id=%s", name, trace_id)
    try:
        yield trace_id
    finally:
        if enabled:
            logger.info("trace.end name=%s trace_id=%s", name, trace_id)

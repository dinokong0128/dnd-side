"""Custom middleware setup for the FastAPI application."""

import logging
from fastapi import FastAPI


def add_middleware(app: FastAPI) -> None:
    """Configure application-level middleware and logging."""
    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s %(levelname)s %(name)s: %(message)s",
    )

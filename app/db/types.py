"""Custom SQLAlchemy types for database compatibility.

This module provides types that work with both PostgreSQL and SQLite,
enabling tests to run with SQLite in-memory while production uses PostgreSQL.
"""

from typing import Any

from sqlalchemy import JSON
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.types import TypeDecorator


class JSONBCompatible(TypeDecorator[Any]):
    """A JSON type that uses JSONB on PostgreSQL and JSON on SQLite.

    This allows tests to run with SQLite in-memory database while
    production uses PostgreSQL with proper JSONB support.
    """

    impl = JSON
    cache_ok = True

    def load_dialect_impl(self, dialect):
        if dialect.name == "postgresql":
            return dialect.type_descriptor(JSONB())
        return dialect.type_descriptor(JSON())

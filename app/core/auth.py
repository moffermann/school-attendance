"""Authentication helpers and user context stubs."""

from __future__ import annotations

from dataclasses import dataclass


@dataclass
class AuthUser:
    id: int
    role: str
    full_name: str
    guardian_id: int | None = None
    teacher_id: int | None = None


# NOTE: El MVP usará una tabla de usuarios completa; por ahora dejamos un stub
# que se integra con los repositorios una vez modelados.

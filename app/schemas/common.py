"""Common Pydantic utilities."""

from datetime import datetime

from pydantic import BaseModel


class ORMBase(BaseModel):
    class Config:
        from_attributes = True


class Timestamped(ORMBase):
    created_at: datetime | None = None
    updated_at: datetime | None = None

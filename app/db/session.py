"""Database session and engine configuration."""

from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from app.core.config import settings


# TDD-R3-BUG3 fix: Add connection pool configuration for production stability
engine = create_async_engine(
    settings.database_url,
    echo=False,
    future=True,
    pool_size=20,          # Default connections in pool
    max_overflow=10,       # Extra connections when pool exhausted
    pool_pre_ping=True,    # Verify connection before use (detect stale)
    pool_recycle=3600,     # Recycle connections after 1 hour
)

async_session = async_sessionmaker(engine, expire_on_commit=False, class_=AsyncSession)


async def get_session() -> AsyncSession:
    async with async_session() as session:
        yield session

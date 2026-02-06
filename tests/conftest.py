"""Pytest configuration and fixtures for tests."""

from __future__ import annotations

import asyncio
import os
from collections.abc import AsyncGenerator
from datetime import datetime, time

import pytest
from sqlalchemy import event
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

# Skip tenant middleware in tests (uses SQLite, not PostgreSQL)
os.environ.setdefault("SKIP_TENANT_MIDDLEWARE", "true")

from app.db.base import Base
from app.db.models.course import Course
from app.db.models.device import Device
from app.db.models.guardian import Guardian
from app.db.models.schedule import Schedule
from app.db.models.student import Student

# Use SQLite in-memory for tests
TEST_DATABASE_URL = "sqlite+aiosqlite:///:memory:"


def get_sqlite_compatible_tables():
    """Get tables that are compatible with SQLite (no schema prefix).

    Multi-tenant tables use schema='public' which SQLite doesn't support.
    This function filters out those tables for SQLite testing.
    """
    compatible_tables = []
    for table in Base.metadata.sorted_tables:
        # Skip tables with explicit schema (PostgreSQL multi-tenant tables)
        if table.schema is None:
            compatible_tables.append(table)
    return compatible_tables


@pytest.fixture(scope="function")
def event_loop():
    """Create an event loop for each test function."""
    loop = asyncio.new_event_loop()
    yield loop
    loop.close()


@pytest.fixture
async def async_engine():
    """Create an async engine with SQLite in-memory database."""
    engine = create_async_engine(
        TEST_DATABASE_URL,
        echo=False,
        future=True,
    )

    # Enable foreign keys for SQLite
    @event.listens_for(engine.sync_engine, "connect")
    def set_sqlite_pragma(dbapi_connection, connection_record):
        cursor = dbapi_connection.cursor()
        cursor.execute("PRAGMA foreign_keys=ON")
        cursor.close()

    # Only create tables without schema (SQLite compatible)
    sqlite_tables = get_sqlite_compatible_tables()

    async with engine.begin() as conn:
        for table in sqlite_tables:
            await conn.run_sync(table.create, checkfirst=True)

    yield engine

    async with engine.begin() as conn:
        for table in reversed(sqlite_tables):
            await conn.run_sync(table.drop, checkfirst=True)

    await engine.dispose()


@pytest.fixture
async def db_session(async_engine) -> AsyncGenerator[AsyncSession, None]:
    """Create a test database session."""
    async_session_maker = async_sessionmaker(
        async_engine,
        expire_on_commit=False,
        class_=AsyncSession,
    )

    async with async_session_maker() as session:
        yield session
        await session.rollback()


@pytest.fixture
async def sample_course(db_session: AsyncSession) -> Course:
    """Create a sample course for testing."""
    course = Course(
        name="1° Básico A",
        grade="1° Básico",
    )
    db_session.add(course)
    await db_session.flush()
    return course


@pytest.fixture
async def sample_guardian(db_session: AsyncSession) -> Guardian:
    """Create a sample guardian for testing."""
    guardian = Guardian(
        full_name="María González",
        contacts={"email": "maria@example.com", "whatsapp": "+56912345678"},
        notification_prefs={},
    )
    db_session.add(guardian)
    await db_session.flush()
    return guardian


@pytest.fixture
async def sample_student(
    db_session: AsyncSession, sample_course: Course, sample_guardian: Guardian
) -> Student:
    """Create a sample student for testing."""
    student = Student(
        full_name="Pedro González",
        course_id=sample_course.id,
    )
    db_session.add(student)
    await db_session.flush()

    # Associate guardian with student using the association table directly
    from app.db.models.associations import student_guardian_table

    await db_session.execute(
        student_guardian_table.insert().values(
            student_id=student.id,
            guardian_id=sample_guardian.id,
        )
    )
    await db_session.flush()

    # Refresh to load the relationship
    await db_session.refresh(student, attribute_names=["guardians"])

    return student


@pytest.fixture
async def sample_schedule(db_session: AsyncSession, sample_course: Course) -> Schedule:
    """Create a sample schedule for testing."""
    schedule = Schedule(
        course_id=sample_course.id,
        weekday=0,  # Monday
        in_time=time(8, 0),
        out_time=time(13, 30),
    )
    db_session.add(schedule)
    await db_session.flush()
    return schedule


@pytest.fixture
async def sample_device(db_session: AsyncSession) -> Device:
    """Create a sample device for testing."""
    device = Device(
        device_id="DEV-TEST-001",
        gate_id="GATE-A",
        firmware_version="1.0.0",
        battery_pct=100,
        pending_events=0,
        online=True,
        last_sync=datetime.utcnow(),
    )
    db_session.add(device)
    await db_session.flush()
    return device

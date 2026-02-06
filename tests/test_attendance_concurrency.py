"""Tests for concurrent attendance event registration.

Validates that sequence validation prevents state corruption
and notification deduplication works correctly.
"""

from __future__ import annotations

from datetime import UTC, date, datetime
from types import SimpleNamespace
from unittest.mock import AsyncMock, MagicMock

import pytest

from app.schemas.attendance import AttendanceEventCreate, AttendanceType
from app.services.attendance_service import AttendanceService


def today_at(hour: int, minute: int = 0) -> datetime:
    """Helper to create a datetime for today at specified time."""
    now = datetime.now(UTC)
    return now.replace(hour=hour, minute=minute, second=0, microsecond=0)


class TestSequenceValidation:
    """Tests for IN/OUT sequence validation logic."""

    @pytest.mark.anyio("asyncio")
    async def test_first_event_of_day_must_be_in(self, monkeypatch) -> None:
        """First event of the day is always IN, even if OUT requested."""
        monkeypatch.setattr("app.core.config.settings.enable_sequence_validation", True)

        session = MagicMock()
        session.commit = AsyncMock()

        service = AttendanceService(session)
        service.student_repo.get = AsyncMock(
            return_value=SimpleNamespace(id=1, full_name="Test Student")
        )

        # No previous events
        service.attendance_repo.get_event_before_timestamp = AsyncMock(return_value=None)

        created_events = []

        async def capture_event(**kwargs):
            event = SimpleNamespace(
                id=len(created_events) + 1,
                student_id=kwargs["student_id"],
                type=kwargs["event_type"],
                gate_id=kwargs["gate_id"],
                device_id=kwargs["device_id"],
                occurred_at=kwargs["occurred_at"],
                photo_ref=kwargs.get("photo_ref"),
                local_seq=kwargs.get("local_seq"),
                source=kwargs.get("source"),
                conflict_corrected=kwargs.get("conflict_corrected", False),
            )
            created_events.append(event)
            return event

        service.attendance_repo.create_event = AsyncMock(side_effect=capture_event)
        service.correction_repo = MagicMock()
        service.correction_repo.create = AsyncMock()

        # Request OUT as first event of day
        payload = AttendanceEventCreate(
            student_id=1,
            device_id="tablet-a",
            gate_id="main",
            type=AttendanceType.OUT,  # Wrong - should be IN
            occurred_at=today_at(8, 0),
        )

        result = await service.register_event(payload)

        # Should be corrected to IN
        assert result.type == "IN"
        assert created_events[0].conflict_corrected is True
        service.correction_repo.create.assert_awaited_once()

    @pytest.mark.anyio("asyncio")
    async def test_in_after_in_becomes_out(self, monkeypatch) -> None:
        """Two consecutive IN requests result in IN + OUT."""
        monkeypatch.setattr("app.core.config.settings.enable_sequence_validation", True)

        session = MagicMock()
        session.commit = AsyncMock()

        service = AttendanceService(session)
        service.student_repo.get = AsyncMock(
            return_value=SimpleNamespace(id=1, full_name="Test Student")
        )

        # Previous event was IN
        previous_in_event = SimpleNamespace(
            id=1,
            type="IN",
            occurred_at=today_at(8, 0),
        )
        service.attendance_repo.get_event_before_timestamp = AsyncMock(
            return_value=previous_in_event
        )

        created_events = []

        async def capture_event(**kwargs):
            event = SimpleNamespace(
                id=len(created_events) + 2,
                student_id=kwargs["student_id"],
                type=kwargs["event_type"],
                gate_id=kwargs["gate_id"],
                device_id=kwargs["device_id"],
                occurred_at=kwargs["occurred_at"],
                photo_ref=kwargs.get("photo_ref"),
                local_seq=kwargs.get("local_seq"),
                source=kwargs.get("source"),
                conflict_corrected=kwargs.get("conflict_corrected", False),
            )
            created_events.append(event)
            return event

        service.attendance_repo.create_event = AsyncMock(side_effect=capture_event)
        service.correction_repo = MagicMock()
        service.correction_repo.create = AsyncMock()

        # Request IN when previous was IN
        payload = AttendanceEventCreate(
            student_id=1,
            device_id="tablet-b",
            gate_id="main",
            type=AttendanceType.IN,  # Wrong - should be OUT
            occurred_at=today_at(10, 0),
        )

        result = await service.register_event(payload)

        # Should be corrected to OUT
        assert result.type == "OUT"
        assert created_events[0].conflict_corrected is True

    @pytest.mark.anyio("asyncio")
    async def test_out_after_out_becomes_in(self, monkeypatch) -> None:
        """Two consecutive OUT requests result in OUT + IN."""
        monkeypatch.setattr("app.core.config.settings.enable_sequence_validation", True)

        session = MagicMock()
        session.commit = AsyncMock()

        service = AttendanceService(session)
        service.student_repo.get = AsyncMock(
            return_value=SimpleNamespace(id=1, full_name="Test Student")
        )

        # Previous event was OUT
        previous_out_event = SimpleNamespace(
            id=1,
            type="OUT",
            occurred_at=today_at(8, 0),
        )
        service.attendance_repo.get_event_before_timestamp = AsyncMock(
            return_value=previous_out_event
        )

        created_events = []

        async def capture_event(**kwargs):
            event = SimpleNamespace(
                id=len(created_events) + 2,
                student_id=kwargs["student_id"],
                type=kwargs["event_type"],
                gate_id=kwargs["gate_id"],
                device_id=kwargs["device_id"],
                occurred_at=kwargs["occurred_at"],
                photo_ref=kwargs.get("photo_ref"),
                local_seq=kwargs.get("local_seq"),
                source=kwargs.get("source"),
                conflict_corrected=kwargs.get("conflict_corrected", False),
            )
            created_events.append(event)
            return event

        service.attendance_repo.create_event = AsyncMock(side_effect=capture_event)
        service.correction_repo = MagicMock()
        service.correction_repo.create = AsyncMock()

        # Request OUT when previous was OUT
        payload = AttendanceEventCreate(
            student_id=1,
            device_id="tablet-b",
            gate_id="main",
            type=AttendanceType.OUT,  # Wrong - should be IN
            occurred_at=today_at(10, 0),
        )

        result = await service.register_event(payload)

        # Should be corrected to IN
        assert result.type == "IN"
        assert created_events[0].conflict_corrected is True

    @pytest.mark.anyio("asyncio")
    async def test_valid_sequence_not_corrected(self, monkeypatch) -> None:
        """Valid IN→OUT sequence is not corrected."""
        monkeypatch.setattr("app.core.config.settings.enable_sequence_validation", True)

        session = MagicMock()
        session.commit = AsyncMock()

        service = AttendanceService(session)
        service.student_repo.get = AsyncMock(
            return_value=SimpleNamespace(id=1, full_name="Test Student")
        )

        # Previous event was IN
        previous_in_event = SimpleNamespace(
            id=1,
            type="IN",
            occurred_at=today_at(8, 0),
        )
        service.attendance_repo.get_event_before_timestamp = AsyncMock(
            return_value=previous_in_event
        )

        created_events = []

        async def capture_event(**kwargs):
            event = SimpleNamespace(
                id=len(created_events) + 2,
                student_id=kwargs["student_id"],
                type=kwargs["event_type"],
                gate_id=kwargs["gate_id"],
                device_id=kwargs["device_id"],
                occurred_at=kwargs["occurred_at"],
                photo_ref=kwargs.get("photo_ref"),
                local_seq=kwargs.get("local_seq"),
                source=kwargs.get("source"),
                conflict_corrected=kwargs.get("conflict_corrected", False),
            )
            created_events.append(event)
            return event

        service.attendance_repo.create_event = AsyncMock(side_effect=capture_event)
        service.correction_repo = MagicMock()
        service.correction_repo.create = AsyncMock()

        # Request OUT after IN (correct sequence)
        payload = AttendanceEventCreate(
            student_id=1,
            device_id="tablet-b",
            gate_id="main",
            type=AttendanceType.OUT,  # Correct
            occurred_at=today_at(10, 0),
        )

        result = await service.register_event(payload)

        # Should NOT be corrected
        assert result.type == "OUT"
        assert created_events[0].conflict_corrected is False
        service.correction_repo.create.assert_not_awaited()

    @pytest.mark.anyio("asyncio")
    async def test_feature_flag_disabled_skips_validation(self, monkeypatch) -> None:
        """When feature flag is disabled, no validation occurs."""
        monkeypatch.setattr("app.core.config.settings.enable_sequence_validation", False)

        session = MagicMock()
        session.commit = AsyncMock()

        service = AttendanceService(session)
        service.student_repo.get = AsyncMock(
            return_value=SimpleNamespace(id=1, full_name="Test Student")
        )

        # This should not be called when flag is disabled
        service.attendance_repo.get_event_before_timestamp = AsyncMock()

        async def capture_event(**kwargs):
            return SimpleNamespace(
                id=1,
                student_id=kwargs["student_id"],
                type=kwargs["event_type"],
                gate_id=kwargs["gate_id"],
                device_id=kwargs["device_id"],
                occurred_at=kwargs["occurred_at"],
                photo_ref=kwargs.get("photo_ref"),
                local_seq=kwargs.get("local_seq"),
                source=kwargs.get("source"),
                conflict_corrected=kwargs.get("conflict_corrected", False),
            )

        service.attendance_repo.create_event = AsyncMock(side_effect=capture_event)

        # Request OUT as first event (should NOT be corrected)
        payload = AttendanceEventCreate(
            student_id=1,
            device_id="tablet-a",
            gate_id="main",
            type=AttendanceType.OUT,
            occurred_at=today_at(8, 0),
        )

        result = await service.register_event(payload)

        # Should NOT be corrected (flag disabled)
        assert result.type == "OUT"
        service.attendance_repo.get_event_before_timestamp.assert_not_awaited()


class TestOutOfOrderSync:
    """Tests for out-of-order synchronization scenarios."""

    @pytest.mark.anyio("asyncio")
    async def test_offline_event_synced_later_uses_timestamp_context(self, monkeypatch) -> None:
        """Event synced later is validated against events BEFORE its timestamp.

        Scenario:
        - Event at 10:00 (online) created first → IN (no previous)
        - Event at 10:30 (offline, syncs later) → should be OUT (previous was IN)

        The second event, though processed later, is validated against what
        existed chronologically before 10:30 (the 10:00 IN).
        """
        monkeypatch.setattr("app.core.config.settings.enable_sequence_validation", True)

        session = MagicMock()
        session.commit = AsyncMock()

        service = AttendanceService(session)
        service.student_repo.get = AsyncMock(
            return_value=SimpleNamespace(id=1, full_name="Test Student")
        )

        # Simulate: event at 10:00 already exists
        existing_event = SimpleNamespace(
            id=1,
            type="IN",
            occurred_at=today_at(10, 0),
        )

        # When checking for events before 10:30, return the 10:00 event
        async def mock_get_before(student_id, before_timestamp, target_date, for_update):
            if before_timestamp.hour == 10 and before_timestamp.minute == 30:
                return existing_event
            return None

        service.attendance_repo.get_event_before_timestamp = AsyncMock(side_effect=mock_get_before)

        created_events = []

        async def capture_event(**kwargs):
            event = SimpleNamespace(
                id=len(created_events) + 2,
                student_id=kwargs["student_id"],
                type=kwargs["event_type"],
                gate_id=kwargs["gate_id"],
                device_id=kwargs["device_id"],
                occurred_at=kwargs["occurred_at"],
                photo_ref=kwargs.get("photo_ref"),
                local_seq=kwargs.get("local_seq"),
                source=kwargs.get("source"),
                conflict_corrected=kwargs.get("conflict_corrected", False),
            )
            created_events.append(event)
            return event

        service.attendance_repo.create_event = AsyncMock(side_effect=capture_event)
        service.correction_repo = MagicMock()
        service.correction_repo.create = AsyncMock()

        # Offline event at 10:30 syncs later, tablet thinks it's first (sends IN)
        payload = AttendanceEventCreate(
            student_id=1,
            device_id="tablet-offline",
            gate_id="main",
            type=AttendanceType.IN,  # Wrong - previous at 10:00 was IN
            occurred_at=today_at(10, 30),
        )

        result = await service.register_event(payload)

        # Should be corrected to OUT based on 10:00 IN
        assert result.type == "OUT"
        assert created_events[0].conflict_corrected is True

    @pytest.mark.anyio("asyncio")
    async def test_retroactive_event_validated_against_earlier_events(self, monkeypatch) -> None:
        """Event inserted retroactively is validated against EARLIER events only.

        Scenario:
        - Event at 10:30 created first → IN (no previous)
        - Event at 10:00 (synced later) → should be IN (no event before 10:00)

        KNOWN LIMITATION: This creates IN(10:00) + IN(10:30) which is inconsistent.
        The 10:30 event is not retroactively corrected.
        """
        monkeypatch.setattr("app.core.config.settings.enable_sequence_validation", True)

        session = MagicMock()
        session.commit = AsyncMock()

        service = AttendanceService(session)
        service.student_repo.get = AsyncMock(
            return_value=SimpleNamespace(id=1, full_name="Test Student")
        )

        # When checking for events before 10:00, nothing exists
        service.attendance_repo.get_event_before_timestamp = AsyncMock(return_value=None)

        async def capture_event(**kwargs):
            return SimpleNamespace(
                id=1,
                student_id=kwargs["student_id"],
                type=kwargs["event_type"],
                gate_id=kwargs["gate_id"],
                device_id=kwargs["device_id"],
                occurred_at=kwargs["occurred_at"],
                photo_ref=kwargs.get("photo_ref"),
                local_seq=kwargs.get("local_seq"),
                source=kwargs.get("source"),
                conflict_corrected=kwargs.get("conflict_corrected", False),
            )

        service.attendance_repo.create_event = AsyncMock(side_effect=capture_event)
        service.correction_repo = MagicMock()
        service.correction_repo.create = AsyncMock()

        # Retroactive event at 10:00, synced after 10:30 event already exists
        # Tablet thinks it's first entry (sends IN)
        payload = AttendanceEventCreate(
            student_id=1,
            device_id="tablet-offline",
            gate_id="main",
            type=AttendanceType.IN,  # Correct - no event before 10:00
            occurred_at=today_at(10, 0),
        )

        result = await service.register_event(payload)

        # Should be IN (correct, no event before 10:00)
        assert result.type == "IN"


class TestNotificationDeduplication:
    """Tests for notification deduplication logic."""

    @pytest.mark.anyio("asyncio")
    async def test_get_or_create_returns_existing_on_duplicate(self) -> None:
        """get_or_create returns existing notification without creating new one."""
        from app.db.repositories.notifications import NotificationRepository

        session = MagicMock()
        session.flush = AsyncMock()

        repo = NotificationRepository(session)

        # Mock _find_existing to return an existing notification
        existing_notification = SimpleNamespace(
            id=99,
            guardian_id=1,
            channel="WHATSAPP",
            template="INGRESO_OK",
            context_id=10,
            notification_date=date.today(),
            status="queued",
        )
        repo._find_existing = AsyncMock(return_value=existing_notification)

        notification, created = await repo.get_or_create(
            guardian_id=1,
            channel="WHATSAPP",
            template="INGRESO_OK",
            payload={"student_id": 10},
            event_id=5,
            context_id=10,
        )

        assert notification.id == 99
        assert created is False
        session.flush.assert_not_awaited()

    @pytest.mark.anyio("asyncio")
    async def test_get_or_create_creates_when_no_existing(self) -> None:
        """get_or_create creates new notification when none exists."""
        from app.db.repositories.notifications import NotificationRepository

        session = MagicMock()
        session.add = MagicMock()
        session.flush = AsyncMock()

        repo = NotificationRepository(session)

        # Mock _find_existing to return None (no existing)
        repo._find_existing = AsyncMock(return_value=None)

        notification, created = await repo.get_or_create(
            guardian_id=1,
            channel="WHATSAPP",
            template="INGRESO_OK",
            payload={"student_id": 10},
            event_id=5,
            context_id=10,
        )

        assert created is True
        session.add.assert_called_once()
        session.flush.assert_awaited_once()

    @pytest.mark.anyio("asyncio")
    async def test_dedup_only_applies_to_attendance_notifications(self) -> None:
        """Deduplication only applies to INGRESO_OK and SALIDA_OK."""
        from app.db.repositories.notifications import NotificationRepository

        session = MagicMock()
        session.add = MagicMock()
        session.flush = AsyncMock()

        repo = NotificationRepository(session)

        # For non-attendance templates, _find_existing should not be called
        repo._find_existing = AsyncMock()

        notification, created = await repo.get_or_create(
            guardian_id=1,
            channel="WHATSAPP",
            template="NO_INGRESO_UMBRAL",  # Different template
            payload={"student_id": 10},
            event_id=5,
            context_id=10,
        )

        # Should create without checking for existing
        assert created is True
        repo._find_existing.assert_not_awaited()


class TestTimeoutHandling:
    """Tests for timeout handling in sequence validation."""

    @pytest.mark.anyio("asyncio")
    async def test_timeout_skips_validation_gracefully(self, monkeypatch) -> None:
        """Lock timeout results in no correction (graceful degradation)."""
        import asyncio

        monkeypatch.setattr("app.core.config.settings.enable_sequence_validation", True)

        session = MagicMock()
        session.commit = AsyncMock()

        service = AttendanceService(session)
        service.student_repo.get = AsyncMock(
            return_value=SimpleNamespace(id=1, full_name="Test Student")
        )

        # Simulate a lock that takes too long
        async def slow_query(*args, **kwargs):
            await asyncio.sleep(10)  # Longer than 5s timeout
            return None

        service.attendance_repo.get_event_before_timestamp = slow_query

        async def capture_event(**kwargs):
            return SimpleNamespace(
                id=1,
                student_id=kwargs["student_id"],
                type=kwargs["event_type"],
                gate_id=kwargs["gate_id"],
                device_id=kwargs["device_id"],
                occurred_at=kwargs["occurred_at"],
                photo_ref=kwargs.get("photo_ref"),
                local_seq=kwargs.get("local_seq"),
                source=kwargs.get("source"),
                conflict_corrected=kwargs.get("conflict_corrected", False),
            )

        service.attendance_repo.create_event = AsyncMock(side_effect=capture_event)

        # Request OUT as first event
        payload = AttendanceEventCreate(
            student_id=1,
            device_id="tablet-a",
            gate_id="main",
            type=AttendanceType.OUT,  # Would be corrected normally
            occurred_at=today_at(8, 0),
        )

        # Should complete without hanging (timeout kicks in)
        result = await service.register_event(payload)

        # Should NOT be corrected due to timeout
        assert result.type == "OUT"


class TestAuditRecords:
    """Tests for sequence correction audit records."""

    @pytest.mark.anyio("asyncio")
    async def test_correction_creates_audit_record(self, monkeypatch) -> None:
        """Sequence correction creates an audit record."""
        monkeypatch.setattr("app.core.config.settings.enable_sequence_validation", True)

        session = MagicMock()
        session.commit = AsyncMock()

        service = AttendanceService(session)
        service.student_repo.get = AsyncMock(
            return_value=SimpleNamespace(id=1, full_name="Test Student")
        )

        # Previous event was IN
        service.attendance_repo.get_event_before_timestamp = AsyncMock(
            return_value=SimpleNamespace(
                id=1,
                type="IN",
                occurred_at=today_at(8, 0),
            )
        )

        async def capture_event(**kwargs):
            return SimpleNamespace(
                id=42,
                student_id=kwargs["student_id"],
                type=kwargs["event_type"],
                gate_id=kwargs["gate_id"],
                device_id=kwargs["device_id"],
                occurred_at=kwargs["occurred_at"],
                photo_ref=kwargs.get("photo_ref"),
                local_seq=kwargs.get("local_seq"),
                source=kwargs.get("source"),
                conflict_corrected=kwargs.get("conflict_corrected", False),
            )

        service.attendance_repo.create_event = AsyncMock(side_effect=capture_event)

        # Track correction creation
        correction_args = []

        async def capture_correction(**kwargs):
            correction_args.append(kwargs)
            return SimpleNamespace(id=1, **kwargs)

        service.correction_repo = MagicMock()
        service.correction_repo.create = AsyncMock(side_effect=capture_correction)

        # Request IN after IN (will be corrected to OUT)
        occurred_at = today_at(10, 0)
        payload = AttendanceEventCreate(
            student_id=1,
            device_id="tablet-b",
            gate_id="main",
            type=AttendanceType.IN,
            occurred_at=occurred_at,
        )

        await service.register_event(payload)

        # Verify audit record was created
        assert len(correction_args) == 1
        audit = correction_args[0]
        assert audit["event_id"] == 42
        assert audit["student_id"] == 1
        assert audit["requested_type"] == "IN"
        assert audit["corrected_type"] == "OUT"
        assert audit["device_id"] == "tablet-b"
        assert audit["gate_id"] == "main"
        assert audit["occurred_at"] == occurred_at

    @pytest.mark.anyio("asyncio")
    async def test_no_audit_record_when_not_corrected(self, monkeypatch) -> None:
        """No audit record is created for valid sequences."""
        monkeypatch.setattr("app.core.config.settings.enable_sequence_validation", True)

        session = MagicMock()
        session.commit = AsyncMock()

        service = AttendanceService(session)
        service.student_repo.get = AsyncMock(
            return_value=SimpleNamespace(id=1, full_name="Test Student")
        )

        # Previous event was IN
        service.attendance_repo.get_event_before_timestamp = AsyncMock(
            return_value=SimpleNamespace(
                id=1,
                type="IN",
                occurred_at=today_at(8, 0),
            )
        )

        async def capture_event(**kwargs):
            return SimpleNamespace(
                id=42,
                student_id=kwargs["student_id"],
                type=kwargs["event_type"],
                gate_id=kwargs["gate_id"],
                device_id=kwargs["device_id"],
                occurred_at=kwargs["occurred_at"],
                photo_ref=kwargs.get("photo_ref"),
                local_seq=kwargs.get("local_seq"),
                source=kwargs.get("source"),
                conflict_corrected=kwargs.get("conflict_corrected", False),
            )

        service.attendance_repo.create_event = AsyncMock(side_effect=capture_event)
        service.correction_repo = MagicMock()
        service.correction_repo.create = AsyncMock()

        # Request OUT after IN (correct sequence)
        payload = AttendanceEventCreate(
            student_id=1,
            device_id="tablet-b",
            gate_id="main",
            type=AttendanceType.OUT,
            occurred_at=today_at(10, 0),
        )

        await service.register_event(payload)

        # No audit record should be created
        service.correction_repo.create.assert_not_awaited()

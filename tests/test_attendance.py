from datetime import datetime

from app.schemas.attendance import AttendanceEventCreate, AttendanceType


def test_attendance_event_create_defaults() -> None:
    payload = AttendanceEventCreate(
        student_id=1,
        device_id="DEV-01",
        gate_id="GATE-A",
        type=AttendanceType.IN,
        occurred_at=datetime.utcnow(),
    )

    assert payload.student_id == 1
    assert payload.type == AttendanceType.IN

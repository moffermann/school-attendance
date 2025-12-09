"""Seed historical attendance data for demo tenant.

Revision ID: 0013_seed_historical_data
Revises: 0012_fix_password_hashes
Create Date: 2025-12-08

This migration adds realistic historical data to the demo tenant:
1. 30 days of attendance events (IN/OUT) for all 60 students
2. Realistic patterns: ~95% attendance rate, varied entry times
3. No-show alerts for students who didn't arrive
4. Notifications sent for each event
5. Usage statistics aggregated by day
6. Some absence requests (approved/rejected)
7. Schedule exceptions (holidays, special days)
"""

from __future__ import annotations

import random
from datetime import datetime, date, time, timedelta
from typing import List, Dict, Any

from alembic import op
import sqlalchemy as sa

revision = "0013_seed_historical_data"
down_revision = "0012_fix_password_hashes"
branch_labels = None
depends_on = None

SCHEMA_NAME = "tenant_demo"

# Configuration for data generation
NUM_HISTORICAL_DAYS = 30  # 30 days of history
ATTENDANCE_RATE = 0.92  # 92% of students attend each day
LATE_ARRIVAL_RATE = 0.10  # 10% of attendees arrive late
EARLY_EXIT_RATE = 0.05  # 5% leave early

# School schedule
SCHOOL_ENTRY_TIME = time(8, 0)  # 08:00
SCHOOL_EXIT_TIME = time(16, 0)  # 16:00
TOLERANCE_MINUTES = 15

# Devices and gates
DEVICES = [
    {"device_id": "KIOSK-001", "gate_id": "GATE-PRINCIPAL"},
    {"device_id": "KIOSK-002", "gate_id": "GATE-SECUNDARIA"},
]


def get_school_days(start_date: date, num_days: int) -> List[date]:
    """Get list of school days (Monday-Friday, excluding weekends)."""
    school_days = []
    current = start_date
    while len(school_days) < num_days:
        if current.weekday() < 5:  # Monday = 0, Friday = 4
            school_days.append(current)
        current -= timedelta(days=1)
    return sorted(school_days)


def random_entry_time(is_late: bool = False) -> time:
    """Generate realistic entry time."""
    if is_late:
        # Late: 8:16 - 9:30
        minutes_late = random.randint(16, 90)
        entry = datetime.combine(date.today(), SCHOOL_ENTRY_TIME) + timedelta(minutes=minutes_late)
    else:
        # On time: 7:30 - 8:10 (some arrive early, some just on time)
        minutes_offset = random.randint(-30, 10)
        entry = datetime.combine(date.today(), SCHOOL_ENTRY_TIME) + timedelta(minutes=minutes_offset)
    return entry.time()


def random_exit_time(is_early: bool = False) -> time:
    """Generate realistic exit time."""
    if is_early:
        # Early exit: 14:00 - 15:30
        minutes_early = random.randint(30, 120)
        exit_dt = datetime.combine(date.today(), SCHOOL_EXIT_TIME) - timedelta(minutes=minutes_early)
    else:
        # Normal: 16:00 - 16:30
        minutes_offset = random.randint(0, 30)
        exit_dt = datetime.combine(date.today(), SCHOOL_EXIT_TIME) + timedelta(minutes=minutes_offset)
    return exit_dt.time()


def upgrade() -> None:
    conn = op.get_bind()

    # Calculate date range (last 30 school days before today)
    today = date.today()
    school_days = get_school_days(today - timedelta(days=1), NUM_HISTORICAL_DAYS)

    print(f"Generating attendance data for {len(school_days)} school days...")
    print(f"Date range: {school_days[0]} to {school_days[-1]}")

    # Get all students
    result = conn.execute(sa.text(f"SELECT id, course_id FROM {SCHEMA_NAME}.students ORDER BY id"))
    students = [{"id": row[0], "course_id": row[1]} for row in result.fetchall()]
    print(f"Found {len(students)} students")

    # Get all guardians linked to students
    result = conn.execute(sa.text(f"""
        SELECT sg.student_id, sg.guardian_id
        FROM {SCHEMA_NAME}.student_guardians sg
    """))
    student_guardians = {row[0]: row[1] for row in result.fetchall()}

    # Statistics counters
    total_events = 0
    total_notifications = 0
    total_no_shows = 0

    # Process each school day
    for day_idx, school_day in enumerate(school_days):
        day_events = 0
        day_no_shows = 0

        # Determine which students attend today
        attending_students = random.sample(
            students,
            int(len(students) * ATTENDANCE_RATE)
        )
        absent_students = [s for s in students if s not in attending_students]

        for student in attending_students:
            student_id = student["id"]
            guardian_id = student_guardians.get(student_id)

            # Determine if late or early exit
            is_late = random.random() < LATE_ARRIVAL_RATE
            is_early_exit = random.random() < EARLY_EXIT_RATE

            # Select random device
            device = random.choice(DEVICES)

            # Generate entry time
            entry_time = random_entry_time(is_late)
            entry_datetime = datetime.combine(school_day, entry_time)

            # Insert entry event
            conn.execute(
                sa.text(f"""
                    INSERT INTO {SCHEMA_NAME}.attendance_events
                    (student_id, type, gate_id, device_id, occurred_at, synced_at)
                    VALUES (:student_id, 'IN', :gate_id, :device_id, :occurred_at, :synced_at)
                """),
                {
                    "student_id": student_id,
                    "gate_id": device["gate_id"],
                    "device_id": device["device_id"],
                    "occurred_at": entry_datetime,
                    "synced_at": entry_datetime + timedelta(seconds=random.randint(1, 30)),
                }
            )
            day_events += 1

            # Send notification for entry
            if guardian_id:
                conn.execute(
                    sa.text(f"""
                        INSERT INTO {SCHEMA_NAME}.notifications
                        (guardian_id, type, channel, status, payload, sent_at, created_at)
                        VALUES (:guardian_id, 'INGRESO_OK', 'whatsapp', 'delivered',
                                :payload, :sent_at, :created_at)
                    """),
                    {
                        "guardian_id": guardian_id,
                        "payload": f'{{"student_id": {student_id}, "time": "{entry_time.strftime("%H:%M")}"}}',
                        "sent_at": entry_datetime + timedelta(seconds=random.randint(5, 60)),
                        "created_at": entry_datetime,
                    }
                )
                total_notifications += 1

            # Generate exit event (if student exits today)
            if not is_early_exit or random.random() > 0.3:  # Most students exit
                exit_time = random_exit_time(is_early_exit)
                exit_datetime = datetime.combine(school_day, exit_time)

                # Use potentially different device for exit
                exit_device = random.choice(DEVICES)

                conn.execute(
                    sa.text(f"""
                        INSERT INTO {SCHEMA_NAME}.attendance_events
                        (student_id, type, gate_id, device_id, occurred_at, synced_at)
                        VALUES (:student_id, 'OUT', :gate_id, :device_id, :occurred_at, :synced_at)
                    """),
                    {
                        "student_id": student_id,
                        "gate_id": exit_device["gate_id"],
                        "device_id": exit_device["device_id"],
                        "occurred_at": exit_datetime,
                        "synced_at": exit_datetime + timedelta(seconds=random.randint(1, 30)),
                    }
                )
                day_events += 1

                # Send notification for exit
                if guardian_id:
                    conn.execute(
                        sa.text(f"""
                            INSERT INTO {SCHEMA_NAME}.notifications
                            (guardian_id, type, channel, status, payload, sent_at, created_at)
                            VALUES (:guardian_id, 'SALIDA_OK', 'whatsapp', 'delivered',
                                    :payload, :sent_at, :created_at)
                        """),
                        {
                            "guardian_id": guardian_id,
                            "payload": f'{{"student_id": {student_id}, "time": "{exit_time.strftime("%H:%M")}"}}',
                            "sent_at": exit_datetime + timedelta(seconds=random.randint(5, 60)),
                            "created_at": exit_datetime,
                        }
                    )
                    total_notifications += 1

        # Create no-show alerts for absent students
        for student in absent_students:
            student_id = student["id"]
            guardian_id = student_guardians.get(student_id)

            # 70% of absences generate alerts (some might have prior notice)
            if random.random() < 0.7:
                alert_time = datetime.combine(school_day, time(9, 0))  # Alert at 9:00

                conn.execute(
                    sa.text(f"""
                        INSERT INTO {SCHEMA_NAME}.no_show_alerts
                        (student_id, alert_date, expected_time, status, created_at)
                        VALUES (:student_id, :alert_date, :expected_time, :status, :created_at)
                    """),
                    {
                        "student_id": student_id,
                        "alert_date": school_day,
                        "expected_time": SCHOOL_ENTRY_TIME,
                        "status": "NOTIFIED" if random.random() < 0.8 else "PENDING",
                        "created_at": alert_time,
                    }
                )
                day_no_shows += 1

                # Send no-show notification
                if guardian_id and random.random() < 0.9:
                    conn.execute(
                        sa.text(f"""
                            INSERT INTO {SCHEMA_NAME}.notifications
                            (guardian_id, type, channel, status, payload, sent_at, created_at)
                            VALUES (:guardian_id, 'NO_INGRESO', 'whatsapp', 'delivered',
                                    :payload, :sent_at, :created_at)
                        """),
                        {
                            "guardian_id": guardian_id,
                            "payload": f'{{"student_id": {student_id}, "date": "{school_day.isoformat()}"}}',
                            "sent_at": alert_time + timedelta(seconds=random.randint(5, 120)),
                            "created_at": alert_time,
                        }
                    )
                    total_notifications += 1

        total_events += day_events
        total_no_shows += day_no_shows

        # Progress indicator every 5 days
        if (day_idx + 1) % 5 == 0:
            print(f"  Processed {day_idx + 1}/{len(school_days)} days...")

    print(f"\nGenerated {total_events} attendance events")
    print(f"Generated {total_notifications} notifications")
    print(f"Generated {total_no_shows} no-show alerts")

    # Create absence requests (some historical absences have formal requests)
    print("\nGenerating absence requests...")
    absence_count = 0

    # Select some random absent student-days for formal requests
    result = conn.execute(sa.text(f"""
        SELECT DISTINCT s.id, s.full_name
        FROM {SCHEMA_NAME}.students s
    """))
    all_students = [{"id": row[0], "name": row[1]} for row in result.fetchall()]

    # Create 20-30 absence requests spread across the date range
    absence_types = ["SICK", "HOLIDAY", "FAMILY", "MEDICAL", "OTHER"]

    for _ in range(random.randint(20, 30)):
        student = random.choice(all_students)
        request_date = random.choice(school_days)
        end_date = request_date + timedelta(days=random.randint(0, 2))

        reasons = [
            "Cita médica", "Enfermedad", "Viaje familiar",
            "Evento familiar", "Trámite legal", "Control dental"
        ]
        statuses = ["APPROVED", "APPROVED", "APPROVED", "REJECTED", "PENDING"]

        status = random.choice(statuses)
        submit_time = datetime.combine(
            request_date - timedelta(days=random.randint(0, 3)),
            time(random.randint(8, 18), random.randint(0, 59))
        )

        conn.execute(
            sa.text(f"""
                INSERT INTO {SCHEMA_NAME}.absence_requests
                (student_id, date, reason, status, created_at)
                VALUES (:student_id, :date, :reason, :status, :created_at)
            """),
            {
                "student_id": student["id"],
                "date": request_date,
                "reason": random.choice(reasons),
                "status": status,
                "created_at": submit_time,
            }
        )
        absence_count += 1

    print(f"Generated {absence_count} absence requests")

    # Create schedule exceptions (holidays and special days)
    print("\nGenerating schedule exceptions...")
    exception_count = 0

    # Get schedule IDs
    result = conn.execute(sa.text(f"SELECT id, course_id FROM {SCHEMA_NAME}.schedules"))
    schedules = [{"id": row[0], "course_id": row[1]} for row in result.fetchall()]

    # Add some holidays/special days
    special_dates = [
        {"date": school_days[5], "reason": "Día del Profesor", "is_holiday": True},
        {"date": school_days[12], "reason": "Reunión de Apoderados", "is_holiday": False,
         "out_time": time(12, 30)},
        {"date": school_days[20], "reason": "Acto Cívico", "is_holiday": False,
         "in_time": time(9, 0)},
    ]

    for special in special_dates:
        if special["date"] in school_days:
            for schedule in schedules:
                conn.execute(
                    sa.text(f"""
                        INSERT INTO {SCHEMA_NAME}.schedule_exceptions
                        (schedule_id, exception_date, is_holiday, modified_entry_time, modified_exit_time, reason)
                        VALUES (:schedule_id, :exception_date, :is_holiday,
                                :modified_entry_time, :modified_exit_time, :reason)
                    """),
                    {
                        "schedule_id": schedule["id"],
                        "exception_date": special["date"],
                        "is_holiday": special.get("is_holiday", False),
                        "modified_entry_time": special.get("in_time"),
                        "modified_exit_time": special.get("out_time"),
                        "reason": special["reason"],
                    }
                )
                exception_count += 1

    print(f"Generated {exception_count} schedule exceptions")

    # Create usage statistics
    print("\nGenerating usage statistics...")

    # Get tenant ID
    result = conn.execute(sa.text("SELECT id FROM public.tenants WHERE slug = 'demo'"))
    tenant_id = result.scalar()

    if tenant_id:
        for school_day in school_days:
            # Count events for this day
            result = conn.execute(sa.text(f"""
                SELECT
                    COUNT(*) FILTER (WHERE type = 'IN') as entries,
                    COUNT(*) FILTER (WHERE type = 'OUT') as exits
                FROM {SCHEMA_NAME}.attendance_events
                WHERE DATE(occurred_at) = :day
            """), {"day": school_day})
            row = result.fetchone()
            entries = row[0] if row else 0
            exits = row[1] if row else 0

            # Insert usage stats (using correct metric names from UsageStat model)
            metrics = [
                ("attendance_events", entries + exits),
                ("notifications_sent", int((entries + exits) * 0.95)),
                ("active_students", int(len(students) * ATTENDANCE_RATE)),
                ("whatsapp_messages", int((entries + exits) * 0.90)),
            ]

            for metric_name, value in metrics:
                conn.execute(
                    sa.text("""
                        INSERT INTO public.usage_stats
                        (tenant_id, stat_date, metric_name, value)
                        VALUES (:tenant_id, :stat_date, :metric_name, :value)
                        ON CONFLICT (tenant_id, stat_date, metric_name)
                        DO UPDATE SET value = EXCLUDED.value
                    """),
                    {
                        "tenant_id": tenant_id,
                        "stat_date": school_day,
                        "metric_name": metric_name,
                        "value": value,
                    }
                )

    print(f"Generated usage statistics for {len(school_days)} days")

    # Create QR tags for all students
    print("\nGenerating QR tags for students...")
    import hashlib

    for student in students:
        student_id = student["id"]
        # Generate unique token
        token = f"QR-{student_id:04d}-DEMO"
        token_hash = hashlib.sha256(token.encode()).hexdigest()
        token_preview = token[:8]

        conn.execute(
            sa.text(f"""
                INSERT INTO {SCHEMA_NAME}.tags
                (student_id, tag_token_hash, tag_token_preview, status, created_at)
                VALUES (:student_id, :token_hash, :token_preview, 'ACTIVE', NOW())
                ON CONFLICT (tag_token_hash) DO NOTHING
            """),
            {
                "student_id": student_id,
                "token_hash": token_hash,
                "token_preview": token_preview,
            }
        )

    print(f"Generated QR tags for {len(students)} students")

    # Create enrollments for current year
    print("\nGenerating enrollments...")
    current_year = today.year

    for student in students:
        conn.execute(
            sa.text(f"""
                INSERT INTO {SCHEMA_NAME}.enrollments
                (student_id, course_id, year, created_at)
                VALUES (:student_id, :course_id, :year, NOW())
                ON CONFLICT DO NOTHING
            """),
            {
                "student_id": student["id"],
                "course_id": student["course_id"],
                "year": current_year,
            }
        )

    print(f"Generated enrollments for {len(students)} students")

    print("\n✅ Historical data seeding complete!")


def downgrade() -> None:
    conn = op.get_bind()

    # Delete all generated data
    print("Removing historical data...")

    # Delete attendance events
    conn.execute(sa.text(f"DELETE FROM {SCHEMA_NAME}.attendance_events"))

    # Delete notifications
    conn.execute(sa.text(f"DELETE FROM {SCHEMA_NAME}.notifications"))

    # Delete no-show alerts
    conn.execute(sa.text(f"DELETE FROM {SCHEMA_NAME}.no_show_alerts"))

    # Delete absence requests
    conn.execute(sa.text(f"DELETE FROM {SCHEMA_NAME}.absence_requests"))

    # Delete schedule exceptions
    conn.execute(sa.text(f"DELETE FROM {SCHEMA_NAME}.schedule_exceptions"))

    # Delete tags
    conn.execute(sa.text(f"DELETE FROM {SCHEMA_NAME}.tags"))

    # Delete enrollments
    conn.execute(sa.text(f"DELETE FROM {SCHEMA_NAME}.enrollments"))

    # Delete usage stats for demo tenant
    result = conn.execute(sa.text("SELECT id FROM public.tenants WHERE slug = 'demo'"))
    tenant_id = result.scalar()
    if tenant_id:
        conn.execute(
            sa.text("DELETE FROM public.usage_stats WHERE tenant_id = :tenant_id"),
            {"tenant_id": tenant_id}
        )

    print("✅ Historical data removed")

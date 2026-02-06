"""
Debug script to trace notification flow for attendance events.
Run this after registering an attendance event to see why notifications aren't created.

Usage:
    cd school-attendance
    python scripts/debug_notification_flow.py
"""

import asyncio
import sys
from pathlib import Path

# Add project root to path
sys.path.insert(0, str(Path(__file__).parent.parent))

from loguru import logger
from sqlalchemy import text

from app.core.config import settings
from app.db.session import async_session


async def debug_notification_flow():
    """Debug the notification flow for the most recent attendance event."""

    print("\n" + "="*60)
    print("DEBUG: Notification Flow Analysis")
    print("="*60)

    async with async_session() as session:
        # Set schema
        await session.execute(text("SET search_path TO tenant_demo_local, public"))

        # 1. Get most recent event
        print("\n[1] Most Recent Attendance Event:")
        result = await session.execute(text("""
            SELECT e.id, e.student_id, e.type, e.occurred_at, s.full_name
            FROM attendance_events e
            JOIN students s ON e.student_id = s.id
            ORDER BY e.id DESC LIMIT 1
        """))
        event = result.fetchone()
        if not event:
            print("   No events found!")
            return

        event_id, student_id, event_type, occurred_at, student_name = event
        print(f"   Event ID: {event_id}")
        print(f"   Student: {student_name} (ID: {student_id})")
        print(f"   Type: {event_type}")
        print(f"   Time: {occurred_at}")

        # 2. Check if notification exists for this event
        print(f"\n[2] Notifications for Event {event_id}:")
        result = await session.execute(text("""
            SELECT id, guardian_id, channel, template, status
            FROM notifications
            WHERE event_id = :event_id
        """), {"event_id": event_id})
        notifications = result.fetchall()
        if not notifications:
            print("   [X] NO NOTIFICATIONS FOUND for this event!")
        else:
            for n in notifications:
                print(f"   [OK] Notification {n[0]}: {n[2]} ({n[3]}) - {n[4]}")

        # 3. Check student-guardian relationship
        print(f"\n[3] Guardians for Student {student_id}:")
        result = await session.execute(text("""
            SELECT g.id, g.full_name, g.contacts, g.notification_prefs
            FROM guardians g
            JOIN student_guardians sg ON g.id = sg.guardian_id
            WHERE sg.student_id = :student_id
        """), {"student_id": student_id})
        guardians = result.fetchall()
        if not guardians:
            print("   [X] NO GUARDIANS linked to this student!")
            print("   This is why notifications aren't sent.")
            return

        for g in guardians:
            g_id, g_name, contacts, prefs = g
            print(f"\n   Guardian {g_id}: {g_name}")
            print(f"   Contacts: {contacts}")

            # Check notification prefs for this event type
            notification_type = "INGRESO_OK" if event_type == "IN" else "SALIDA_OK"
            event_prefs = prefs.get(notification_type, {}) if prefs else {}
            print(f"   Prefs for {notification_type}: {event_prefs}")

            # Check if email is enabled
            email_enabled = event_prefs.get("email", False)  # Default False per code
            email_contact = contacts.get("email") if contacts else None

            print(f"\n   Email enabled: {email_enabled}")
            print(f"   Email contact: {email_contact}")

            if email_enabled and email_contact:
                print("   [OK] Email notification SHOULD have been created")
            elif not email_enabled:
                print("   [X] Email is DISABLED in notification_prefs")
            elif not email_contact:
                print("   [X] No email in contacts")

        # 4. Check student evidence preference
        print(f"\n[4] Student Evidence Preference:")
        result = await session.execute(text("""
            SELECT evidence_preference, photo_pref_opt_in
            FROM students WHERE id = :student_id
        """), {"student_id": student_id})
        student_prefs = result.fetchone()
        if student_prefs:
            print(f"   evidence_preference: {student_prefs[0]}")
            print(f"   photo_pref_opt_in: {student_prefs[1]}")

        # 5. Check Redis connection
        print("\n[5] Redis Status:")
        try:
            from redis import Redis
            r = Redis.from_url(settings.redis_url)
            r.ping()
            print(f"   [OK] Redis connected: {settings.redis_url}")
        except Exception as e:
            print(f"   [X] Redis error: {e}")

        # 6. Summary
        print("\n" + "="*60)
        print("SUMMARY")
        print("="*60)

        if not notifications:
            print("""
The notification was NOT created in the database.
Possible causes:
1. Exception in notification service (check server logs for "Failed to send notifications")
2. Session transaction issue (notifications created but rolled back)
3. No guardians linked to student
4. Email disabled in guardian's notification_prefs

Next steps:
- Check server terminal for error logs when registering attendance
- Look for: "Failed to send notifications for event X"
- Or: "Notification service not configured, skipping notifications"
""")
        else:
            print(f"\n[OK] Notifications were created. Check worker logs for delivery status.")


if __name__ == "__main__":
    asyncio.run(debug_notification_flow())

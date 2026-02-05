"""Aggregate API router."""

from fastapi import APIRouter

from app.api.v1 import (
    absences,
    alerts,
    attendance,
    auth,
    authorized_pickups,
    broadcast,
    courses,
    devices,
    guardians,
    health,
    kiosk,
    notifications,
    parent_pickups,
    parents,
    photos,
    push_subscriptions,
    schedules,
    students,
    tags,
    teachers,
    tenant_setup,
    webapp,
    webauthn,
    withdrawal_requests,
    withdrawals,
)
from app.api.v1.super_admin import super_admin_router

api_router = APIRouter()

# Health check
api_router.include_router(health.router, prefix="/health", tags=["health"])

# Multi-tenant: Super Admin routes (no tenant context required)
api_router.include_router(super_admin_router)

# Tenant setup routes (for admin activation via email link)
api_router.include_router(tenant_setup.router, prefix="/tenant-setup", tags=["tenant-setup"])

# Tenant-scoped routes
api_router.include_router(attendance.router, prefix="/attendance", tags=["attendance"])
api_router.include_router(notifications.router, prefix="/notifications", tags=["notifications"])
api_router.include_router(schedules.router, prefix="/schedules", tags=["schedules"])
api_router.include_router(broadcast.router, prefix="/broadcasts", tags=["broadcasts"])
api_router.include_router(parents.router, prefix="/parents", tags=["parents"])
api_router.include_router(
    parent_pickups.router,
    prefix="/parents/{guardian_id}/pickups",
    tags=["parent-pickups"],
)
api_router.include_router(tags.router, prefix="/tags", tags=["tags"])
api_router.include_router(devices.router, prefix="/devices", tags=["devices"])
api_router.include_router(auth.router, prefix="/auth", tags=["auth"])
api_router.include_router(alerts.router, prefix="/alerts", tags=["alerts"])
api_router.include_router(webapp.router, prefix="/web-app", tags=["web-app"])
api_router.include_router(absences.router, prefix="/absences", tags=["absences"])
api_router.include_router(teachers.router, prefix="/teachers", tags=["teachers"])
api_router.include_router(courses.router, prefix="/courses", tags=["courses"])
api_router.include_router(students.router, prefix="/students", tags=["students"])
api_router.include_router(guardians.router, prefix="/guardians", tags=["guardians"])
api_router.include_router(kiosk.router, prefix="/kiosk", tags=["kiosk"])
api_router.include_router(photos.router, prefix="/photos", tags=["photos"])
api_router.include_router(webauthn.router, prefix="/webauthn", tags=["webauthn"])
api_router.include_router(push_subscriptions.router)

# Authorized pickups and withdrawals
api_router.include_router(authorized_pickups.router, prefix="/authorized-pickups", tags=["authorized-pickups"])
api_router.include_router(
    authorized_pickups.student_pickups_router,
    prefix="/students/{student_id}/authorized-pickups",
    tags=["authorized-pickups"],
)
api_router.include_router(withdrawals.router, prefix="/withdrawals", tags=["withdrawals"])

# Withdrawal requests (parent-initiated pickup scheduling)
api_router.include_router(
    withdrawal_requests.parent_router,
    prefix="/parents/{guardian_id}/withdrawal-requests",
    tags=["withdrawal-requests"],
)
api_router.include_router(
    withdrawal_requests.staff_router,
    prefix="/withdrawal-requests",
    tags=["withdrawal-requests"],
)

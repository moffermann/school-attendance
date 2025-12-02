"""Aggregate API router."""

from fastapi import APIRouter

from app.api.v1 import (
    alerts,
    absences,
    attendance,
    auth,
    broadcast,
    devices,
    health,
    kiosk,
    notifications,
    parents,
    schedules,
    tags,
    teachers,
    webapp,
    webauthn,
)


api_router = APIRouter()

api_router.include_router(health.router, prefix="/health", tags=["health"])
api_router.include_router(attendance.router, prefix="/attendance", tags=["attendance"])
api_router.include_router(notifications.router, prefix="/notifications", tags=["notifications"])
api_router.include_router(schedules.router, prefix="/schedules", tags=["schedules"])
api_router.include_router(broadcast.router, prefix="/broadcasts", tags=["broadcasts"])
api_router.include_router(parents.router, prefix="/parents", tags=["parents"])
api_router.include_router(tags.router, prefix="/tags", tags=["tags"])
api_router.include_router(devices.router, prefix="/devices", tags=["devices"])
api_router.include_router(auth.router, prefix="/auth", tags=["auth"])
api_router.include_router(alerts.router, prefix="/alerts", tags=["alerts"])
api_router.include_router(webapp.router, prefix="/web-app", tags=["web-app"])
api_router.include_router(absences.router, prefix="/absences", tags=["absences"])
api_router.include_router(teachers.router, prefix="/teachers", tags=["teachers"])
api_router.include_router(kiosk.router, prefix="/kiosk", tags=["kiosk"])
api_router.include_router(webauthn.router, prefix="/webauthn", tags=["webauthn"])

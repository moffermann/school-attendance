"""Endpoints to support the standalone web SPA."""

from datetime import date

from fastapi import APIRouter, Depends, Query
from fastapi.responses import StreamingResponse

from app.core import deps
from app.core.auth import AuthUser
from app.schemas.webapp import DashboardSnapshot, WebAppBootstrap
from app.services.dashboard_service import DashboardService
from app.services.web_app_service import WebAppDataService


router = APIRouter(prefix="", tags=["web-app"])


@router.get("/bootstrap", response_model=WebAppBootstrap)
async def load_bootstrap(
    current_user: AuthUser = Depends(deps.require_roles("ADMIN", "DIRECTOR", "INSPECTOR", "PARENT")),
    service: WebAppDataService = Depends(deps.get_web_app_data_service),
) -> WebAppBootstrap:
    return await service.build_bootstrap_payload(current_user)


@router.get("/dashboard", response_model=DashboardSnapshot)
async def dashboard_snapshot(
    date_value: date | None = Query(default=None, alias="date"),
    course_id: int | None = Query(default=None),
    event_type: str | None = Query(default=None, alias="type"),
    search: str | None = Query(default=None),
    dashboard_service: DashboardService = Depends(deps.get_dashboard_service),
    _: AuthUser = Depends(deps.require_roles("ADMIN", "DIRECTOR", "INSPECTOR")),
) -> DashboardSnapshot:
    target_date = date_value or date.today()
    return await dashboard_service.get_snapshot(
        target_date=target_date,
        course_id=course_id,
        event_type=event_type,
        search=search,
    )


@router.get("/dashboard/export", response_class=StreamingResponse)
async def export_dashboard_snapshot(
    date_value: date | None = Query(default=None, alias="date"),
    course_id: int | None = Query(default=None),
    event_type: str | None = Query(default=None, alias="type"),
    search: str | None = Query(default=None),
    dashboard_service: DashboardService = Depends(deps.get_dashboard_service),
    _: AuthUser = Depends(deps.require_roles("ADMIN", "DIRECTOR", "INSPECTOR")),
) -> StreamingResponse:
    target_date = date_value or date.today()
    csv_data = await dashboard_service.export_snapshot_csv(
        target_date=target_date,
        course_id=course_id,
        event_type=event_type,
        search=search,
    )
    filename = f"dashboard_{target_date.isoformat()}.csv"
    return StreamingResponse(
        iter([csv_data]),
        media_type="text/csv",
        headers={"Content-Disposition": f'attachment; filename=\"{filename}\"'},
    )

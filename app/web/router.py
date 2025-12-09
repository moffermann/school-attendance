"""Router for server-rendered pages."""

from datetime import date, timezone

from fastapi import APIRouter, Depends, Request, HTTPException
from fastapi.responses import HTMLResponse, RedirectResponse
from fastapi.templating import Jinja2Templates
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core import deps
from app.core.auth import AuthUser
from app.core.security import create_access_token, create_refresh_token, decode_session, encode_session
from app.db.models.attendance_event import AttendanceEvent
from app.db.models.course import Course
from app.db.models.guardian import Guardian
from app.db.models.schedule import Schedule
from app.db.models.student import Student
from urllib.parse import urlencode

from app.db.repositories.users import UserRepository
from app.services.attendance_service import AttendanceService
from app.services.alert_service import AlertService


templates = Jinja2Templates(directory="app/web/templates")

web_router = APIRouter()


async def _require_staff_user(
    request: Request, session: AsyncSession, allowed_roles: tuple[str, ...] = ("ADMIN", "DIRECTOR", "INSPECTOR")
):
    next_path = request.url.path
    session_token = request.cookies.get("session_token")
    if not session_token:
        return RedirectResponse(f"/login?next={next_path}", status_code=303)
    try:
        data = decode_session(session_token)
    except HTTPException:
        return RedirectResponse(f"/login?next={next_path}", status_code=303)

    user_id = data.get("user_id")
    repo = UserRepository(session)
    user = await repo.get(int(user_id)) if user_id else None
    if not user or user.role not in allowed_roles:
        return RedirectResponse(f"/login?next={next_path}", status_code=303)

    auth_user = AuthUser(id=user.id, role=user.role, full_name=user.full_name, guardian_id=user.guardian_id)
    api_token = create_access_token(str(user.id), role=user.role, guardian_id=user.guardian_id)
    return auth_user, api_token


@web_router.get("/login", response_class=HTMLResponse)
async def login_page(request: Request) -> HTMLResponse:
    next_url = request.query_params.get("next", "/app")
    return templates.TemplateResponse(
        "login.html",
        {
            "request": request,
            "error": None,
            "current_user": None,
            "api_token": None,
            "next": next_url,
            "email": None,
        },
    )


@web_router.post("/login", response_class=HTMLResponse)
async def login_submit(
    request: Request, auth_service=Depends(deps.get_auth_service)
):
    form = await request.form()
    email = form.get("email", "").strip().lower()
    password = form.get("password", "")
    next_url = form.get("next") or "/app"

    try:
        user = await auth_service.authenticate_user(email, password)
    except HTTPException:
        return templates.TemplateResponse(
            "login.html",
            {
                "request": request,
                "error": "Credenciales inválidas",
                "next": next_url,
                "email": email,
                "current_user": None,
                "api_token": None,
            },
            status_code=400,
        )

    session_token = encode_session({"user_id": user.id})

    # Generate JWT tokens for SPA
    access_token = create_access_token(str(user.id), role=user.role, guardian_id=user.guardian_id)
    refresh_token = create_refresh_token(str(user.id))

    # If redirecting to SPA, append tokens as hash fragment
    # Hash fragments are not sent to server, only available client-side
    if next_url.startswith("/app"):
        redirect_url = f"{next_url}#token={access_token}&refresh={refresh_token}"
    else:
        redirect_url = next_url

    response = RedirectResponse(redirect_url, status_code=303)
    response.set_cookie(
        "session_token",
        session_token,
        httponly=True,
        samesite="lax",
        max_age=60 * 60 * 8,
    )
    return response


@web_router.get("/logout")
async def logout() -> RedirectResponse:
    response = RedirectResponse("/login", status_code=303)
    response.delete_cookie("session_token")
    return response


@web_router.get("/", response_class=HTMLResponse)
async def home(
    request: Request, session: AsyncSession = Depends(deps.get_tenant_db)
) -> HTMLResponse:
    auth = await _require_staff_user(request, session)
    if isinstance(auth, RedirectResponse):
        return auth
    user, api_token = auth

    today = date.today()

    total_students = await session.scalar(select(func.count(Student.id))) or 0
    total_events_today = await session.scalar(
        select(func.count(AttendanceEvent.id)).where(
            func.date(AttendanceEvent.occurred_at) == today
        )
    ) or 0

    recent_events_stmt = (
        select(
            AttendanceEvent.id,
            AttendanceEvent.type,
            AttendanceEvent.gate_id,
            AttendanceEvent.device_id,
            AttendanceEvent.occurred_at,
            Student.full_name.label("student_name"),
        )
        .join(Student, Student.id == AttendanceEvent.student_id)
        .order_by(AttendanceEvent.occurred_at.desc())
        .limit(10)
    )
    recent_events = (await session.execute(recent_events_stmt)).all()

    alert_service = AlertService(session)
    alerts_today = await alert_service.list_alerts(start_date=today, end_date=today, status="PENDING")
    alerts_view = [
        {
            "guardian": alert.guardian_name,
            "students": [alert.student_name],
            "course": alert.course_name or "Curso",
        }
        for alert in alerts_today
    ]

    context = {
        "request": request,
        "stats": {
            "students": total_students,
            "events_today": total_events_today,
        },
        "recent_events": recent_events,
        "current_user": user,
        "api_token": api_token,
        "no_show_alerts": alerts_view,
    }
    return templates.TemplateResponse("dashboard.html", context)


@web_router.get("/schedules", response_class=HTMLResponse)
async def schedules_page(
    request: Request, session: AsyncSession = Depends(deps.get_tenant_db)
) -> HTMLResponse:
    auth = await _require_staff_user(request, session)
    if isinstance(auth, RedirectResponse):
        return auth
    user, api_token = auth

    stmt = (
        select(
            Course.name,
            Course.grade,
            Schedule.weekday,
            Schedule.in_time,
            Schedule.out_time,
        )
        .join(Schedule, Schedule.course_id == Course.id)
        .order_by(Course.name, Schedule.weekday)
    )
    rows = (await session.execute(stmt)).all()
    courses = (await session.execute(select(Course))).scalars().all()
    context = {
        "request": request,
        "schedules": rows,
        "courses": courses,
        "current_user": user,
        "api_token": api_token,
    }
    return templates.TemplateResponse("schedules.html", context)


@web_router.get("/broadcast", response_class=HTMLResponse)
async def broadcast_page(
    request: Request, session: AsyncSession = Depends(deps.get_tenant_db)
) -> HTMLResponse:
    auth = await _require_staff_user(request, session)
    if isinstance(auth, RedirectResponse):
        return auth
    user, api_token = auth

    courses = (await session.execute(select(Course))).scalars().all()
    context = {
        "request": request,
        "courses": courses,
        "current_user": user,
        "api_token": api_token,
    }
    return templates.TemplateResponse("broadcast_preview.html", context)


@web_router.get("/parents/preferences", response_class=HTMLResponse)
async def parents_prefs_page(
    request: Request, session: AsyncSession = Depends(deps.get_tenant_db)
) -> HTMLResponse:
    auth = await _require_staff_user(request, session)
    if isinstance(auth, RedirectResponse):
        return auth
    user, api_token = auth

    guardians = (await session.execute(select(Guardian))).scalars().all()
    context = {
        "request": request,
        "guardians": guardians,
        "current_user": user,
        "api_token": api_token,
    }
    return templates.TemplateResponse("parents_prefs.html", context)


@web_router.get("/alerts", response_class=HTMLResponse)
async def alerts_page(
    request: Request, session: AsyncSession = Depends(deps.get_tenant_db)
) -> HTMLResponse:
    auth = await _require_staff_user(request, session)
    if isinstance(auth, RedirectResponse):
        return auth
    user, api_token = auth

    service = AlertService(session)
    params = request.query_params

    def parse_date_param(name: str) -> date | None:
        value = params.get(name)
        if not value:
            return None
        try:
            return date.fromisoformat(value)
        except ValueError:
            return None

    def parse_int_param(name: str) -> int | None:
        value = params.get(name)
        if not value:
            return None
        try:
            return int(value)
        except ValueError:
            return None

    filters = {
        "start_date": parse_date_param("start_date"),
        "end_date": parse_date_param("end_date"),
        "status": params.get("status") or None,
        "course_id": parse_int_param("course_id"),
        "guardian_id": parse_int_param("guardian_id"),
        "student_id": parse_int_param("student_id"),
    }

    filters_ctx = {
        "start_date": filters["start_date"].isoformat() if filters["start_date"] else "",
        "end_date": filters["end_date"].isoformat() if filters["end_date"] else "",
        "status": filters["status"],
        "course_id": filters["course_id"],
        "guardian_id": filters["guardian_id"],
        "student_id": filters["student_id"],
    }

    alerts = await service.list_alerts(
        start_date=filters["start_date"],
        end_date=filters["end_date"],
        status=filters["status"],
        course_id=filters["course_id"],
        guardian_id=filters["guardian_id"],
        student_id=filters["student_id"],
    )

    courses = (await session.execute(select(Course))).scalars().all()
    guardians = (await session.execute(select(Guardian))).scalars().all()
    students = (await session.execute(select(Student))).scalars().all()

    summary = {
        "active": sum(1 for alert in alerts if alert.status == "PENDING"),
        "resolved_today": sum(
            1
            for alert in alerts
            if alert.status == "RESOLVED" and alert.resolved_at and alert.resolved_at.date() == date.today()
        ),
        "courses": len({alert.course_name for alert in alerts if alert.course_name}),
    }

    query_dict = {k: v for k, v in params.items() if v}
    export_url = "/api/v1/alerts/no-entry/export"
    if query_dict:
        export_url += f"?{urlencode(query_dict)}"

    context = {
        "request": request,
        "alerts": alerts,
        "summary": summary,
        "courses": courses,
        "guardians": guardians,
        "students": students,
        "filters": filters_ctx,
        "export_url": export_url,
        "current_user": user,
        "api_token": api_token,
    }
    return templates.TemplateResponse("alerts.html", context)


@web_router.get("/photos", response_class=HTMLResponse)
async def photos_page(
    request: Request, session: AsyncSession = Depends(deps.get_tenant_db)
) -> HTMLResponse:
    auth = await _require_staff_user(request, session)
    if isinstance(auth, RedirectResponse):
        return auth
    user, api_token = auth

    attendance_service = AttendanceService(session)
    events = await attendance_service.list_recent_photo_events()
    photo_events = []
    for event in events:
        student = getattr(event, "student", None)
        course = getattr(student, "course", None) if student else None
        photo_events.append(
            {
                "event": event,
                "student_name": getattr(student, "full_name", "Alumno"),
                "course_name": getattr(course, "name", "Curso"),
                "url": attendance_service.get_photo_url(event.photo_ref) if event.photo_ref else None,
            }
        )

    context = {
        "request": request,
        "photo_events": photo_events,
        "current_user": user,
        "api_token": api_token,
    }
    return templates.TemplateResponse("photos.html", context)

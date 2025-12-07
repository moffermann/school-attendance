"""Super Admin API module."""

from fastapi import APIRouter

from . import auth, config, tenants

super_admin_router = APIRouter(prefix="/super-admin", tags=["super-admin"])

super_admin_router.include_router(auth.router, prefix="/auth")
super_admin_router.include_router(tenants.router, prefix="/tenants")
super_admin_router.include_router(config.router, prefix="/tenants")

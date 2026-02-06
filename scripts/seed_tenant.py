#!/usr/bin/env python3
"""Seed tenant data parametrized by environment.

This script creates a demo tenant with test data, configured for the specific
environment (local, dev, qa, prod). It is idempotent and can be run multiple times safely.

Usage:
    python scripts/seed_tenant.py --env local
    python scripts/seed_tenant.py --env dev
    python scripts/seed_tenant.py --env qa
    python scripts/seed_tenant.py --env prod --force  # Requires SEED_DEMO_IN_PROD=true
    python scripts/seed_tenant.py --env dev --skip-historical  # Skip 30 days of events
    python scripts/seed_tenant.py --env dev --verbose  # Show detailed output

This script is intended to be called from appctl-postdeploy.sh hook.
"""

from __future__ import annotations

import argparse
import hashlib
import os
import random
import sys
from datetime import date, datetime, time, timedelta
from pathlib import Path
from typing import Any

# Add project root to path
ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))


# Environment-specific configuration
ENV_CONFIG = {
    "local": {
        "slug": "demo-local",
        "name": "Colegio Demo Local",
        "domain": "localhost",
        "subdomain": "demo-local",
        "email_suffix": "demo.example.com",  # Use valid TLD for email validation
        "schema": "tenant_demo_local",
        "plan": "enterprise",
        "max_students": 1000,
        "credentials_from_env": False,  # Uses dummy values
    },
    "dev": {
        "slug": "demo",
        "name": "Colegio Demo GoCode",
        "domain": "school-attendance.dev.gocode.cl",
        "subdomain": "demo",
        "email_suffix": "colegio-demo.cl",
        "schema": "tenant_demo",
        "plan": "enterprise",
        "max_students": 1000,
        "credentials_from_env": True,
    },
    "qa": {
        "slug": "demo-qa",
        "name": "Colegio Demo QA",
        "domain": "school-attendance.qa.gocode.cl",
        "subdomain": "demo-qa",
        "email_suffix": "colegio-demo-qa.cl",
        "schema": "tenant_demo_qa",
        "plan": "enterprise",
        "max_students": 1000,
        "credentials_from_env": True,
    },
    "prod": {
        "slug": "demo-prod",
        "name": "Colegio Demo Production",
        "domain": "school-attendance.gocode.cl",
        "subdomain": "demo-prod",
        "email_suffix": "colegio-demo-prod.cl",
        "schema": "tenant_demo_prod",
        "plan": "enterprise",
        "max_students": 1000,
        "credentials_from_env": True,
    },
}

# Credential environment variable mapping
CREDENTIAL_ENV_VARS = {
    "whatsapp_access_token": "WHATSAPP_ACCESS_TOKEN",
    "whatsapp_phone_number_id": "WHATSAPP_PHONE_NUMBER_ID",
    "ses_region": "SES_REGION",
    "ses_source_email": "SES_SOURCE_EMAIL",
    "ses_access_key": "SES_ACCESS_KEY",
    "ses_secret_key": "SES_SECRET_KEY",
    "device_api_key": "DEVICE_API_KEY",
    "s3_bucket": "S3_BUCKET",
}

# Default dummy credentials for local development
LOCAL_DUMMY_CREDENTIALS = {
    "whatsapp_access_token": "local-dummy-whatsapp-token",
    "whatsapp_phone_number_id": "123456789",
    "ses_region": "us-east-1",
    "ses_source_email": "no-reply@localhost",
    "ses_access_key": "local-dummy-access-key",
    "ses_secret_key": "local-dummy-secret-key",
    "device_api_key": "local-dev-device-key",
    "s3_bucket": "attendance-photos",
}

# Notification status distribution (must sum to 1.0)
NOTIFICATION_STATUS_DISTRIBUTION = {
    "delivered": 0.85,
    "pending": 0.05,
    "failed": 0.05,
    "retrying": 0.03,
    "bounced": 0.02,
}

# Absence request status distribution
ABSENCE_STATUS_DISTRIBUTION = {
    "APPROVED": 0.70,
    "REJECTED": 0.15,
    "PENDING": 0.15,
}

# Absence request types
ABSENCE_TYPES = ["MEDICAL", "FAMILY", "VACATION", "OTHER"]

# Tag status distribution
TAG_STATUS_DISTRIBUTION = {
    "ACTIVE": 0.90,
    "PENDING": 0.05,
    "REVOKED": 0.05,
}

# Push subscription rate (percentage of guardians with push)
PUSH_SUBSCRIPTION_RATE = 0.30

# NFC tag rate (percentage of active students with additional NFC tag)
NFC_TAG_RATE = 0.20

# Demo courses (same for all environments)
DEMO_COURSES = [
    {"id": 1, "name": "1° Básico A", "grade": "1° Básico"},
    {"id": 2, "name": "1° Básico B", "grade": "1° Básico"},
    {"id": 3, "name": "2° Básico A", "grade": "2° Básico"},
]

# Demo teachers (emails will be suffixed with env-specific domain)
DEMO_TEACHERS = [
    {"id": 1, "full_name": "María González López", "email_prefix": "maria.gonzalez", "can_enroll_biometric": True},
    {"id": 2, "full_name": "Pedro Ramírez Castro", "email_prefix": "pedro.ramirez", "can_enroll_biometric": True},
    {"id": 3, "full_name": "Carmen Silva Morales", "email_prefix": "carmen.silva", "can_enroll_biometric": False},
]

# Teacher-course assignments
TEACHER_COURSES = [
    {"teacher_id": 1, "course_id": 1},
    {"teacher_id": 2, "course_id": 2},
    {"teacher_id": 3, "course_id": 3},
]

# Demo students (60 total)
DEMO_STUDENTS = [
    {"id": 1, "full_name": "Martín González Pérez", "course_id": 1, "guardian_name": "Roberto González Silva", "photo_opt_in": True},
    {"id": 2, "full_name": "Sofía Rodríguez Muñoz", "course_id": 1, "guardian_name": "María Muñoz Tapia", "photo_opt_in": True},
    {"id": 3, "full_name": "Matías Silva Torres", "course_id": 1, "guardian_name": "Andrea Torres Rivas", "photo_opt_in": False},
    {"id": 4, "full_name": "Valentina López Hernández", "course_id": 1, "guardian_name": "Carmen Hernández López", "photo_opt_in": True},
    {"id": 5, "full_name": "Diego Fernández Castro", "course_id": 1, "guardian_name": "José Fernández Mora", "photo_opt_in": True},
    {"id": 6, "full_name": "Isidora Morales Riquelme", "course_id": 1, "guardian_name": "Patricia Riquelme Díaz", "photo_opt_in": False},
    {"id": 7, "full_name": "Benjamín Rojas Vargas", "course_id": 1, "guardian_name": "Felipe Rojas Contreras", "photo_opt_in": True},
    {"id": 8, "full_name": "Catalina Núñez Soto", "course_id": 1, "guardian_name": "Laura Soto Mendoza", "photo_opt_in": True},
    {"id": 9, "full_name": "Joaquín Parra Fuentes", "course_id": 1, "guardian_name": "Miguel Parra Rojas", "photo_opt_in": True},
    {"id": 10, "full_name": "Emilia Contreras Vega", "course_id": 1, "guardian_name": "Claudia Vega Pizarro", "photo_opt_in": False},
    {"id": 11, "full_name": "Gabriel Medina Bravo", "course_id": 2, "guardian_name": "Ricardo Medina Soto", "photo_opt_in": True},
    {"id": 12, "full_name": "Florencia Espinoza Rojas", "course_id": 2, "guardian_name": "Marcela Rojas Fuentes", "photo_opt_in": True},
    {"id": 13, "full_name": "Tomás Reyes Gutiérrez", "course_id": 2, "guardian_name": "Carlos Reyes Muñoz", "photo_opt_in": True},
    {"id": 14, "full_name": "Antonia Campos Díaz", "course_id": 2, "guardian_name": "Francisca Díaz Torres", "photo_opt_in": False},
    {"id": 15, "full_name": "Sebastián Muñoz Araya", "course_id": 2, "guardian_name": "Jorge Muñoz Pérez", "photo_opt_in": True},
    {"id": 16, "full_name": "Amanda Sánchez Peña", "course_id": 2, "guardian_name": "Verónica Peña Castro", "photo_opt_in": True},
    {"id": 17, "full_name": "Lucas Ramírez Pinto", "course_id": 2, "guardian_name": "Eduardo Ramírez Vega", "photo_opt_in": True},
    {"id": 18, "full_name": "Maite Castillo Ortiz", "course_id": 2, "guardian_name": "Isabel Ortiz Bravo", "photo_opt_in": False},
    {"id": 19, "full_name": "Vicente Vera Carrasco", "course_id": 2, "guardian_name": "Andrés Vera Morales", "photo_opt_in": True},
    {"id": 20, "full_name": "Josefa Alarcón Navarro", "course_id": 2, "guardian_name": "Lorena Navarro Silva", "photo_opt_in": True},
    {"id": 21, "full_name": "Cristóbal Pavez Lazo", "course_id": 3, "guardian_name": "Sergio Pavez Hernández", "photo_opt_in": True},
    {"id": 22, "full_name": "Trinidad Vargas Montes", "course_id": 3, "guardian_name": "Carolina Montes Rojas", "photo_opt_in": True},
    {"id": 23, "full_name": "Agustín Bustos Cárdenas", "course_id": 3, "guardian_name": "Pablo Bustos Torres", "photo_opt_in": False},
    {"id": 24, "full_name": "Renata Sepúlveda Ibarra", "course_id": 3, "guardian_name": "Mónica Ibarra Parra", "photo_opt_in": True},
    {"id": 25, "full_name": "Maximiliano Tapia Molina", "course_id": 3, "guardian_name": "Fernando Tapia Vargas", "photo_opt_in": True},
    {"id": 26, "full_name": "Colomba Guzmán Pizarro", "course_id": 3, "guardian_name": "Rosa Pizarro Soto", "photo_opt_in": True},
    {"id": 27, "full_name": "Nicolás Olivares Santana", "course_id": 3, "guardian_name": "Héctor Olivares Núñez", "photo_opt_in": False},
    {"id": 28, "full_name": "Ignacia Cabrera Lagos", "course_id": 3, "guardian_name": "Daniela Lagos Reyes", "photo_opt_in": True},
    {"id": 29, "full_name": "Felipe Herrera Escobar", "course_id": 3, "guardian_name": "Mario Herrera Campos", "photo_opt_in": True},
    {"id": 30, "full_name": "Martina Bravo Cortés", "course_id": 3, "guardian_name": "Alejandra Cortés Medina", "photo_opt_in": True},
    {"id": 31, "full_name": "Samuel Flores Garrido", "course_id": 1, "guardian_name": "Raúl Flores Espinoza", "photo_opt_in": True},
    {"id": 32, "full_name": "Julieta Maldonado Rivera", "course_id": 1, "guardian_name": "Sandra Rivera Castillo", "photo_opt_in": True},
    {"id": 33, "full_name": "Manuel Cortés Salinas", "course_id": 2, "guardian_name": "Oscar Cortés Vera", "photo_opt_in": False},
    {"id": 34, "full_name": "Constanza Figueroa Aravena", "course_id": 2, "guardian_name": "Gloria Aravena Alarcón", "photo_opt_in": True},
    {"id": 35, "full_name": "Bruno Valdés Miranda", "course_id": 3, "guardian_name": "Luis Valdés Pavez", "photo_opt_in": True},
    {"id": 36, "full_name": "Pascale Jara Parra", "course_id": 3, "guardian_name": "Cristina Parra Bustos", "photo_opt_in": True},
    {"id": 37, "full_name": "Dante Aguirre Palma", "course_id": 1, "guardian_name": "Gonzalo Aguirre Sepúlveda", "photo_opt_in": True},
    {"id": 38, "full_name": "Isabella Bustos Quiroz", "course_id": 1, "guardian_name": "Natalia Quiroz Tapia", "photo_opt_in": False},
    {"id": 39, "full_name": "Alonso Araya Carvajal", "course_id": 2, "guardian_name": "Mauricio Araya Guzmán", "photo_opt_in": True},
    {"id": 40, "full_name": "Rafaela Leiva Zamora", "course_id": 2, "guardian_name": "Teresa Zamora Olivares", "photo_opt_in": True},
    {"id": 41, "full_name": "Ian Sandoval Muñoz", "course_id": 3, "guardian_name": "Rodrigo Sandoval Cabrera", "photo_opt_in": True},
    {"id": 42, "full_name": "Elena Soto Ramos", "course_id": 3, "guardian_name": "Victoria Ramos Herrera", "photo_opt_in": True},
    {"id": 43, "full_name": "Rodrigo Peña González", "course_id": 1, "guardian_name": "Alberto Peña Bravo", "photo_opt_in": True},
    {"id": 44, "full_name": "Victoria Vidal Moya", "course_id": 1, "guardian_name": "Soledad Moya Flores", "photo_opt_in": False},
    {"id": 45, "full_name": "Eduardo Céspedes Lara", "course_id": 2, "guardian_name": "Patricio Céspedes Maldonado", "photo_opt_in": True},
    {"id": 46, "full_name": "Magdalena Ríos Fuentes", "course_id": 2, "guardian_name": "Beatriz Fuentes Cortés", "photo_opt_in": True},
    {"id": 47, "full_name": "Damián Ponce Valenzuela", "course_id": 3, "guardian_name": "Esteban Ponce Figueroa", "photo_opt_in": True},
    {"id": 48, "full_name": "Javiera Gallardo Mora", "course_id": 3, "guardian_name": "Paula Mora Valdés", "photo_opt_in": True},
    {"id": 49, "full_name": "Franco Beltrán Reyes", "course_id": 1, "guardian_name": "Javier Beltrán Jara", "photo_opt_in": True},
    {"id": 50, "full_name": "Amparo Jiménez Castro", "course_id": 1, "guardian_name": "Pilar Castro Aguirre", "photo_opt_in": False},
    {"id": 51, "full_name": "Lorenzo Carrasco Hidalgo", "course_id": 2, "guardian_name": "Tomás Carrasco Araya", "photo_opt_in": True},
    {"id": 52, "full_name": "Olivia Navarro Saavedra", "course_id": 2, "guardian_name": "Elena Saavedra Leiva", "photo_opt_in": True},
    {"id": 53, "full_name": "Esteban Guerrero Peña", "course_id": 3, "guardian_name": "Marco Guerrero Sandoval", "photo_opt_in": True},
    {"id": 54, "full_name": "Clemente Ortega Henríquez", "course_id": 3, "guardian_name": "Julio Ortega Soto", "photo_opt_in": True},
    {"id": 55, "full_name": "Camila Salazar Arce", "course_id": 1, "guardian_name": "Marisol Arce Peña", "photo_opt_in": True},
    {"id": 56, "full_name": "Luciano Briones Silva", "course_id": 2, "guardian_name": "Hugo Briones Vidal", "photo_opt_in": True},
    {"id": 57, "full_name": "Rosario Méndez Vega", "course_id": 3, "guardian_name": "Silvia Vega Céspedes", "photo_opt_in": False},
    {"id": 58, "full_name": "Emiliano Cáceres Torres", "course_id": 1, "guardian_name": "Fabián Cáceres Ríos", "photo_opt_in": True},
    {"id": 59, "full_name": "Mia Farías Rojas", "course_id": 2, "guardian_name": "Carla Rojas Ponce", "photo_opt_in": True},
    {"id": 60, "full_name": "Thiago León Carrasco", "course_id": 3, "guardian_name": "Nicolás León Gallardo", "photo_opt_in": True},
]

# Demo devices
DEMO_DEVICES = [
    {"device_id": "KIOSK-001", "gate_id": "GATE-PRINCIPAL", "firmware_version": "1.0.0"},
    {"device_id": "KIOSK-002", "gate_id": "GATE-SECUNDARIA", "firmware_version": "1.0.0"},
]

# Password hash for "Demo123!" (pbkdf2_sha256)
DEMO_PASSWORD_HASH = "$pbkdf2-sha256$29000$R0hJac05x7jXWmsN4ZxT6g$90ng37I7g3E6npxCMQ3pORoP007eKXzPekyka38XM/w"

# Historical data configuration
NUM_HISTORICAL_DAYS = 30
ATTENDANCE_RATE = 0.92
LATE_ARRIVAL_RATE = 0.10
EARLY_EXIT_RATE = 0.05
SCHOOL_ENTRY_TIME = time(8, 0)
SCHOOL_EXIT_TIME = time(16, 0)


def get_school_days(start_date: date, num_days: int, include_start: bool = True) -> list[date]:
    """Get list of school days (Monday-Friday, excluding weekends).

    Args:
        start_date: The starting date (usually today)
        num_days: Number of historical school days to include
        include_start: If True and start_date is a weekday, include it in addition to num_days

    Returns:
        Sorted list of school days from oldest to newest
    """
    school_days = []
    current = start_date

    # Include start_date if it's a weekday and include_start is True
    if include_start and current.weekday() < 5:
        school_days.append(current)
        current -= timedelta(days=1)

    # Collect num_days school days going backward
    while len(school_days) < num_days + (1 if include_start and start_date.weekday() < 5 else 0):
        if current.weekday() < 5:
            school_days.append(current)
        current -= timedelta(days=1)

    return sorted(school_days)


def random_entry_time(is_late: bool = False) -> time:
    """Generate realistic entry time."""
    if is_late:
        minutes_late = random.randint(16, 90)
        entry = datetime.combine(date.today(), SCHOOL_ENTRY_TIME) + timedelta(minutes=minutes_late)
    else:
        minutes_offset = random.randint(-30, 10)
        entry = datetime.combine(date.today(), SCHOOL_ENTRY_TIME) + timedelta(minutes=minutes_offset)
    return entry.time()


def random_exit_time(is_early: bool = False) -> time:
    """Generate realistic exit time."""
    if is_early:
        minutes_early = random.randint(30, 120)
        exit_dt = datetime.combine(date.today(), SCHOOL_EXIT_TIME) - timedelta(minutes=minutes_early)
    else:
        minutes_offset = random.randint(0, 30)
        exit_dt = datetime.combine(date.today(), SCHOOL_EXIT_TIME) + timedelta(minutes=minutes_offset)
    return exit_dt.time()


class TenantSeeder:
    """Seeds tenant data for a specific environment."""

    def __init__(self, env: str, skip_historical: bool = False, verbose: bool = False):
        if env not in ENV_CONFIG:
            raise ValueError(f"Unknown environment: {env}. Valid: {list(ENV_CONFIG.keys())}")

        self.env = env
        self.config = ENV_CONFIG[env]
        self.skip_historical = skip_historical
        self.verbose = verbose
        self.schema = self.config["schema"]
        self.email_suffix = self.config["email_suffix"]

        # Will be set after connection
        self.conn = None
        self.tenant_id = None

    def _get_credentials_from_env(self) -> dict[str, str | None]:
        """Get credentials from environment variables or use dummy values for local."""
        if not self.config.get("credentials_from_env", True):
            # Local environment - use dummy credentials
            return LOCAL_DUMMY_CREDENTIALS.copy()

        credentials = {}
        missing = []

        for key, env_var in CREDENTIAL_ENV_VARS.items():
            value = os.getenv(env_var)
            credentials[key] = value
            if not value and key not in ("ses_access_key", "ses_secret_key"):
                # SES keys are optional (can use IAM role)
                missing.append(env_var)

        if missing and self.verbose:
            print(f"  [WARN] Missing optional env vars: {', '.join(missing)}")

        return credentials

    def _validate_production_seed(self) -> None:
        """Validate that production seeding is intentional."""
        if self.env == "prod":
            if os.getenv("SEED_DEMO_IN_PROD") != "true":
                raise ValueError(
                    "Cannot seed demo data in production without explicit confirmation.\n"
                    "Set SEED_DEMO_IN_PROD=true environment variable to proceed."
                )

    def seed(self) -> None:
        """Run the complete seed process."""
        import asyncio

        # Validate production seed if applicable
        self._validate_production_seed()

        asyncio.run(self._seed_async())

    async def _seed_async(self) -> None:
        """Async seed implementation."""
        from sqlalchemy import text
        from app.db.session import async_session

        async with async_session() as session:
            self.conn = session

            print(f"\n{'='*60}")
            print(f"Seeding tenant for environment: {self.env}")
            print(f"  Slug: {self.config['slug']}")
            print(f"  Domain: {self.config['domain']}")
            print(f"  Schema: {self.schema}")
            print(f"  Email suffix: @{self.email_suffix}")
            print(f"  Credentials from env: {self.config.get('credentials_from_env', True)}")
            print(f"{'='*60}\n")

            # Check if tenant already exists
            result = await session.execute(
                text("SELECT id FROM public.tenants WHERE slug = :slug"),
                {"slug": self.config["slug"]}
            )
            existing = result.scalar()

            if existing:
                print(f"Tenant '{self.config['slug']}' already exists (id={existing})")
                print("Updating configuration and refreshing data...\n")
                self.tenant_id = existing
            else:
                print("Creating new tenant...\n")

            # 1. Create/update tenant in public schema
            await self._seed_tenant()

            # 2. Seed tenant config with credentials
            await self._seed_tenant_config()

            # 3. Create tenant schema and tables
            await self._create_schema()

            # 4. Seed base data (courses, teachers, students, etc.)
            await self._seed_base_data()

            # 5. Seed tags with various states
            await self._seed_tags_with_states()

            # 6. Seed push subscriptions
            await self._seed_push_subscriptions()

            # 7. Seed historical data (attendance events, notifications, etc.)
            if not self.skip_historical:
                await self._seed_historical_data()
            else:
                print("Skipping historical data (--skip-historical flag)")

            # 8. Seed absence requests with various states
            await self._seed_absence_requests()

            await session.commit()

            print(f"\n{'='*60}")
            print(f"[SUCCESS] Tenant seed complete for {self.env}!")
            print(f"{'='*60}\n")

    async def _seed_tenant(self) -> None:
        """Create or update tenant in public schema."""
        from sqlalchemy import text

        print("Creating/updating tenant record...")

        # Create super admin if not exists
        await self.conn.execute(
            text("""
                INSERT INTO public.super_admins (email, full_name, hashed_password, is_active)
                VALUES (:email, :full_name, :hashed_password, true)
                ON CONFLICT (email) DO NOTHING
            """),
            {
                "email": "admin@gocode.cl",
                "full_name": "Super Admin GoCode",
                "hashed_password": DEMO_PASSWORD_HASH,
            }
        )

        # Create/update tenant
        await self.conn.execute(
            text("""
                INSERT INTO public.tenants (slug, name, domain, subdomain, is_active, plan, max_students, config)
                VALUES (:slug, :name, :domain, :subdomain, true, :plan, :max_students, '{}')
                ON CONFLICT (slug) DO UPDATE SET
                    name = EXCLUDED.name,
                    domain = EXCLUDED.domain,
                    subdomain = EXCLUDED.subdomain,
                    plan = EXCLUDED.plan,
                    max_students = EXCLUDED.max_students
            """),
            self.config
        )

        # Get tenant ID
        result = await self.conn.execute(
            text("SELECT id FROM public.tenants WHERE slug = :slug"),
            {"slug": self.config["slug"]}
        )
        self.tenant_id = result.scalar()

        # Create tenant config
        await self.conn.execute(
            text("""
                INSERT INTO public.tenant_configs (tenant_id, ses_region)
                VALUES (:tenant_id, 'us-east-1')
                ON CONFLICT (tenant_id) DO NOTHING
            """),
            {"tenant_id": self.tenant_id}
        )

        # Enable all features
        features = [
            "whatsapp_notifications", "email_notifications", "photo_capture",
            "audio_capture", "webauthn_biometric", "parent_portal",
            "teacher_pwa", "api_access",
        ]
        for feature in features:
            await self.conn.execute(
                text("""
                    INSERT INTO public.tenant_features (tenant_id, feature_name, is_enabled, config)
                    VALUES (:tenant_id, :feature_name, true, '{}')
                    ON CONFLICT ON CONSTRAINT uq_tenant_feature DO NOTHING
                """),
                {"tenant_id": self.tenant_id, "feature_name": feature}
            )

        print(f"  [OK] Tenant '{self.config['slug']}' configured (id={self.tenant_id})")

    async def _seed_tenant_config(self) -> None:
        """Seed tenant configuration with credentials (encrypted for sensitive values)."""
        from sqlalchemy import text
        from app.core.encryption import encrypt_if_present

        print("Configuring tenant credentials...")

        credentials = self._get_credentials_from_env()

        # Encrypt sensitive credentials
        encrypted_whatsapp_token = encrypt_if_present(credentials.get("whatsapp_access_token"))
        encrypted_ses_access_key = encrypt_if_present(credentials.get("ses_access_key"))
        encrypted_ses_secret_key = encrypt_if_present(credentials.get("ses_secret_key"))
        encrypted_device_key = encrypt_if_present(credentials.get("device_api_key"))

        # Update tenant_configs with credentials (using correct column names with _encrypted suffix)
        await self.conn.execute(
            text("""
                UPDATE public.tenant_configs SET
                    whatsapp_access_token_encrypted = :whatsapp_token,
                    whatsapp_phone_number_id = :whatsapp_phone_id,
                    ses_region = :ses_region,
                    ses_source_email = :ses_source_email,
                    ses_access_key_encrypted = :ses_access_key,
                    ses_secret_key_encrypted = :ses_secret_key,
                    device_api_key_encrypted = :device_api_key,
                    s3_bucket = :s3_bucket,
                    updated_at = NOW()
                WHERE tenant_id = :tenant_id
            """),
            {
                "tenant_id": self.tenant_id,
                "whatsapp_token": encrypted_whatsapp_token,
                "whatsapp_phone_id": credentials.get("whatsapp_phone_number_id"),
                "ses_region": credentials.get("ses_region", "us-east-1"),
                "ses_source_email": credentials.get("ses_source_email"),
                "ses_access_key": encrypted_ses_access_key,
                "ses_secret_key": encrypted_ses_secret_key,
                "device_api_key": encrypted_device_key,
                "s3_bucket": credentials.get("s3_bucket"),
            }
        )

        source = "environment variables" if self.config.get("credentials_from_env", True) else "dummy values"
        print(f"  [OK] Tenant credentials configured from {source}")

    async def _create_schema(self) -> None:
        """Create tenant schema and tables."""
        from sqlalchemy import text

        print(f"Creating schema '{self.schema}'...")

        # Create schema
        await self.conn.execute(text(f"CREATE SCHEMA IF NOT EXISTS {self.schema}"))

        # Create all tables (DDL from migration 0011)
        tables_sql = self._get_tables_ddl()
        for sql in tables_sql:
            await self.conn.execute(text(sql))

        print(f"  [OK] Schema '{self.schema}' ready")

    def _get_tables_ddl(self) -> list[str]:
        """Get DDL statements for tenant tables."""
        schema = self.schema
        return [
            f"""CREATE TABLE IF NOT EXISTS {schema}.courses (
                id SERIAL PRIMARY KEY,
                name VARCHAR(128) NOT NULL,
                grade VARCHAR(32) NOT NULL,
                status VARCHAR(32) DEFAULT 'ACTIVE',
                created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
                updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
            )""",
            f"""CREATE TABLE IF NOT EXISTS {schema}.guardians (
                id SERIAL PRIMARY KEY,
                full_name VARCHAR(255) NOT NULL,
                contacts JSONB DEFAULT '{{}}',
                notification_prefs JSONB DEFAULT '{{}}'
            )""",
            f"""CREATE TABLE IF NOT EXISTS {schema}.students (
                id SERIAL PRIMARY KEY,
                full_name VARCHAR(255) NOT NULL,
                course_id INTEGER NOT NULL REFERENCES {schema}.courses(id),
                status VARCHAR(32) DEFAULT 'ACTIVE',
                qr_code_hash VARCHAR(128),
                photo_pref_opt_in BOOLEAN DEFAULT false,
                evidence_preference VARCHAR(16) DEFAULT 'none'
            )""",
            f"CREATE INDEX IF NOT EXISTS idx_students_course ON {schema}.students(course_id)",
            f"CREATE INDEX IF NOT EXISTS idx_students_status ON {schema}.students(status)",
            f"""CREATE TABLE IF NOT EXISTS {schema}.teachers (
                id SERIAL PRIMARY KEY,
                full_name VARCHAR(255) NOT NULL,
                email VARCHAR(255) UNIQUE,
                status VARCHAR(32) DEFAULT 'ACTIVE',
                can_enroll_biometric BOOLEAN DEFAULT false
            )""",
            f"""CREATE TABLE IF NOT EXISTS {schema}.users (
                id SERIAL PRIMARY KEY,
                email VARCHAR(255) NOT NULL UNIQUE,
                full_name VARCHAR(255) NOT NULL,
                role VARCHAR(32) NOT NULL,
                hashed_password VARCHAR(255) NOT NULL,
                is_active BOOLEAN DEFAULT true,
                guardian_id INTEGER REFERENCES {schema}.guardians(id),
                teacher_id INTEGER REFERENCES {schema}.teachers(id)
            )""",
            f"CREATE INDEX IF NOT EXISTS idx_users_email ON {schema}.users(email)",
            f"""CREATE TABLE IF NOT EXISTS {schema}.devices (
                id SERIAL PRIMARY KEY,
                device_id VARCHAR(64) NOT NULL UNIQUE,
                gate_id VARCHAR(64) NOT NULL,
                firmware_version VARCHAR(32) NOT NULL,
                battery_pct INTEGER DEFAULT 100,
                pending_events INTEGER DEFAULT 0,
                online BOOLEAN DEFAULT true,
                last_sync TIMESTAMP WITH TIME ZONE
            )""",
            f"""CREATE TABLE IF NOT EXISTS {schema}.tags (
                id SERIAL PRIMARY KEY,
                student_id INTEGER NOT NULL REFERENCES {schema}.students(id),
                tag_token_hash VARCHAR(128) NOT NULL UNIQUE,
                tag_token_preview VARCHAR(16) NOT NULL,
                tag_uid VARCHAR(64),
                status VARCHAR(32) DEFAULT 'PENDING',
                created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
                revoked_at TIMESTAMP WITH TIME ZONE
            )""",
            f"CREATE INDEX IF NOT EXISTS idx_tags_student ON {schema}.tags(student_id)",
            f"CREATE INDEX IF NOT EXISTS idx_tags_preview ON {schema}.tags(tag_token_preview)",
            f"CREATE INDEX IF NOT EXISTS idx_tags_status ON {schema}.tags(status)",
            f"""CREATE TABLE IF NOT EXISTS {schema}.student_guardians (
                student_id INTEGER NOT NULL REFERENCES {schema}.students(id),
                guardian_id INTEGER NOT NULL REFERENCES {schema}.guardians(id),
                PRIMARY KEY (student_id, guardian_id)
            )""",
            f"""CREATE TABLE IF NOT EXISTS {schema}.teacher_courses (
                teacher_id INTEGER NOT NULL REFERENCES {schema}.teachers(id),
                course_id INTEGER NOT NULL REFERENCES {schema}.courses(id),
                PRIMARY KEY (teacher_id, course_id)
            )""",
            f"""CREATE TABLE IF NOT EXISTS {schema}.enrollments (
                id SERIAL PRIMARY KEY,
                student_id INTEGER NOT NULL REFERENCES {schema}.students(id),
                course_id INTEGER NOT NULL REFERENCES {schema}.courses(id),
                year INTEGER NOT NULL,
                created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
            )""",
            """DO $$ BEGIN
                CREATE TYPE attendance_type AS ENUM ('IN', 'OUT');
            EXCEPTION
                WHEN duplicate_object THEN NULL;
            END $$;""",
            f"""CREATE TABLE IF NOT EXISTS {schema}.attendance_events (
                id SERIAL PRIMARY KEY,
                student_id INTEGER NOT NULL REFERENCES {schema}.students(id),
                type attendance_type NOT NULL,
                gate_id VARCHAR(64) NOT NULL,
                device_id VARCHAR(64) NOT NULL,
                occurred_at TIMESTAMP WITH TIME ZONE NOT NULL,
                local_seq INTEGER,
                photo_ref VARCHAR(512),
                audio_ref VARCHAR(512),
                synced_at TIMESTAMP WITH TIME ZONE
            )""",
            f"CREATE INDEX IF NOT EXISTS idx_events_student ON {schema}.attendance_events(student_id)",
            f"CREATE INDEX IF NOT EXISTS idx_events_device ON {schema}.attendance_events(device_id)",
            f"CREATE INDEX IF NOT EXISTS idx_events_occurred ON {schema}.attendance_events(occurred_at)",
            f"""CREATE TABLE IF NOT EXISTS {schema}.absence_requests (
                id SERIAL PRIMARY KEY,
                student_id INTEGER NOT NULL REFERENCES {schema}.students(id),
                type VARCHAR(32) NOT NULL,
                start_date DATE NOT NULL,
                end_date DATE NOT NULL,
                comment TEXT,
                attachment_ref VARCHAR(512),
                status VARCHAR(32) DEFAULT 'PENDING',
                approver_id INTEGER REFERENCES {schema}.guardians(id),
                ts_submitted TIMESTAMP WITH TIME ZONE NOT NULL,
                ts_resolved TIMESTAMP WITH TIME ZONE
            )""",
            f"CREATE INDEX IF NOT EXISTS idx_absence_student ON {schema}.absence_requests(student_id)",
            f"CREATE INDEX IF NOT EXISTS idx_absence_start ON {schema}.absence_requests(start_date)",
            f"CREATE INDEX IF NOT EXISTS idx_absence_end ON {schema}.absence_requests(end_date)",
            f"CREATE INDEX IF NOT EXISTS idx_absence_status ON {schema}.absence_requests(status)",
            f"""CREATE TABLE IF NOT EXISTS {schema}.notifications (
                id SERIAL PRIMARY KEY,
                event_id INTEGER REFERENCES {schema}.attendance_events(id),
                guardian_id INTEGER NOT NULL REFERENCES {schema}.guardians(id),
                channel VARCHAR(32) NOT NULL,
                template VARCHAR(64) NOT NULL,
                payload JSONB DEFAULT '{{}}',
                status VARCHAR(32) NOT NULL DEFAULT 'pending',
                ts_created TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
                ts_sent TIMESTAMP WITH TIME ZONE,
                retries INTEGER DEFAULT 0
            )""",
            f"CREATE INDEX IF NOT EXISTS idx_notif_event ON {schema}.notifications(event_id)",
            f"CREATE INDEX IF NOT EXISTS idx_notif_guardian ON {schema}.notifications(guardian_id)",
            f"CREATE INDEX IF NOT EXISTS idx_notif_status ON {schema}.notifications(status)",
            f"CREATE INDEX IF NOT EXISTS idx_notif_created ON {schema}.notifications(ts_created)",
            f"CREATE INDEX IF NOT EXISTS idx_notif_sent ON {schema}.notifications(ts_sent)",
            f"""CREATE TABLE IF NOT EXISTS {schema}.schedules (
                id SERIAL PRIMARY KEY,
                course_id INTEGER NOT NULL REFERENCES {schema}.courses(id),
                weekday SMALLINT NOT NULL,
                in_time TIME NOT NULL,
                out_time TIME NOT NULL
            )""",
            f"""CREATE TABLE IF NOT EXISTS {schema}.schedule_exceptions (
                id SERIAL PRIMARY KEY,
                scope VARCHAR(16) NOT NULL,
                course_id INTEGER REFERENCES {schema}.courses(id),
                date DATE NOT NULL,
                in_time TIME,
                out_time TIME,
                reason VARCHAR(255) NOT NULL,
                created_by INTEGER
            )""",
            f"""CREATE TABLE IF NOT EXISTS {schema}.no_show_alerts (
                id SERIAL PRIMARY KEY,
                student_id INTEGER NOT NULL REFERENCES {schema}.students(id),
                guardian_id INTEGER NOT NULL REFERENCES {schema}.guardians(id),
                course_id INTEGER NOT NULL REFERENCES {schema}.courses(id),
                schedule_id INTEGER REFERENCES {schema}.schedules(id),
                alert_date DATE NOT NULL,
                alerted_at TIMESTAMP WITH TIME ZONE NOT NULL,
                status VARCHAR(16) NOT NULL DEFAULT 'PENDING',
                resolved_at TIMESTAMP WITH TIME ZONE,
                notes VARCHAR(512),
                notification_attempts INTEGER DEFAULT 0,
                last_notification_at TIMESTAMP WITH TIME ZONE,
                UNIQUE(student_id, guardian_id, alert_date)
            )""",
            f"""CREATE TABLE IF NOT EXISTS {schema}.consents (
                id SERIAL PRIMARY KEY,
                guardian_id INTEGER NOT NULL REFERENCES {schema}.guardians(id),
                consent_type VARCHAR(32) NOT NULL,
                is_granted BOOLEAN DEFAULT false,
                granted_at TIMESTAMP WITH TIME ZONE,
                revoked_at TIMESTAMP WITH TIME ZONE
            )""",
            f"""CREATE TABLE IF NOT EXISTS {schema}.audit_logs (
                id SERIAL PRIMARY KEY,
                user_id INTEGER,
                action VARCHAR(64) NOT NULL,
                entity VARCHAR(64),
                entity_id INTEGER,
                details JSONB DEFAULT '{{}}',
                ip_address VARCHAR(45),
                created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
            )""",
            f"""CREATE TABLE IF NOT EXISTS {schema}.webauthn_credentials (
                id SERIAL PRIMARY KEY,
                student_id INTEGER REFERENCES {schema}.students(id),
                user_id INTEGER REFERENCES {schema}.users(id),
                credential_id VARCHAR(255) NOT NULL UNIQUE,
                public_key BYTEA NOT NULL,
                sign_count INTEGER DEFAULT 0,
                device_type VARCHAR(64),
                backed_up BOOLEAN DEFAULT false,
                transports JSONB DEFAULT '[]',
                created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
                last_used_at TIMESTAMP WITH TIME ZONE
            )""",
        ]

    async def _seed_base_data(self) -> None:
        """Seed base data: courses, teachers, students, users."""
        from sqlalchemy import text

        print("Seeding base data...")

        # Clear existing data (for idempotency)
        await self._clear_data()

        # Courses
        for course in DEMO_COURSES:
            await self.conn.execute(
                text(f"""
                    INSERT INTO {self.schema}.courses (id, name, grade, status, created_at, updated_at)
                    VALUES (:id, :name, :grade, 'ACTIVE', NOW(), NOW())
                    ON CONFLICT (id) DO NOTHING
                """),
                course
            )
        await self.conn.execute(text(f"SELECT setval('{self.schema}.courses_id_seq', 10, true)"))
        print(f"  [OK] {len(DEMO_COURSES)} courses")

        # Teachers (with environment-specific emails)
        for teacher in DEMO_TEACHERS:
            email = f"{teacher['email_prefix']}@{self.email_suffix}"
            await self.conn.execute(
                text(f"""
                    INSERT INTO {self.schema}.teachers (id, full_name, email, status, can_enroll_biometric)
                    VALUES (:id, :full_name, :email, 'ACTIVE', :can_enroll_biometric)
                    ON CONFLICT (id) DO NOTHING
                """),
                {
                    "id": teacher["id"],
                    "full_name": teacher["full_name"],
                    "email": email,
                    "can_enroll_biometric": teacher["can_enroll_biometric"],
                }
            )
        await self.conn.execute(text(f"SELECT setval('{self.schema}.teachers_id_seq', 10, true)"))
        print(f"  [OK] {len(DEMO_TEACHERS)} teachers")

        # Teacher-course assignments
        for tc in TEACHER_COURSES:
            await self.conn.execute(
                text(f"""
                    INSERT INTO {self.schema}.teacher_courses (teacher_id, course_id)
                    VALUES (:teacher_id, :course_id)
                    ON CONFLICT DO NOTHING
                """),
                tc
            )

        # Guardians and Students
        guardian_id = 1
        for student in DEMO_STUDENTS:
            # Create guardian
            await self.conn.execute(
                text(f"""
                    INSERT INTO {self.schema}.guardians (id, full_name, contacts, notification_prefs)
                    VALUES (:id, :full_name,
                            '{{"phone": "+56912345678", "email": "apoderado@example.com"}}',
                            '{{"INGRESO_OK": {{"whatsapp": true}}, "SALIDA_OK": {{"whatsapp": true}}}}')
                    ON CONFLICT (id) DO NOTHING
                """),
                {"id": guardian_id, "full_name": student["guardian_name"]}
            )

            # Create student
            evidence_pref = "photo" if student["photo_opt_in"] else "none"
            await self.conn.execute(
                text(f"""
                    INSERT INTO {self.schema}.students (id, full_name, course_id, status, photo_pref_opt_in, evidence_preference)
                    VALUES (:id, :full_name, :course_id, 'ACTIVE', :photo_opt_in, :evidence_pref)
                    ON CONFLICT (id) DO NOTHING
                """),
                {
                    "id": student["id"],
                    "full_name": student["full_name"],
                    "course_id": student["course_id"],
                    "photo_opt_in": student["photo_opt_in"],
                    "evidence_pref": evidence_pref,
                }
            )

            # Link student to guardian
            await self.conn.execute(
                text(f"""
                    INSERT INTO {self.schema}.student_guardians (student_id, guardian_id)
                    VALUES (:student_id, :guardian_id)
                    ON CONFLICT DO NOTHING
                """),
                {"student_id": student["id"], "guardian_id": guardian_id}
            )

            guardian_id += 1

        await self.conn.execute(text(f"SELECT setval('{self.schema}.guardians_id_seq', 100, true)"))
        await self.conn.execute(text(f"SELECT setval('{self.schema}.students_id_seq', 100, true)"))
        print(f"  [OK] {len(DEMO_STUDENTS)} students with guardians")

        # Users (with environment-specific emails)
        demo_users = [
            {"email_prefix": "director", "full_name": "Director Demo", "role": "ADMIN", "teacher_id": None},
            {"email_prefix": "inspector", "full_name": "Inspector Demo", "role": "INSPECTOR", "teacher_id": None},
        ]
        # Add teachers as users
        for teacher in DEMO_TEACHERS:
            demo_users.append({
                "email_prefix": teacher["email_prefix"],
                "full_name": teacher["full_name"],
                "role": "TEACHER",
                "teacher_id": teacher["id"],
            })

        user_id = 1
        for user in demo_users:
            email = f"{user['email_prefix']}@{self.email_suffix}"
            await self.conn.execute(
                text(f"""
                    INSERT INTO {self.schema}.users (id, email, full_name, role, hashed_password, is_active, teacher_id)
                    VALUES (:id, :email, :full_name, :role, :password, true, :teacher_id)
                    ON CONFLICT (email) DO NOTHING
                """),
                {
                    "id": user_id,
                    "email": email,
                    "full_name": user["full_name"],
                    "role": user["role"],
                    "password": DEMO_PASSWORD_HASH,
                    "teacher_id": user["teacher_id"],
                }
            )
            user_id += 1

        # Parent users (first 5 guardians)
        for i in range(1, 6):
            email = f"apoderado{i}@{self.email_suffix}"
            await self.conn.execute(
                text(f"""
                    INSERT INTO {self.schema}.users (id, email, full_name, role, hashed_password, is_active, guardian_id)
                    VALUES (:id, :email, :full_name, 'PARENT', :password, true, :guardian_id)
                    ON CONFLICT (email) DO NOTHING
                """),
                {
                    "id": user_id,
                    "email": email,
                    "full_name": DEMO_STUDENTS[i - 1]["guardian_name"],
                    "password": DEMO_PASSWORD_HASH,
                    "guardian_id": i,
                }
            )
            user_id += 1

        await self.conn.execute(text(f"SELECT setval('{self.schema}.users_id_seq', 100, true)"))
        print(f"  [OK] {user_id - 1} users")

        # Devices
        for device in DEMO_DEVICES:
            await self.conn.execute(
                text(f"""
                    INSERT INTO {self.schema}.devices (device_id, gate_id, firmware_version, online)
                    VALUES (:device_id, :gate_id, :firmware_version, true)
                    ON CONFLICT (device_id) DO NOTHING
                """),
                device
            )
        print(f"  [OK] {len(DEMO_DEVICES)} devices")

        # Schedules (Monday-Friday, 8:00-16:00)
        for course_id in [1, 2, 3]:
            for day in range(1, 6):
                await self.conn.execute(
                    text(f"""
                        INSERT INTO {self.schema}.schedules (course_id, weekday, in_time, out_time)
                        VALUES (:course_id, :day, '08:00', '16:00')
                        ON CONFLICT DO NOTHING
                    """),
                    {"course_id": course_id, "day": day}
                )
        print("  [OK] Schedules configured")

        # Note: Tags are seeded separately in _seed_tags_with_states()

        # Enrollments
        current_year = date.today().year
        for student in DEMO_STUDENTS:
            await self.conn.execute(
                text(f"""
                    INSERT INTO {self.schema}.enrollments (student_id, course_id, year, created_at)
                    VALUES (:student_id, :course_id, :year, NOW())
                    ON CONFLICT DO NOTHING
                """),
                {
                    "student_id": student["id"],
                    "course_id": student["course_id"],
                    "year": current_year,
                }
            )
        print(f"  [OK] Enrollments for year {current_year}")

    async def _clear_data(self) -> None:
        """Clear existing transactional data for idempotency."""
        from sqlalchemy import text

        # Only clear transactional data, not structure
        # Order matters due to foreign key constraints (notifications -> attendance_events)
        tables_to_clear = [
            "notifications",        # FK to attendance_events
            "no_show_alerts",       # FK to students, guardians, courses
            "attendance_events",    # FK to students
            "absence_requests",     # FK to students
            "schedule_exceptions",  # FK to courses
            "push_subscriptions",   # FK to users (if exists)
            "webauthn_credentials", # FK to students, users
            "tags",                 # FK to students
            "audit_logs",           # No critical FKs
            "consents",             # FK to guardians
            "users",                # FK to guardians, teachers
            "enrollments",          # FK to students, courses
            "student_guardians",    # FK to students, guardians
            "students",             # FK to courses
            "guardians",            # No FKs
            "teacher_courses",      # FK to teachers, courses
            "teachers",             # No FKs
            "schedules",            # FK to courses
            "devices",              # No FKs
            "courses",              # No FKs
        ]

        # Check which tables exist first to avoid transaction abort
        result = await self.conn.execute(
            text("""
                SELECT table_name FROM information_schema.tables
                WHERE table_schema = :schema
            """),
            {"schema": self.schema}
        )
        existing_tables = {row[0] for row in result.fetchall()}

        for table in tables_to_clear:
            if table in existing_tables:
                await self.conn.execute(text(f"DELETE FROM {self.schema}.{table}"))

    async def _seed_tags_with_states(self) -> None:
        """Seed QR and NFC tags with various states."""
        from sqlalchemy import text

        print("\nSeeding tags with various states...")

        qr_count = 0
        nfc_count = 0
        status_counts = {"ACTIVE": 0, "PENDING": 0, "REVOKED": 0}

        for student in DEMO_STUDENTS:
            # Determine status based on distribution
            rand = random.random()
            cumulative = 0.0
            status = "ACTIVE"
            for s, prob in TAG_STATUS_DISTRIBUTION.items():
                cumulative += prob
                if rand < cumulative:
                    status = s
                    break

            # Create QR tag
            token = f"QR-{student['id']:04d}-{self.config['slug'].upper()}"
            token_hash = hashlib.sha256(token.encode()).hexdigest()

            revoked_at = None
            if status == "REVOKED":
                revoked_at = datetime.now() - timedelta(days=random.randint(1, 30))

            days_ago = random.randint(30, 180)
            await self.conn.execute(
                text(f"""
                    INSERT INTO {self.schema}.tags
                    (student_id, tag_token_hash, tag_token_preview, tag_uid, status, created_at, revoked_at)
                    VALUES (:student_id, :token_hash, :token_preview, NULL, :status,
                            NOW() - INTERVAL '1 day' * :days, :revoked_at)
                    ON CONFLICT (tag_token_hash) DO UPDATE SET status = :status, revoked_at = :revoked_at
                """),
                {
                    "student_id": student["id"],
                    "token_hash": token_hash,
                    "token_preview": token[:8],
                    "status": status,
                    "days": days_ago,
                    "revoked_at": revoked_at,
                }
            )
            qr_count += 1
            status_counts[status] += 1

            # Add NFC tag for some active students
            if status == "ACTIVE" and random.random() < NFC_TAG_RATE:
                nfc_uid = f"NFC-{student['id']:04d}-{random.randint(1000, 9999)}"
                nfc_token = f"NFC-{nfc_uid}"
                nfc_hash = hashlib.sha256(nfc_token.encode()).hexdigest()
                nfc_days_ago = random.randint(1, 60)

                await self.conn.execute(
                    text(f"""
                        INSERT INTO {self.schema}.tags
                        (student_id, tag_token_hash, tag_token_preview, tag_uid, status, created_at)
                        VALUES (:student_id, :token_hash, :token_preview, :tag_uid, 'ACTIVE',
                                NOW() - INTERVAL '1 day' * :days)
                        ON CONFLICT (tag_token_hash) DO NOTHING
                    """),
                    {
                        "student_id": student["id"],
                        "token_hash": nfc_hash,
                        "token_preview": nfc_token[:8],
                        "tag_uid": nfc_uid,
                        "days": nfc_days_ago,
                    }
                )
                nfc_count += 1

        print(f"  [OK] {qr_count} QR tags (ACTIVE: {status_counts['ACTIVE']}, "
              f"PENDING: {status_counts['PENDING']}, REVOKED: {status_counts['REVOKED']})")
        print(f"  [OK] {nfc_count} NFC tags (additional)")

    async def _seed_push_subscriptions(self) -> None:
        """Seed push subscriptions for some guardians."""
        from sqlalchemy import text

        print("\nSeeding push subscriptions...")

        # Check if push_subscriptions table exists using information_schema (avoids transaction abort)
        result = await self.conn.execute(
            text("""
                SELECT EXISTS (
                    SELECT 1 FROM information_schema.tables
                    WHERE table_schema = :schema AND table_name = 'push_subscriptions'
                )
            """),
            {"schema": self.schema}
        )
        table_exists = result.scalar()

        if not table_exists:
            # Table doesn't exist, create it
            await self.conn.execute(text(f"""
                CREATE TABLE IF NOT EXISTS {self.schema}.push_subscriptions (
                    id SERIAL PRIMARY KEY,
                    user_id INTEGER NOT NULL REFERENCES {self.schema}.users(id),
                    endpoint VARCHAR(512) NOT NULL UNIQUE,
                    p256dh VARCHAR(255) NOT NULL,
                    auth VARCHAR(255) NOT NULL,
                    user_agent VARCHAR(512),
                    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
                    last_used_at TIMESTAMP WITH TIME ZONE
                )
            """))

        # Get parent users (users with guardian_id set)
        result = await self.conn.execute(
            text(f"SELECT id, guardian_id FROM {self.schema}.users WHERE guardian_id IS NOT NULL")
        )
        parent_users = result.fetchall()

        subscription_count = 0
        for user_id, guardian_id in parent_users:
            if random.random() < PUSH_SUBSCRIPTION_RATE:
                # Create a mock push subscription
                endpoint = f"https://fcm.googleapis.com/fcm/send/{guardian_id}-{random.randint(10000, 99999)}"
                p256dh = hashlib.sha256(f"p256dh-{user_id}-{random.random()}".encode()).hexdigest()[:86]
                auth = hashlib.sha256(f"auth-{user_id}-{random.random()}".encode()).hexdigest()[:22]

                days_ago = random.randint(7, 90)
                last_days_ago = random.randint(0, 7)
                await self.conn.execute(
                    text(f"""
                        INSERT INTO {self.schema}.push_subscriptions
                        (user_id, endpoint, p256dh, auth, user_agent, created_at, last_used_at)
                        VALUES (:user_id, :endpoint, :p256dh, :auth, :user_agent,
                                NOW() - INTERVAL '1 day' * :days, NOW() - INTERVAL '1 day' * :last_days)
                        ON CONFLICT (endpoint) DO NOTHING
                    """),
                    {
                        "user_id": user_id,
                        "endpoint": endpoint,
                        "p256dh": p256dh,
                        "auth": auth,
                        "user_agent": "Mozilla/5.0 (Demo Browser)",
                        "days": days_ago,
                        "last_days": last_days_ago,
                    }
                )
                subscription_count += 1

        print(f"  [OK] {subscription_count} push subscriptions ({PUSH_SUBSCRIPTION_RATE*100:.0f}% of parents)")

    async def _seed_absence_requests(self) -> None:
        """Seed absence requests with various states and types."""
        from sqlalchemy import text

        print("\nSeeding absence requests...")

        # Get students and their guardians
        result = await self.conn.execute(
            text(f"""
                SELECT s.id as student_id, sg.guardian_id
                FROM {self.schema}.students s
                JOIN {self.schema}.student_guardians sg ON s.id = sg.student_id
            """)
        )
        student_guardians = result.fetchall()

        # Create some absence requests
        num_requests = min(len(student_guardians), 30)  # Up to 30 requests
        selected = random.sample(student_guardians, num_requests)

        status_counts = {"APPROVED": 0, "REJECTED": 0, "PENDING": 0}
        type_counts = {t: 0 for t in ABSENCE_TYPES}

        today = date.today()

        for student_id, guardian_id in selected:
            # Determine status
            rand = random.random()
            cumulative = 0.0
            status = "PENDING"
            for s, prob in ABSENCE_STATUS_DISTRIBUTION.items():
                cumulative += prob
                if rand < cumulative:
                    status = s
                    break

            # Determine type
            absence_type = random.choice(ABSENCE_TYPES)

            # Generate dates (some past, some future)
            days_offset = random.randint(-30, 14)
            start_date = today + timedelta(days=days_offset)
            duration = random.randint(1, 5)
            end_date = start_date + timedelta(days=duration - 1)

            # Submission time
            submitted_at = datetime.combine(start_date, time(8, 0)) - timedelta(days=random.randint(1, 7))

            # Resolution time for non-pending
            resolved_at = None
            approver_id = None
            if status != "PENDING":
                resolved_at = submitted_at + timedelta(hours=random.randint(1, 48))
                approver_id = guardian_id  # Self-approved for simplicity

            # Comment based on type
            comments = {
                "MEDICAL": "Cita medica programada",
                "FAMILY": "Asunto familiar importante",
                "VACATION": "Viaje familiar",
                "OTHER": "Motivo personal",
            }

            await self.conn.execute(
                text(f"""
                    INSERT INTO {self.schema}.absence_requests
                    (student_id, type, start_date, end_date, comment, status,
                     approver_id, ts_submitted, ts_resolved)
                    VALUES (:student_id, :type, :start_date, :end_date, :comment, :status,
                            :approver_id, :ts_submitted, :ts_resolved)
                """),
                {
                    "student_id": student_id,
                    "type": absence_type,
                    "start_date": start_date,
                    "end_date": end_date,
                    "comment": comments.get(absence_type, ""),
                    "status": status,
                    "approver_id": approver_id,
                    "ts_submitted": submitted_at,
                    "ts_resolved": resolved_at,
                }
            )
            status_counts[status] += 1
            type_counts[absence_type] += 1

        print(f"  [OK] {num_requests} absence requests")
        print(f"       Status: APPROVED={status_counts['APPROVED']}, "
              f"REJECTED={status_counts['REJECTED']}, PENDING={status_counts['PENDING']}")
        print(f"       Types: {', '.join(f'{k}={v}' for k, v in type_counts.items())}")

    def _random_notification_status(self) -> str:
        """Get a random notification status based on distribution."""
        rand = random.random()
        cumulative = 0.0
        for status, prob in NOTIFICATION_STATUS_DISTRIBUTION.items():
            cumulative += prob
            if rand < cumulative:
                return status
        return "delivered"

    async def _seed_historical_data(self) -> None:
        """Seed attendance data for today + 30 days back."""
        from sqlalchemy import text

        print("\nSeeding historical data (today + 30 days back)...")

        today = date.today()
        # Include today + 30 school days back
        school_days = get_school_days(today, NUM_HISTORICAL_DAYS)

        # Get students and guardians
        result = await self.conn.execute(
            text(f"SELECT id, course_id FROM {self.schema}.students ORDER BY id")
        )
        students = [{"id": row[0], "course_id": row[1]} for row in result.fetchall()]

        result = await self.conn.execute(
            text(f"SELECT student_id, guardian_id FROM {self.schema}.student_guardians")
        )
        student_guardians = {row[0]: row[1] for row in result.fetchall()}

        total_events = 0
        total_notifications = 0
        notification_status_counts = {s: 0 for s in NOTIFICATION_STATUS_DISTRIBUTION.keys()}

        for day_idx, school_day in enumerate(school_days):
            attending = random.sample(students, int(len(students) * ATTENDANCE_RATE))

            for student in attending:
                student_id = student["id"]
                guardian_id = student_guardians.get(student_id)
                device = random.choice(DEMO_DEVICES)

                is_late = random.random() < LATE_ARRIVAL_RATE
                entry_time = random_entry_time(is_late)
                entry_dt = datetime.combine(school_day, entry_time)

                # Entry event
                await self.conn.execute(
                    text(f"""
                        INSERT INTO {self.schema}.attendance_events
                        (student_id, type, gate_id, device_id, occurred_at, synced_at)
                        VALUES (:student_id, 'IN', :gate_id, :device_id, :occurred_at, :synced_at)
                    """),
                    {
                        "student_id": student_id,
                        "gate_id": device["gate_id"],
                        "device_id": device["device_id"],
                        "occurred_at": entry_dt,
                        "synced_at": entry_dt + timedelta(seconds=random.randint(1, 30)),
                    }
                )
                total_events += 1

                # Entry notification with various statuses
                if guardian_id:
                    notif_status = self._random_notification_status()
                    ts_sent = None
                    retries = 0

                    # Set ts_sent only for delivered status
                    if notif_status == "delivered":
                        ts_sent = entry_dt + timedelta(seconds=random.randint(5, 60))
                    elif notif_status == "retrying":
                        retries = random.randint(1, 3)
                    elif notif_status == "failed":
                        retries = random.randint(3, 5)

                    await self.conn.execute(
                        text(f"""
                            INSERT INTO {self.schema}.notifications
                            (guardian_id, channel, template, status, payload, ts_sent, ts_created, retries)
                            VALUES (:guardian_id, 'whatsapp', 'ingreso_ok', :status,
                                    :payload, :ts_sent, :ts_created, :retries)
                        """),
                        {
                            "guardian_id": guardian_id,
                            "status": notif_status,
                            "payload": f'{{"student_id": {student_id}, "time": "{entry_time.strftime("%H:%M")}"}}',
                            "ts_sent": ts_sent,
                            "ts_created": entry_dt,
                            "retries": retries,
                        }
                    )
                    total_notifications += 1
                    notification_status_counts[notif_status] += 1

                # Exit event
                is_early = random.random() < EARLY_EXIT_RATE
                if not is_early or random.random() > 0.3:
                    exit_time = random_exit_time(is_early)
                    exit_dt = datetime.combine(school_day, exit_time)
                    exit_device = random.choice(DEMO_DEVICES)

                    await self.conn.execute(
                        text(f"""
                            INSERT INTO {self.schema}.attendance_events
                            (student_id, type, gate_id, device_id, occurred_at, synced_at)
                            VALUES (:student_id, 'OUT', :gate_id, :device_id, :occurred_at, :synced_at)
                        """),
                        {
                            "student_id": student_id,
                            "gate_id": exit_device["gate_id"],
                            "device_id": exit_device["device_id"],
                            "occurred_at": exit_dt,
                            "synced_at": exit_dt + timedelta(seconds=random.randint(1, 30)),
                        }
                    )
                    total_events += 1

                    if guardian_id:
                        notif_status = self._random_notification_status()
                        ts_sent = None
                        retries = 0

                        if notif_status == "delivered":
                            ts_sent = exit_dt + timedelta(seconds=random.randint(5, 60))
                        elif notif_status == "retrying":
                            retries = random.randint(1, 3)
                        elif notif_status == "failed":
                            retries = random.randint(3, 5)

                        await self.conn.execute(
                            text(f"""
                                INSERT INTO {self.schema}.notifications
                                (guardian_id, channel, template, status, payload, ts_sent, ts_created, retries)
                                VALUES (:guardian_id, 'whatsapp', 'salida_ok', :status,
                                        :payload, :ts_sent, :ts_created, :retries)
                            """),
                            {
                                "guardian_id": guardian_id,
                                "status": notif_status,
                                "payload": f'{{"student_id": {student_id}, "time": "{exit_time.strftime("%H:%M")}"}}',
                                "ts_sent": ts_sent,
                                "ts_created": exit_dt,
                                "retries": retries,
                            }
                        )
                        total_notifications += 1
                        notification_status_counts[notif_status] += 1

            if (day_idx + 1) % 10 == 0:
                print(f"  Processed {day_idx + 1}/{len(school_days)} days...")

        print(f"  [OK] {total_events} attendance events")
        print(f"  [OK] {total_notifications} notifications")
        print(f"       Status: {', '.join(f'{k}={v}' for k, v in notification_status_counts.items())}")

        # Usage stats
        for school_day in school_days:
            result = await self.conn.execute(
                text(f"""
                    SELECT COUNT(*) FROM {self.schema}.attendance_events
                    WHERE DATE(occurred_at) = :day
                """),
                {"day": school_day}
            )
            event_count = result.scalar() or 0

            metrics = [
                ("attendance_events", event_count),
                ("notifications_sent", int(event_count * 0.95)),
                ("active_students", int(len(students) * ATTENDANCE_RATE)),
            ]

            for metric_name, value in metrics:
                await self.conn.execute(
                    text("""
                        INSERT INTO public.usage_stats (tenant_id, stat_date, metric_name, value)
                        VALUES (:tenant_id, :stat_date, :metric_name, :value)
                        ON CONFLICT (tenant_id, stat_date, metric_name) DO UPDATE SET value = EXCLUDED.value
                    """),
                    {
                        "tenant_id": self.tenant_id,
                        "stat_date": school_day,
                        "metric_name": metric_name,
                        "value": value,
                    }
                )

        print(f"  [OK] Usage stats for {len(school_days)} days")


def main():
    parser = argparse.ArgumentParser(description="Seed tenant data for environment")
    parser.add_argument(
        "--env", "-e",
        choices=["local", "dev", "qa", "prod"],
        default=os.getenv("SEED_ENV", os.getenv("APP_ENV", "local")),
        help="Target environment (default: from SEED_ENV, APP_ENV, or 'local')"
    )
    parser.add_argument(
        "--skip-historical",
        action="store_true",
        help="Skip seeding 30 days of historical data"
    )
    parser.add_argument(
        "--force",
        action="store_true",
        help="Force re-seed even if tenant already exists (clears transactional data)"
    )
    parser.add_argument(
        "--verbose", "-v",
        action="store_true",
        help="Show detailed output including warnings"
    )
    args = parser.parse_args()

    # Map APP_ENV values to our env keys
    env = args.env
    env_mapping = {
        "development": "dev",
        "staging": "qa",
        "production": "prod",
    }
    env = env_mapping.get(env, env)

    # Validate environment is valid
    if env not in ENV_CONFIG:
        print(f"ERROR: Unknown environment '{env}'. Valid: {list(ENV_CONFIG.keys())}")
        sys.exit(1)

    try:
        seeder = TenantSeeder(
            env=env,
            skip_historical=args.skip_historical,
            verbose=args.verbose
        )
        seeder.seed()
    except ValueError as e:
        print(f"ERROR: {e}")
        sys.exit(1)


if __name__ == "__main__":
    main()

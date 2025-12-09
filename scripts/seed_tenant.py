#!/usr/bin/env python3
"""Seed tenant data parametrized by environment.

This script creates a demo tenant with test data, configured for the specific
environment (dev, qa). It is idempotent and can be run multiple times safely.

Usage:
    python scripts/seed_tenant.py --env dev
    python scripts/seed_tenant.py --env qa
    python scripts/seed_tenant.py --env dev --skip-historical  # Skip 30 days of events

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
    "dev": {
        "slug": "demo",
        "name": "Colegio Demo GoCode",
        "domain": "school-attendance.dev.gocode.cl",
        "subdomain": "demo",
        "email_suffix": "colegio-demo.cl",
        "schema": "tenant_demo",
        "plan": "enterprise",
        "max_students": 1000,
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
    },
}

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


def get_school_days(start_date: date, num_days: int) -> list[date]:
    """Get list of school days (Monday-Friday, excluding weekends)."""
    school_days = []
    current = start_date
    while len(school_days) < num_days:
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

    def __init__(self, env: str, skip_historical: bool = False):
        if env not in ENV_CONFIG:
            raise ValueError(f"Unknown environment: {env}. Valid: {list(ENV_CONFIG.keys())}")

        self.env = env
        self.config = ENV_CONFIG[env]
        self.skip_historical = skip_historical
        self.schema = self.config["schema"]
        self.email_suffix = self.config["email_suffix"]

        # Will be set after connection
        self.conn = None
        self.tenant_id = None

    def seed(self) -> None:
        """Run the complete seed process."""
        import asyncio
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

            # 2. Create tenant schema and tables
            await self._create_schema()

            # 3. Seed base data (courses, teachers, students, etc.)
            await self._seed_base_data()

            # 4. Seed historical data (attendance events, notifications, etc.)
            if not self.skip_historical:
                await self._seed_historical_data()
            else:
                print("Skipping historical data (--skip-historical flag)")

            await session.commit()

            print(f"\n{'='*60}")
            print(f"✅ Tenant seed complete for {self.env}!")
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

        print(f"  ✓ Tenant '{self.config['slug']}' configured (id={self.tenant_id})")

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

        print(f"  ✓ Schema '{self.schema}' ready")

    def _get_tables_ddl(self) -> list[str]:
        """Get DDL statements for tenant tables."""
        schema = self.schema
        return [
            f"""CREATE TABLE IF NOT EXISTS {schema}.courses (
                id SERIAL PRIMARY KEY,
                name VARCHAR(128) NOT NULL,
                grade VARCHAR(32) NOT NULL
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
                type VARCHAR(32) NOT NULL DEFAULT 'OTHER',
                date DATE NOT NULL,
                start_date DATE,
                end_date DATE,
                comment VARCHAR(512),
                status VARCHAR(32) DEFAULT 'PENDING',
                ts_submitted TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
                created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
            )""",
            f"""CREATE TABLE IF NOT EXISTS {schema}.notifications (
                id SERIAL PRIMARY KEY,
                guardian_id INTEGER REFERENCES {schema}.guardians(id),
                type VARCHAR(32) NOT NULL,
                channel VARCHAR(16) NOT NULL,
                template VARCHAR(64),
                status VARCHAR(32) DEFAULT 'PENDING',
                payload JSONB DEFAULT '{{}}',
                ts_sent TIMESTAMP WITH TIME ZONE,
                ts_created TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
                sent_at TIMESTAMP WITH TIME ZONE,
                created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
            )""",
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
                alert_date DATE NOT NULL,
                expected_time TIME NOT NULL,
                status VARCHAR(32) DEFAULT 'PENDING',
                comment TEXT,
                resolved_at TIMESTAMP WITH TIME ZONE,
                created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
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
                    INSERT INTO {self.schema}.courses (id, name, grade)
                    VALUES (:id, :name, :grade)
                    ON CONFLICT (id) DO NOTHING
                """),
                course
            )
        await self.conn.execute(text(f"SELECT setval('{self.schema}.courses_id_seq', 10, true)"))
        print(f"  ✓ {len(DEMO_COURSES)} courses")

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
        print(f"  ✓ {len(DEMO_TEACHERS)} teachers")

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
        print(f"  ✓ {len(DEMO_STUDENTS)} students with guardians")

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
        print(f"  ✓ {user_id - 1} users")

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
        print(f"  ✓ {len(DEMO_DEVICES)} devices")

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
        print("  ✓ Schedules configured")

        # QR tags for students
        for student in DEMO_STUDENTS:
            token = f"QR-{student['id']:04d}-{self.config['slug'].upper()}"
            token_hash = hashlib.sha256(token.encode()).hexdigest()
            await self.conn.execute(
                text(f"""
                    INSERT INTO {self.schema}.tags (student_id, tag_token_hash, tag_token_preview, status, created_at)
                    VALUES (:student_id, :token_hash, :token_preview, 'ACTIVE', NOW())
                    ON CONFLICT (tag_token_hash) DO NOTHING
                """),
                {
                    "student_id": student["id"],
                    "token_hash": token_hash,
                    "token_preview": token[:8],
                }
            )
        print(f"  ✓ QR tags for {len(DEMO_STUDENTS)} students")

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
        print(f"  ✓ Enrollments for year {current_year}")

    async def _clear_data(self) -> None:
        """Clear existing transactional data for idempotency."""
        from sqlalchemy import text

        # Only clear transactional data, not structure
        tables_to_clear = [
            "attendance_events", "notifications", "no_show_alerts",
            "absence_requests", "schedule_exceptions",
        ]
        for table in tables_to_clear:
            await self.conn.execute(text(f"DELETE FROM {self.schema}.{table}"))

    async def _seed_historical_data(self) -> None:
        """Seed 30 days of historical attendance data."""
        from sqlalchemy import text

        print("\nSeeding historical data (30 days)...")

        today = date.today()
        school_days = get_school_days(today - timedelta(days=1), NUM_HISTORICAL_DAYS)

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

                # Entry notification
                if guardian_id:
                    await self.conn.execute(
                        text(f"""
                            INSERT INTO {self.schema}.notifications
                            (guardian_id, type, channel, template, status, payload, ts_sent, ts_created)
                            VALUES (:guardian_id, 'INGRESO_OK', 'whatsapp', 'ingreso_ok', 'delivered',
                                    :payload, :ts_sent, :ts_created)
                        """),
                        {
                            "guardian_id": guardian_id,
                            "payload": f'{{"student_id": {student_id}, "time": "{entry_time.strftime("%H:%M")}"}}',
                            "ts_sent": entry_dt + timedelta(seconds=random.randint(5, 60)),
                            "ts_created": entry_dt,
                        }
                    )
                    total_notifications += 1

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
                        await self.conn.execute(
                            text(f"""
                                INSERT INTO {self.schema}.notifications
                                (guardian_id, type, channel, template, status, payload, ts_sent, ts_created)
                                VALUES (:guardian_id, 'SALIDA_OK', 'whatsapp', 'salida_ok', 'delivered',
                                        :payload, :ts_sent, :ts_created)
                            """),
                            {
                                "guardian_id": guardian_id,
                                "payload": f'{{"student_id": {student_id}, "time": "{exit_time.strftime("%H:%M")}"}}',
                                "ts_sent": exit_dt + timedelta(seconds=random.randint(5, 60)),
                                "ts_created": exit_dt,
                            }
                        )
                        total_notifications += 1

            if (day_idx + 1) % 10 == 0:
                print(f"  Processed {day_idx + 1}/{len(school_days)} days...")

        print(f"  ✓ {total_events} attendance events")
        print(f"  ✓ {total_notifications} notifications")

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

        print(f"  ✓ Usage stats for {len(school_days)} days")


def main():
    parser = argparse.ArgumentParser(description="Seed tenant data for environment")
    parser.add_argument(
        "--env", "-e",
        choices=["dev", "qa"],
        default=os.getenv("APP_ENV", "dev"),
        help="Target environment (default: from APP_ENV or 'dev')"
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
    args = parser.parse_args()

    # Map APP_ENV values to our env keys
    env = args.env
    if env == "development":
        env = "dev"
    elif env == "production":
        print("ERROR: Cannot seed demo data in production!")
        sys.exit(1)

    seeder = TenantSeeder(env=env, skip_historical=args.skip_historical)
    seeder.seed()


if __name__ == "__main__":
    main()

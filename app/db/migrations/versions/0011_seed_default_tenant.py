"""Seed default tenant with demo data.

Revision ID: 0011_seed_default_tenant
Revises: 0010_merge_0009_heads
Create Date: 2025-12-08

This migration:
1. Creates the default tenant for school-attendance.dev.gocode.cl
2. Creates the tenant schema with all required tables
3. Seeds demo data (60 students, 3 courses, 3 teachers, guardians, users)
4. Creates a super admin account for platform management
"""

from __future__ import annotations

from datetime import datetime, timezone

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = "0011_seed_default_tenant"
down_revision = "0010_merge_0009_heads"
branch_labels = None
depends_on = None

# Demo tenant configuration
DEMO_TENANT = {
    "slug": "demo",
    "name": "Colegio Demo GoCode",
    "domain": "school-attendance.dev.gocode.cl",
    "subdomain": "demo",
    "plan": "enterprise",
    "max_students": 1000,
}

SCHEMA_NAME = "tenant_demo"

# Demo courses
DEMO_COURSES = [
    {"id": 1, "name": "1° Básico A", "grade": "1° Básico"},
    {"id": 2, "name": "1° Básico B", "grade": "1° Básico"},
    {"id": 3, "name": "2° Básico A", "grade": "2° Básico"},
]

# Demo teachers
DEMO_TEACHERS = [
    {"id": 1, "full_name": "María González López", "email": "maria.gonzalez@colegio-demo.cl", "can_enroll_biometric": True},
    {"id": 2, "full_name": "Pedro Ramírez Castro", "email": "pedro.ramirez@colegio-demo.cl", "can_enroll_biometric": True},
    {"id": 3, "full_name": "Carmen Silva Morales", "email": "carmen.silva@colegio-demo.cl", "can_enroll_biometric": False},
]

# Teacher-course assignments
TEACHER_COURSES = [
    {"teacher_id": 1, "course_id": 1},  # María teaches 1°A
    {"teacher_id": 2, "course_id": 2},  # Pedro teaches 1°B
    {"teacher_id": 3, "course_id": 3},  # Carmen teaches 2°A
]

# Demo students (60 total, matching the JSON mock data)
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

# Demo users (passwords: Demo123!)
# pbkdf2_sha256 hash for "Demo123!" - generated with passlib
# BUG-013 fix: Corrected hash format that was invalid
DEMO_PASSWORD_HASH = "$pbkdf2-sha256$29000$R0hJac05x7jXWmsN4ZxT6g$90ng37I7g3E6npxCMQ3pORoP007eKXzPekyka38XM/w"

DEMO_USERS = [
    {"email": "director@colegio-demo.cl", "full_name": "Director Demo", "role": "ADMIN"},
    {"email": "inspector@colegio-demo.cl", "full_name": "Inspector Demo", "role": "INSPECTOR"},
    {"email": "maria.gonzalez@colegio-demo.cl", "full_name": "María González López", "role": "TEACHER", "teacher_id": 1},
    {"email": "pedro.ramirez@colegio-demo.cl", "full_name": "Pedro Ramírez Castro", "role": "TEACHER", "teacher_id": 2},
    {"email": "carmen.silva@colegio-demo.cl", "full_name": "Carmen Silva Morales", "role": "TEACHER", "teacher_id": 3},
]

# Demo devices
DEMO_DEVICES = [
    {"device_id": "KIOSK-001", "gate_id": "GATE-PRINCIPAL", "firmware_version": "1.0.0"},
    {"device_id": "KIOSK-002", "gate_id": "GATE-SECUNDARIA", "firmware_version": "1.0.0"},
]

# Super admin for platform management
SUPER_ADMIN = {
    "email": "admin@gocode.cl",
    "full_name": "Super Admin GoCode",
    # Same password hash as demo users
    "hashed_password": DEMO_PASSWORD_HASH,
}


def upgrade() -> None:
    conn = op.get_bind()

    # 1. Create super admin
    conn.execute(
        sa.text("""
            INSERT INTO public.super_admins (email, full_name, hashed_password, is_active)
            VALUES (:email, :full_name, :hashed_password, true)
            ON CONFLICT (email) DO NOTHING
        """),
        SUPER_ADMIN,
    )

    # 2. Create demo tenant
    conn.execute(
        sa.text("""
            INSERT INTO public.tenants (slug, name, domain, subdomain, is_active, plan, max_students, config)
            VALUES (:slug, :name, :domain, :subdomain, true, :plan, :max_students, '{}')
            ON CONFLICT (slug) DO UPDATE SET
                name = EXCLUDED.name,
                domain = EXCLUDED.domain,
                subdomain = EXCLUDED.subdomain,
                plan = EXCLUDED.plan,
                max_students = EXCLUDED.max_students
            RETURNING id
        """),
        DEMO_TENANT,
    )

    # Get tenant ID
    result = conn.execute(
        sa.text("SELECT id FROM public.tenants WHERE slug = :slug"),
        {"slug": DEMO_TENANT["slug"]},
    )
    tenant_id = result.scalar()

    # 3. Create tenant config
    conn.execute(
        sa.text("""
            INSERT INTO public.tenant_configs (tenant_id, ses_region)
            VALUES (:tenant_id, 'us-east-1')
            ON CONFLICT (tenant_id) DO NOTHING
        """),
        {"tenant_id": tenant_id},
    )

    # 4. Initialize tenant features (all enabled for enterprise)
    features = [
        "whatsapp_notifications",
        "email_notifications",
        "photo_capture",
        "audio_capture",
        "webauthn_biometric",
        "parent_portal",
        "teacher_pwa",
        "api_access",
    ]
    for feature in features:
        conn.execute(
            sa.text("""
                INSERT INTO public.tenant_features (tenant_id, feature_name, is_enabled, config)
                VALUES (:tenant_id, :feature_name, true, '{}')
                ON CONFLICT ON CONSTRAINT uq_tenant_feature DO NOTHING
            """),
            {"tenant_id": tenant_id, "feature_name": feature},
        )

    # 5. Create tenant schema
    conn.execute(sa.text(f"CREATE SCHEMA IF NOT EXISTS {SCHEMA_NAME}"))

    # 6. Create tables in tenant schema
    _create_tenant_tables(conn, SCHEMA_NAME)

    # 7. Seed demo data in tenant schema
    _seed_demo_data(conn, SCHEMA_NAME)


def _create_tenant_tables(conn, schema: str) -> None:
    """Create all required tables in the tenant schema."""

    # Create courses table
    conn.execute(sa.text(f"""
        CREATE TABLE IF NOT EXISTS {schema}.courses (
            id SERIAL PRIMARY KEY,
            name VARCHAR(128) NOT NULL,
            grade VARCHAR(32) NOT NULL
        )
    """))

    # Create guardians table
    conn.execute(sa.text(f"""
        CREATE TABLE IF NOT EXISTS {schema}.guardians (
            id SERIAL PRIMARY KEY,
            full_name VARCHAR(255) NOT NULL,
            contacts JSONB DEFAULT '{{}}',
            notification_prefs JSONB DEFAULT '{{}}'
        )
    """))

    # Create students table
    conn.execute(sa.text(f"""
        CREATE TABLE IF NOT EXISTS {schema}.students (
            id SERIAL PRIMARY KEY,
            full_name VARCHAR(255) NOT NULL,
            course_id INTEGER NOT NULL REFERENCES {schema}.courses(id),
            status VARCHAR(32) DEFAULT 'ACTIVE',
            qr_code_hash VARCHAR(128),
            photo_pref_opt_in BOOLEAN DEFAULT false,
            evidence_preference VARCHAR(16) DEFAULT 'none'
        )
    """))
    conn.execute(sa.text(f"CREATE INDEX IF NOT EXISTS idx_students_course ON {schema}.students(course_id)"))
    conn.execute(sa.text(f"CREATE INDEX IF NOT EXISTS idx_students_status ON {schema}.students(status)"))

    # Create teachers table
    conn.execute(sa.text(f"""
        CREATE TABLE IF NOT EXISTS {schema}.teachers (
            id SERIAL PRIMARY KEY,
            full_name VARCHAR(255) NOT NULL,
            email VARCHAR(255) UNIQUE,
            status VARCHAR(32) DEFAULT 'ACTIVE',
            can_enroll_biometric BOOLEAN DEFAULT false
        )
    """))

    # Create users table
    conn.execute(sa.text(f"""
        CREATE TABLE IF NOT EXISTS {schema}.users (
            id SERIAL PRIMARY KEY,
            email VARCHAR(255) NOT NULL UNIQUE,
            full_name VARCHAR(255) NOT NULL,
            role VARCHAR(32) NOT NULL,
            hashed_password VARCHAR(255) NOT NULL,
            is_active BOOLEAN DEFAULT true,
            guardian_id INTEGER REFERENCES {schema}.guardians(id),
            teacher_id INTEGER REFERENCES {schema}.teachers(id)
        )
    """))
    conn.execute(sa.text(f"CREATE INDEX IF NOT EXISTS idx_users_email ON {schema}.users(email)"))

    # Create devices table
    conn.execute(sa.text(f"""
        CREATE TABLE IF NOT EXISTS {schema}.devices (
            id SERIAL PRIMARY KEY,
            device_id VARCHAR(64) NOT NULL UNIQUE,
            gate_id VARCHAR(64) NOT NULL,
            firmware_version VARCHAR(32) NOT NULL,
            battery_pct INTEGER DEFAULT 100,
            pending_events INTEGER DEFAULT 0,
            online BOOLEAN DEFAULT true,
            last_sync TIMESTAMP WITH TIME ZONE
        )
    """))

    # Create tags table
    conn.execute(sa.text(f"""
        CREATE TABLE IF NOT EXISTS {schema}.tags (
            id SERIAL PRIMARY KEY,
            student_id INTEGER NOT NULL REFERENCES {schema}.students(id),
            tag_token_hash VARCHAR(128) NOT NULL UNIQUE,
            tag_token_preview VARCHAR(16) NOT NULL,
            tag_uid VARCHAR(64),
            status VARCHAR(32) DEFAULT 'PENDING',
            created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
            revoked_at TIMESTAMP WITH TIME ZONE
        )
    """))
    conn.execute(sa.text(f"CREATE INDEX IF NOT EXISTS idx_tags_student ON {schema}.tags(student_id)"))
    conn.execute(sa.text(f"CREATE INDEX IF NOT EXISTS idx_tags_preview ON {schema}.tags(tag_token_preview)"))
    conn.execute(sa.text(f"CREATE INDEX IF NOT EXISTS idx_tags_status ON {schema}.tags(status)"))

    # Create student_guardians association table
    conn.execute(sa.text(f"""
        CREATE TABLE IF NOT EXISTS {schema}.student_guardians (
            student_id INTEGER NOT NULL REFERENCES {schema}.students(id),
            guardian_id INTEGER NOT NULL REFERENCES {schema}.guardians(id),
            PRIMARY KEY (student_id, guardian_id)
        )
    """))

    # Create teacher_courses association table
    conn.execute(sa.text(f"""
        CREATE TABLE IF NOT EXISTS {schema}.teacher_courses (
            teacher_id INTEGER NOT NULL REFERENCES {schema}.teachers(id),
            course_id INTEGER NOT NULL REFERENCES {schema}.courses(id),
            PRIMARY KEY (teacher_id, course_id)
        )
    """))

    # Create enrollments table
    conn.execute(sa.text(f"""
        CREATE TABLE IF NOT EXISTS {schema}.enrollments (
            id SERIAL PRIMARY KEY,
            student_id INTEGER NOT NULL REFERENCES {schema}.students(id),
            course_id INTEGER NOT NULL REFERENCES {schema}.courses(id),
            year INTEGER NOT NULL,
            created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        )
    """))

    # Create attendance_type ENUM if not exists
    conn.execute(sa.text("""
        DO $$ BEGIN
            CREATE TYPE attendance_type AS ENUM ('IN', 'OUT');
        EXCEPTION
            WHEN duplicate_object THEN NULL;
        END $$;
    """))

    # Create attendance_events table
    conn.execute(sa.text(f"""
        CREATE TABLE IF NOT EXISTS {schema}.attendance_events (
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
        )
    """))
    conn.execute(sa.text(f"CREATE INDEX IF NOT EXISTS idx_events_student ON {schema}.attendance_events(student_id)"))
    conn.execute(sa.text(f"CREATE INDEX IF NOT EXISTS idx_events_device ON {schema}.attendance_events(device_id)"))
    conn.execute(sa.text(f"CREATE INDEX IF NOT EXISTS idx_events_occurred ON {schema}.attendance_events(occurred_at)"))

    # Create absence_requests table
    conn.execute(sa.text(f"""
        CREATE TABLE IF NOT EXISTS {schema}.absence_requests (
            id SERIAL PRIMARY KEY,
            student_id INTEGER NOT NULL REFERENCES {schema}.students(id),
            date DATE NOT NULL,
            reason VARCHAR(512),
            status VARCHAR(32) DEFAULT 'PENDING',
            created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        )
    """))

    # Create notifications table
    conn.execute(sa.text(f"""
        CREATE TABLE IF NOT EXISTS {schema}.notifications (
            id SERIAL PRIMARY KEY,
            guardian_id INTEGER REFERENCES {schema}.guardians(id),
            type VARCHAR(32) NOT NULL,
            channel VARCHAR(16) NOT NULL,
            status VARCHAR(32) DEFAULT 'PENDING',
            payload JSONB DEFAULT '{{}}',
            sent_at TIMESTAMP WITH TIME ZONE,
            created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        )
    """))

    # Create schedules table
    conn.execute(sa.text(f"""
        CREATE TABLE IF NOT EXISTS {schema}.schedules (
            id SERIAL PRIMARY KEY,
            course_id INTEGER NOT NULL REFERENCES {schema}.courses(id),
            day_of_week INTEGER NOT NULL,
            entry_time TIME NOT NULL,
            exit_time TIME NOT NULL,
            tolerance_minutes INTEGER DEFAULT 15
        )
    """))

    # Create schedule_exceptions table
    conn.execute(sa.text(f"""
        CREATE TABLE IF NOT EXISTS {schema}.schedule_exceptions (
            id SERIAL PRIMARY KEY,
            schedule_id INTEGER NOT NULL REFERENCES {schema}.schedules(id),
            exception_date DATE NOT NULL,
            is_holiday BOOLEAN DEFAULT false,
            modified_entry_time TIME,
            modified_exit_time TIME,
            reason VARCHAR(255)
        )
    """))

    # Create no_show_alerts table
    conn.execute(sa.text(f"""
        CREATE TABLE IF NOT EXISTS {schema}.no_show_alerts (
            id SERIAL PRIMARY KEY,
            student_id INTEGER NOT NULL REFERENCES {schema}.students(id),
            alert_date DATE NOT NULL,
            expected_time TIME NOT NULL,
            status VARCHAR(32) DEFAULT 'PENDING',
            comment TEXT,
            resolved_at TIMESTAMP WITH TIME ZONE,
            created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        )
    """))

    # Create consents table
    conn.execute(sa.text(f"""
        CREATE TABLE IF NOT EXISTS {schema}.consents (
            id SERIAL PRIMARY KEY,
            guardian_id INTEGER NOT NULL REFERENCES {schema}.guardians(id),
            consent_type VARCHAR(32) NOT NULL,
            is_granted BOOLEAN DEFAULT false,
            granted_at TIMESTAMP WITH TIME ZONE,
            revoked_at TIMESTAMP WITH TIME ZONE
        )
    """))

    # Create audit_logs table
    conn.execute(sa.text(f"""
        CREATE TABLE IF NOT EXISTS {schema}.audit_logs (
            id SERIAL PRIMARY KEY,
            user_id INTEGER,
            action VARCHAR(64) NOT NULL,
            entity VARCHAR(64),
            entity_id INTEGER,
            details JSONB DEFAULT '{{}}',
            ip_address VARCHAR(45),
            created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        )
    """))

    # Create webauthn_credentials table
    conn.execute(sa.text(f"""
        CREATE TABLE IF NOT EXISTS {schema}.webauthn_credentials (
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
        )
    """))


def _seed_demo_data(conn, schema: str) -> None:
    """Seed demo data into the tenant schema."""

    # Insert courses
    for course in DEMO_COURSES:
        conn.execute(
            sa.text(f"""
                INSERT INTO {schema}.courses (id, name, grade)
                VALUES (:id, :name, :grade)
                ON CONFLICT (id) DO NOTHING
            """),
            course,
        )
    # Reset sequence
    conn.execute(sa.text(f"SELECT setval('{schema}.courses_id_seq', 10, true)"))

    # Insert teachers
    for teacher in DEMO_TEACHERS:
        conn.execute(
            sa.text(f"""
                INSERT INTO {schema}.teachers (id, full_name, email, status, can_enroll_biometric)
                VALUES (:id, :full_name, :email, 'ACTIVE', :can_enroll_biometric)
                ON CONFLICT (id) DO NOTHING
            """),
            teacher,
        )
    conn.execute(sa.text(f"SELECT setval('{schema}.teachers_id_seq', 10, true)"))

    # Insert teacher-course assignments
    for tc in TEACHER_COURSES:
        conn.execute(
            sa.text(f"""
                INSERT INTO {schema}.teacher_courses (teacher_id, course_id)
                VALUES (:teacher_id, :course_id)
                ON CONFLICT DO NOTHING
            """),
            tc,
        )

    # Insert guardians and students
    guardian_id = 1
    for student in DEMO_STUDENTS:
        # Create guardian
        conn.execute(
            sa.text(f"""
                INSERT INTO {schema}.guardians (id, full_name, contacts, notification_prefs)
                VALUES (:id, :full_name, '{{"phone": "+56912345678", "email": "apoderado@example.com"}}',
                        '{{"INGRESO_OK": {{"whatsapp": true}}, "SALIDA_OK": {{"whatsapp": true}}}}')
                ON CONFLICT (id) DO NOTHING
            """),
            {"id": guardian_id, "full_name": student["guardian_name"]},
        )

        # Create student
        evidence_pref = "photo" if student["photo_opt_in"] else "none"
        conn.execute(
            sa.text(f"""
                INSERT INTO {schema}.students (id, full_name, course_id, status, photo_pref_opt_in, evidence_preference)
                VALUES (:id, :full_name, :course_id, 'ACTIVE', :photo_opt_in, :evidence_pref)
                ON CONFLICT (id) DO NOTHING
            """),
            {
                "id": student["id"],
                "full_name": student["full_name"],
                "course_id": student["course_id"],
                "photo_opt_in": student["photo_opt_in"],
                "evidence_pref": evidence_pref,
            },
        )

        # Link student to guardian
        conn.execute(
            sa.text(f"""
                INSERT INTO {schema}.student_guardians (student_id, guardian_id)
                VALUES (:student_id, :guardian_id)
                ON CONFLICT DO NOTHING
            """),
            {"student_id": student["id"], "guardian_id": guardian_id},
        )

        guardian_id += 1

    conn.execute(sa.text(f"SELECT setval('{schema}.guardians_id_seq', 100, true)"))
    conn.execute(sa.text(f"SELECT setval('{schema}.students_id_seq', 100, true)"))

    # Insert users
    user_id = 1
    for user in DEMO_USERS:
        teacher_id = user.get("teacher_id")
        conn.execute(
            sa.text(f"""
                INSERT INTO {schema}.users (id, email, full_name, role, hashed_password, is_active, teacher_id)
                VALUES (:id, :email, :full_name, :role, :password, true, :teacher_id)
                ON CONFLICT (email) DO NOTHING
            """),
            {
                "id": user_id,
                "email": user["email"],
                "full_name": user["full_name"],
                "role": user["role"],
                "password": DEMO_PASSWORD_HASH,
                "teacher_id": teacher_id,
            },
        )
        user_id += 1

    # Add parent users (first 5 guardians get user accounts)
    for i in range(1, 6):
        conn.execute(
            sa.text(f"""
                INSERT INTO {schema}.users (id, email, full_name, role, hashed_password, is_active, guardian_id)
                VALUES (:id, :email, :full_name, 'PARENT', :password, true, :guardian_id)
                ON CONFLICT (email) DO NOTHING
            """),
            {
                "id": user_id,
                "email": f"apoderado{i}@colegio-demo.cl",
                "full_name": DEMO_STUDENTS[i - 1]["guardian_name"],
                "password": DEMO_PASSWORD_HASH,
                "guardian_id": i,
            },
        )
        user_id += 1

    conn.execute(sa.text(f"SELECT setval('{schema}.users_id_seq', 100, true)"))

    # Insert devices
    for device in DEMO_DEVICES:
        conn.execute(
            sa.text(f"""
                INSERT INTO {schema}.devices (device_id, gate_id, firmware_version, online)
                VALUES (:device_id, :gate_id, :firmware_version, true)
                ON CONFLICT (device_id) DO NOTHING
            """),
            device,
        )

    # Insert schedules (Monday-Friday, 8:00-16:00)
    for course_id in [1, 2, 3]:
        for day in range(1, 6):  # Monday = 1, Friday = 5
            conn.execute(
                sa.text(f"""
                    INSERT INTO {schema}.schedules (course_id, day_of_week, entry_time, exit_time, tolerance_minutes)
                    VALUES (:course_id, :day, '08:00', '16:00', 15)
                    ON CONFLICT DO NOTHING
                """),
                {"course_id": course_id, "day": day},
            )


def downgrade() -> None:
    conn = op.get_bind()

    # Get tenant ID
    result = conn.execute(
        sa.text("SELECT id FROM public.tenants WHERE slug = :slug"),
        {"slug": DEMO_TENANT["slug"]},
    )
    row = result.fetchone()

    if row:
        tenant_id = row[0]

        # Delete tenant features
        conn.execute(
            sa.text("DELETE FROM public.tenant_features WHERE tenant_id = :tenant_id"),
            {"tenant_id": tenant_id},
        )

        # Delete tenant config
        conn.execute(
            sa.text("DELETE FROM public.tenant_configs WHERE tenant_id = :tenant_id"),
            {"tenant_id": tenant_id},
        )

        # Delete tenant
        conn.execute(
            sa.text("DELETE FROM public.tenants WHERE id = :tenant_id"),
            {"tenant_id": tenant_id},
        )

    # Drop tenant schema
    conn.execute(sa.text(f"DROP SCHEMA IF EXISTS {SCHEMA_NAME} CASCADE"))

    # Delete super admin
    conn.execute(
        sa.text("DELETE FROM public.super_admins WHERE email = :email"),
        {"email": SUPER_ADMIN["email"]},
    )

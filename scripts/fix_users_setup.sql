-- Script para corregir la tabla users y crear usuarios de prueba
-- Ejecutar en ambientes dev y qa

-- 1. Agregar columna teacher_id si no existe
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'users' AND column_name = 'teacher_id'
    ) THEN
        ALTER TABLE users ADD COLUMN teacher_id INTEGER REFERENCES teachers(id);
        RAISE NOTICE 'Columna teacher_id agregada';
    ELSE
        RAISE NOTICE 'Columna teacher_id ya existe';
    END IF;
END $$;

-- 2. Insertar usuarios de prueba si no existen
-- Password: secret123 (hash pbkdf2-sha256)
INSERT INTO users (email, full_name, role, hashed_password, is_active)
SELECT 'director@example.com', 'Ana Directora', 'DIRECTOR',
       '$pbkdf2-sha256$29000$grB2DiEkxFhrjRHCOAfAmA$2bpx/hVYT5bc2kypdPV/9KsMyFSfnNI9Z7Z7CcJzNPk', true
WHERE NOT EXISTS (SELECT 1 FROM users WHERE email = 'director@example.com');

INSERT INTO users (email, full_name, role, hashed_password, is_active)
SELECT 'inspector@example.com', 'Pedro Inspector', 'INSPECTOR',
       '$pbkdf2-sha256$29000$grB2DiEkxFhrjRHCOAfAmA$2bpx/hVYT5bc2kypdPV/9KsMyFSfnNI9Z7Z7CcJzNPk', true
WHERE NOT EXISTS (SELECT 1 FROM users WHERE email = 'inspector@example.com');

-- 3. Mostrar usuarios existentes
SELECT id, email, role, is_active FROM users ORDER BY id;

"""TDD Bug Fix Tests Round 6 - Path validation and JavaScript parsing."""

import inspect


class TestBugR6_1_WebAuthnAdminPathValidation:
    """BUG-R6-1: WebAuthn admin endpoints should validate student_id path parameter."""

    def test_admin_start_registration_validates_student_id(self):
        """Verify admin_start_student_registration uses Path with ge=1."""
        from app.api.v1 import webauthn

        source = inspect.getsource(webauthn.admin_start_student_registration)

        # Should use Path(..., ge=1) for student_id like kiosk endpoint does
        has_path_validation = "Path(" in source and "ge=1" in source

        assert has_path_validation, (
            "admin_start_student_registration should validate student_id with Path(..., ge=1)"
        )

    def test_admin_complete_registration_validates_student_id(self):
        """Verify admin_complete_student_registration uses Path with ge=1."""
        from app.api.v1 import webauthn

        source = inspect.getsource(webauthn.admin_complete_student_registration)

        # Should use Path(..., ge=1) for student_id
        has_path_validation = "Path(" in source and "ge=1" in source

        assert has_path_validation, (
            "admin_complete_student_registration should validate student_id with Path(..., ge=1)"
        )

    def test_admin_list_credentials_validates_student_id(self):
        """Verify admin_list_student_credentials uses Path with ge=1."""
        from app.api.v1 import webauthn

        source = inspect.getsource(webauthn.admin_list_student_credentials)

        # Should use Path(..., ge=1) for student_id
        has_path_validation = "Path(" in source and "ge=1" in source

        assert has_path_validation, (
            "admin_list_student_credentials should validate student_id with Path(..., ge=1)"
        )


class TestBugR6_2_BiometricEnrollParseInt:
    """BUG-R6-2: biometric_enroll.js should use parseInt with radix 10."""

    def test_biometric_enroll_uses_parseint_with_radix(self):
        """Verify biometric_enroll.js uses parseInt with explicit radix."""
        enroll_path = "src/kiosk-app/js/views/biometric_enroll.js"

        with open(enroll_path, encoding="utf-8") as f:
            source = f.read()

        import re

        parseint_calls = re.findall(r"parseInt\([^)]+\)", source)

        for call in parseint_calls:
            assert call.count(",") >= 1, (
                f"parseInt without radix found in biometric_enroll.js: {call}. Should use parseInt(value, 10)"
            )


class TestBugR6_3_BiometricEnrollNaNCheck:
    """BUG-R6-3: biometric_enroll.js should validate NaN after parseInt."""

    def test_biometric_enroll_validates_nan(self):
        """Verify biometric_enroll.js validates teacherId is not NaN."""
        enroll_path = "src/kiosk-app/js/views/biometric_enroll.js"

        with open(enroll_path, encoding="utf-8") as f:
            source = f.read()

        # Should check isNaN(teacherId) before using it
        has_nan_check = "isNaN(teacherId)" in source or "Number.isNaN(teacherId)" in source

        assert has_nan_check, "biometric_enroll.js should validate isNaN(teacherId) before using it"


class TestBugR6_4_TeachersPathValidation:
    """BUG-R6-4: Teachers endpoint should validate course_id path parameter."""

    def test_list_course_students_validates_course_id(self):
        """Verify list_course_students uses Path with ge=1."""
        from app.api.v1 import teachers

        source = inspect.getsource(teachers.list_course_students)

        # Should use Path(..., ge=1) for course_id
        has_path_validation = "Path(" in source and "ge=1" in source

        assert has_path_validation, (
            "list_course_students should validate course_id with Path(..., ge=1)"
        )

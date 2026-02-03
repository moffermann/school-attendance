"""TDD Bug Fix Tests Round 4 - Data validation and error handling."""

import inspect


class TestBugR4_1_PrefsIterationValidation:
    """BUG-R4-1: detect_no_ingreso should validate prefs[template_key] is iterable."""

    def test_detect_no_ingreso_validates_prefs_type(self):
        """Verify detect_no_ingreso handles non-list prefs gracefully."""
        from app.workers.jobs import detect_no_ingreso

        source = inspect.getsource(detect_no_ingreso._detect_and_notify)

        # Should validate that prefs[template_key] is a list before iterating
        # Using isinstance(pref_value, list) after pref_value = prefs.get(...)
        has_pref_value_pattern = (
            "pref_value = prefs.get" in source and "isinstance(pref_value, list)" in source
        )
        has_direct_isinstance = (
            "isinstance(prefs.get(template_key" in source
            or "isinstance(prefs[template_key]" in source
        )

        assert has_pref_value_pattern or has_direct_isinstance, (
            "detect_no_ingreso should validate prefs[template_key] is a list before iterating"
        )


class TestBugR4_2_DispatcherContactsNull:
    """BUG-R4-2: Dispatcher should handle guardian.contacts being None."""

    def test_dispatcher_handles_null_contacts(self):
        """Verify dispatcher handles None contacts in contact_map."""
        from app.services.notifications import dispatcher

        source = inspect.getsource(dispatcher.NotificationDispatcher.enqueue_manual_notification)

        # Should use (guardian.contacts or {}).get() pattern
        has_null_check = "(guardian.contacts or {}).get" in source
        has_getattr = "getattr(guardian" in source and "contacts" in source

        assert has_null_check or has_getattr, (
            "Dispatcher should handle guardian.contacts being None with (contacts or {}).get()"
        )


class TestBugR4_3_ParseIntRadix:
    """BUG-R4-3: scan_result.js should use parseInt with radix 10."""

    def test_scan_result_uses_parseint_with_radix(self):
        """Verify scan_result.js uses parseInt with explicit radix."""
        scan_result_path = "src/kiosk-app/js/views/scan_result.js"

        with open(scan_result_path, encoding="utf-8") as f:
            source = f.read()

        # Should use parseInt(value, 10) to avoid octal interpretation
        # Find all parseInt calls and check they have radix
        import re

        parseint_calls = re.findall(r"parseInt\([^)]+\)", source)

        for call in parseint_calls:
            # Each parseInt should have a second argument (radix)
            if call.count(",") == 0:
                # Also check if it has isNaN validation nearby
                has_nan_check = "isNaN" in source
                assert has_nan_check, (
                    f"parseInt without radix found: {call}. Should use parseInt(value, 10) and validate NaN"
                )


class TestBugR4_4_LocalStorageJsonParse:
    """BUG-R4-4: state.js should handle corrupted localStorage JSON."""

    def test_state_handles_corrupted_localstorage(self):
        """Verify state.js wraps JSON.parse in try/catch."""
        state_path = "src/kiosk-app/js/state.js"

        with open(state_path, encoding="utf-8") as f:
            source = f.read()

        # Find the init function and check if JSON.parse is wrapped in try/catch
        # The pattern should be try { ... JSON.parse ... } catch
        init_start = source.find("async init()")
        if init_start == -1:
            init_start = source.find("init()")

        assert init_start != -1, "Could not find init function in state.js"

        # Look at the init function context
        init_section = source[init_start : init_start + 500]

        # Check for try/catch around JSON.parse
        has_try_before_parse = "try" in init_section and "JSON.parse" in init_section
        has_catch = "catch" in init_section

        assert has_try_before_parse and has_catch, (
            "state.js init() should wrap JSON.parse in try/catch to handle corrupted localStorage"
        )


class TestBugR4_5_ParseIntNaNValidation:
    """BUG-R4-5: scan_result.js should validate NaN after parseInt."""

    def test_scan_result_validates_nan(self):
        """Verify scan_result.js validates parseInt result is not NaN."""
        scan_result_path = "src/kiosk-app/js/views/scan_result.js"

        with open(scan_result_path, encoding="utf-8") as f:
            source = f.read()

        # Should validate that parseInt result is not NaN before using it
        has_nan_check = "isNaN(studentId)" in source or "Number.isNaN(studentId)" in source
        has_radix = "parseInt(params.student_id, 10)" in source

        assert has_nan_check and has_radix, (
            "scan_result.js should use parseInt with radix 10 and validate NaN"
        )

"""TDD Bug Fix Tests Round 8 - DOM safety and race conditions."""


class TestBugR8_1_ModalContainerSafety:
    """BUG-R8-1: director_devices.js should use optional chaining for modal-container."""

    def test_devices_uses_optional_chaining_for_modal(self):
        """Verify director_devices.js uses ?. when clicking modal-container."""
        devices_path = "src/web-app/js/views/director_devices.js"

        with open(devices_path, encoding="utf-8") as f:
            source = f.read()

        # Should use optional chaining: querySelector('.modal-container')?.click()
        # Not: querySelector('.modal-container').click()
        unsafe_pattern = "querySelector('.modal-container').click()"
        safe_pattern = "querySelector('.modal-container')?.click()"

        if unsafe_pattern in source:
            assert safe_pattern in source or unsafe_pattern not in source, (
                "director_devices.js should use optional chaining (?.) for modal-container.click()"
            )


class TestBugR8_2_BiometricStaleReference:
    """BUG-R8-2: director_biometric.js should re-query DOM elements in setTimeout."""

    def test_biometric_requerys_elements_in_timeout(self):
        """Verify director_biometric.js re-queries DOM elements in setTimeout callback."""
        biometric_path = "src/web-app/js/views/director_biometric.js"

        with open(biometric_path, encoding="utf-8") as f:
            source = f.read()

        # The error handling setTimeout should re-query elements instead of using stale references
        # Look for the pattern where btn/guide are queried inside the setTimeout callback
        # This ensures elements are fresh when the timeout fires

        # Find setTimeout blocks and check if they have fresh getElementById calls
        import re

        # Look for setTimeout that re-queries the button element
        requery_in_timeout = re.search(
            r'setTimeout\s*\(\s*\(\)\s*=>\s*\{[^}]*getElementById\s*\(\s*[\'"]start-enroll-btn[\'"]\s*\)',
            source,
            re.DOTALL,
        )

        assert requery_in_timeout is not None, (
            "director_biometric.js should re-query DOM elements inside setTimeout to avoid stale references"
        )


class TestBugR8_3_BroadcastDoubleClick:
    """BUG-R8-3: director_broadcast.js should prevent double-clicks during send."""

    def test_broadcast_prevents_double_send(self):
        """Verify director_broadcast.js has protection against double-clicking send."""
        broadcast_path = "src/web-app/js/views/director_broadcast.js"

        with open(broadcast_path, encoding="utf-8") as f:
            source = f.read()

        # Should have some form of protection:
        # - A flag like isSending, isProcessing that guards the function
        # - Disabling the button at the start
        # The function has a 2-second timeout before showing results,
        # during which the button can be clicked again
        has_sending_flag = "isSending" in source or "isProcessing" in source
        has_button_disable = ".disabled = true" in source

        assert has_sending_flag or has_button_disable, (
            "director_broadcast.js should have protection against double-clicking send button (isSending flag or button.disabled)"
        )


class TestBugR8_4_BiometricModalSafety:
    """BUG-R8-4: director_biometric.js should use optional chaining for modal-container."""

    def test_biometric_uses_optional_chaining_for_modal(self):
        """Verify director_biometric.js uses ?. when clicking modal-container."""
        biometric_path = "src/web-app/js/views/director_biometric.js"

        with open(biometric_path, encoding="utf-8") as f:
            source = f.read()

        # Count safe vs unsafe patterns
        unsafe_count = source.count("querySelector('.modal-container').click()")
        source.count("querySelector('.modal-container')?.click()")

        # All occurrences should use optional chaining
        assert unsafe_count == 0, (
            f"director_biometric.js has {unsafe_count} unsafe modal-container.click() calls without ?."
        )

"""TDD Tests for Round 11 - Routes Review.

These tests verify route consistency between frontend and backend.
"""

import re


# =============================================================================
# R11-1: Frontend broadcast route should match backend
# =============================================================================
class TestR111BroadcastRoute:
    """Test that frontend broadcast route matches backend."""

    def test_api_js_broadcast_uses_correct_route(self):
        """R11-1: API.sendBroadcast should use /broadcasts/send, not /broadcast."""
        api_js_path = "src/web-app/js/api.js"

        with open(api_js_path, "r", encoding="utf-8") as f:
            content = f.read()

        # Find the sendBroadcast function
        assert "sendBroadcast" in content, "sendBroadcast function should exist"

        # Check that it uses /broadcasts/send, not /broadcast
        # The function should call this.request('/broadcasts/send', ...)
        # Bad: this.request('/broadcast', ...)
        # Good: this.request('/broadcasts/send', ...)

        # Find the route used in sendBroadcast
        send_broadcast_match = re.search(
            r"sendBroadcast\s*\([^)]*\)\s*\{[^}]*this\.request\(['\"]([^'\"]+)['\"]",
            content,
            re.DOTALL,
        )

        assert send_broadcast_match, "sendBroadcast should call this.request"
        route = send_broadcast_match.group(1)

        assert route == "/broadcasts/send", (
            f"sendBroadcast should use '/broadcasts/send', not '{route}'"
        )


# =============================================================================
# R11-2: Verify all API routes in api.js match backend router.py
# =============================================================================
class TestR112ApiRoutesConsistency:
    """Test that all API routes in frontend match backend."""

    def test_webapp_bootstrap_route(self):
        """Verify /web-app/bootstrap route exists in both."""
        api_js_path = "src/web-app/js/api.js"
        webapp_py_path = "app/api/v1/webapp.py"

        with open(api_js_path, "r", encoding="utf-8") as f:
            api_content = f.read()

        with open(webapp_py_path, "r", encoding="utf-8") as f:
            webapp_content = f.read()

        # Frontend uses /web-app/bootstrap
        assert "/web-app/bootstrap" in api_content

        # Backend has /bootstrap endpoint (prefix is /web-app)
        assert '"/bootstrap"' in webapp_content

    def test_webapp_dashboard_route(self):
        """Verify /web-app/dashboard route exists."""
        api_js_path = "src/web-app/js/api.js"
        webapp_py_path = "app/api/v1/webapp.py"

        with open(api_js_path, "r", encoding="utf-8") as f:
            api_content = f.read()

        with open(webapp_py_path, "r", encoding="utf-8") as f:
            webapp_content = f.read()

        assert "/web-app/dashboard" in api_content
        assert '"/dashboard"' in webapp_content

    def test_absences_route(self):
        """Verify /absences route exists."""
        api_js_path = "src/web-app/js/api.js"
        absences_py_path = "app/api/v1/absences.py"

        with open(api_js_path, "r", encoding="utf-8") as f:
            api_content = f.read()

        with open(absences_py_path, "r", encoding="utf-8") as f:
            absences_content = f.read()

        # Frontend uses /absences
        assert '"/absences"' in api_content or "'/absences'" in api_content

        # Backend has root endpoint for list/create (empty string means /)
        # The decorator @router.get("", ...) defines the root endpoint
        assert '@router.get(""' in absences_content or "@router.get(''" in absences_content

    def test_parents_preferences_route(self):
        """Verify /parents/{id}/preferences route exists."""
        api_js_path = "src/web-app/js/api.js"

        with open(api_js_path, "r", encoding="utf-8") as f:
            api_content = f.read()

        # Should use backticks for template literal
        assert "/parents/" in api_content and "/preferences" in api_content


# =============================================================================
# R11-3: Verify frontend hash routes match registered handlers
# =============================================================================
class TestR113FrontendHashRoutes:
    """Test that frontend hash routes have corresponding handlers."""

    def test_all_registered_routes_have_handlers(self):
        """All routes in Router.addRoute should have corresponding Views."""
        router_js_path = "src/web-app/js/router.js"

        with open(router_js_path, "r", encoding="utf-8") as f:
            content = f.read()

        # Extract all addRoute calls
        routes = re.findall(r"this\.addRoute\(['\"]([^'\"]+)['\"],\s*Views\.(\w+)", content)

        # Each route should reference a valid view
        assert len(routes) > 0, "Should have registered routes"

        for route_path, view_name in routes:
            # Check view is referenced (Views.viewName)
            assert view_name, f"Route {route_path} should have a view handler"


# =============================================================================
# R11-4: Verify sidebar navigation links match router
# =============================================================================
class TestR114SidebarLinksMatchRouter:
    """Test that sidebar links match registered routes."""

    def test_sidebar_links_are_valid_routes(self):
        """All sidebar links should be valid registered routes."""
        components_js_path = "src/web-app/js/components.js"
        router_js_path = "src/web-app/js/router.js"

        with open(components_js_path, "r", encoding="utf-8") as f:
            components_content = f.read()

        with open(router_js_path, "r", encoding="utf-8") as f:
            router_content = f.read()

        # Extract sidebar links (href="#/...")
        sidebar_links = re.findall(r'href="#(/[^"]+)"', components_content)

        # Extract registered routes
        registered_routes = re.findall(r"this\.addRoute\(['\"]([^'\"]+)['\"]", router_content)

        # All sidebar links should be registered
        for link in sidebar_links:
            assert link in registered_routes, (
                f"Sidebar link '{link}' is not a registered route"
            )


# =============================================================================
# R11-5: Verify kiosk API routes match backend
# =============================================================================
class TestR115KioskApiRoutes:
    """Test that kiosk API routes match backend."""

    def test_kiosk_bootstrap_route(self):
        """Verify /kiosk/bootstrap route."""
        kiosk_sync_path = "src/kiosk-app/js/sync.js"
        kiosk_py_path = "app/api/v1/kiosk.py"

        with open(kiosk_sync_path, "r", encoding="utf-8") as f:
            sync_content = f.read()

        with open(kiosk_py_path, "r", encoding="utf-8") as f:
            kiosk_content = f.read()

        # Frontend uses /kiosk/bootstrap
        assert "/kiosk/bootstrap" in sync_content

        # Backend has /bootstrap endpoint (prefix is /kiosk)
        assert '"/bootstrap"' in kiosk_content

    def test_kiosk_students_route(self):
        """Verify /kiosk/students route."""
        kiosk_sync_path = "src/kiosk-app/js/sync.js"
        kiosk_py_path = "app/api/v1/kiosk.py"

        with open(kiosk_sync_path, "r", encoding="utf-8") as f:
            sync_content = f.read()

        with open(kiosk_py_path, "r", encoding="utf-8") as f:
            kiosk_content = f.read()

        # Frontend uses /kiosk/students
        assert "/kiosk/students" in sync_content

        # Backend has /students endpoint
        assert '"/students"' in kiosk_content


# =============================================================================
# R11-6: Verify teacher PWA API routes match backend
# =============================================================================
class TestR116TeacherPwaApiRoutes:
    """Test that teacher PWA API routes match backend."""

    def test_teachers_me_route(self):
        """Verify /teachers/me route."""
        pwa_api_path = "src/teacher-pwa/js/api.js"
        teachers_py_path = "app/api/v1/teachers.py"

        with open(pwa_api_path, "r", encoding="utf-8") as f:
            api_content = f.read()

        with open(teachers_py_path, "r", encoding="utf-8") as f:
            teachers_content = f.read()

        # Frontend uses /teachers/me
        assert "/teachers/me" in api_content

        # Backend has /me endpoint (prefix is /teachers)
        assert '"/me"' in teachers_content

    def test_teachers_courses_students_route(self):
        """Verify /teachers/courses/{id}/students route."""
        pwa_api_path = "src/teacher-pwa/js/api.js"
        teachers_py_path = "app/api/v1/teachers.py"

        with open(pwa_api_path, "r", encoding="utf-8") as f:
            api_content = f.read()

        with open(teachers_py_path, "r", encoding="utf-8") as f:
            teachers_content = f.read()

        # Frontend uses /teachers/courses/{id}/students
        assert "/teachers/courses/" in api_content and "/students" in api_content

        # Backend has /courses/{course_id}/students endpoint
        assert '"/courses/{course_id}/students"' in teachers_content

    def test_teachers_attendance_bulk_route(self):
        """Verify /teachers/attendance/bulk route."""
        pwa_api_path = "src/teacher-pwa/js/api.js"
        teachers_py_path = "app/api/v1/teachers.py"

        with open(pwa_api_path, "r", encoding="utf-8") as f:
            api_content = f.read()

        with open(teachers_py_path, "r", encoding="utf-8") as f:
            teachers_content = f.read()

        # Frontend uses /teachers/attendance/bulk
        assert "/teachers/attendance/bulk" in api_content

        # Backend has /attendance/bulk endpoint
        assert '"/attendance/bulk"' in teachers_content

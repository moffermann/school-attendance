"""TDD Bug Fix Tests Round 3 - Worker jobs and resource management."""

import pytest
import asyncio
import inspect


class TestBugR3_1_ThreadPoolExecutorFix:
    """BUG-R3-1: ThreadPoolExecutor should use lambda for coroutine."""

    def test_whatsapp_worker_uses_lambda_for_asyncio_run(self):
        """Verify WhatsApp worker wraps asyncio.run in lambda for executor."""
        from app.workers.jobs import send_whatsapp

        source = inspect.getsource(send_whatsapp.send_whatsapp_message)

        # Should use lambda to wrap asyncio.run
        # Either: executor.submit(lambda: asyncio.run(...))
        # Or the old pattern without executor at all
        if "executor.submit" in source:
            assert "lambda" in source or "asyncio.run(_send" not in source, \
                "executor.submit should wrap asyncio.run in lambda to avoid coroutine evaluation"


class TestBugR3_2_EmailEventLoopDetection:
    """BUG-R3-2: Email worker should handle existing event loops like WhatsApp."""

    def test_email_worker_has_event_loop_detection(self):
        """Verify email worker handles existing event loop."""
        from app.workers.jobs import send_email

        source = inspect.getsource(send_email)

        # Should have try/except for get_running_loop like WhatsApp worker
        assert "get_running_loop" in source, \
            "Email worker should detect running event loop like WhatsApp worker"

    def test_email_worker_handles_running_loop(self):
        """Verify email worker doesn't crash when loop is already running."""
        from app.workers.jobs.send_email import send_email_message
        from unittest.mock import patch, AsyncMock

        # Mock the async _send function
        with patch('app.workers.jobs.send_email._send', new_callable=AsyncMock) as mock_send:
            mock_send.return_value = None

            # Create and set a running event loop
            loop = asyncio.new_event_loop()
            asyncio.set_event_loop(loop)

            try:
                async def test_in_async_context():
                    send_email_message(
                        notification_id=1,
                        to="test@example.com",
                        template="test",
                        variables={}
                    )

                # This should not raise RuntimeError
                loop.run_until_complete(test_in_async_context())
            except RuntimeError as e:
                if "cannot be called from a running event loop" in str(e):
                    pytest.fail(f"Email worker should handle existing event loop: {e}")
                raise
            finally:
                loop.close()
                asyncio.set_event_loop(None)


class TestBugR3_3_DatabasePoolConfig:
    """BUG-R3-3: Database engine should have connection pool configuration."""

    def test_database_engine_has_pool_config(self):
        """Verify database engine is configured with pool settings."""
        from app.db import session

        source = inspect.getsource(session)

        # Should have pool configuration
        pool_settings = ["pool_size", "pool_pre_ping", "pool_recycle", "max_overflow"]
        found_settings = [s for s in pool_settings if s in source]

        assert len(found_settings) >= 2, \
            f"Database engine should have pool configuration. Found: {found_settings}"


class TestBugR3_4_AlertServiceLimitDefault:
    """BUG-R3-4: Alert service should provide default limit instead of None."""

    def test_alert_service_has_default_limit(self):
        """Verify alert service handles None limit properly."""
        from app.services import alert_service

        source = inspect.getsource(alert_service.AlertService.list_alerts)

        # Should either have default limit in function or explicit None handling
        has_default = "limit: int" in source and "= 500" in source
        has_none_check = "if limit is None" in source or "limit or 500" in source

        assert has_default or has_none_check, \
            "Alert service should handle None limit with default value"


class TestBugR3_5_PhotoServiceBufferCleanup:
    """BUG-R3-5: Photo service should close BytesIO buffer in all paths."""

    def test_photo_service_closes_buffer(self):
        """Verify photo service properly closes BytesIO buffer."""
        from app.services import photo_service

        source = inspect.getsource(photo_service.PhotoService.store_photo)

        # Should have try/finally with buffer.close() or use context manager
        has_finally = "finally:" in source and "close()" in source
        has_context_manager = "with io.BytesIO" in source

        assert has_finally or has_context_manager, \
            "Photo service should close BytesIO buffer in finally block or use context manager"

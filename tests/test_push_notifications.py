"""Tests for Push Notifications functionality."""

from __future__ import annotations

from datetime import datetime, timezone
from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models.guardian import Guardian
from app.db.models.push_subscription import PushSubscription
from app.db.repositories.push_subscriptions import PushSubscriptionRepository


# ============================================================================
# Repository Tests
# ============================================================================


@pytest.fixture
async def push_repo(db_session: AsyncSession) -> PushSubscriptionRepository:
    """Create a push subscription repository."""
    return PushSubscriptionRepository(db_session)


@pytest.fixture
async def sample_subscription(
    db_session: AsyncSession, sample_guardian: Guardian
) -> PushSubscription:
    """Create a sample push subscription."""
    subscription = PushSubscription(
        guardian_id=sample_guardian.id,
        endpoint="https://fcm.googleapis.com/fcm/send/test-endpoint-123",
        p256dh="BNcRdreALRFXTkOOUHK1EtK2wtaz5Ry4YfYCA_0QTpQtUbVlUls0VJXg7A8u-Ts1XbjhazAkj7I99e8QcYP7DkM",
        auth="tBHItJI5svbpez7KI4CCXg",
        user_agent="Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120",
        device_name="Chrome Desktop",
        is_active=True,
    )
    db_session.add(subscription)
    await db_session.flush()
    return subscription


class TestPushSubscriptionRepository:
    """Tests for PushSubscriptionRepository."""

    async def test_create_subscription(
        self, push_repo: PushSubscriptionRepository, sample_guardian: Guardian
    ):
        """Test creating a new push subscription."""
        subscription = await push_repo.create(
            guardian_id=sample_guardian.id,
            endpoint="https://fcm.googleapis.com/fcm/send/new-endpoint",
            p256dh="test-p256dh-key",
            auth="test-auth-key",
            user_agent="Test User Agent",
            device_name="Test Device",
        )

        assert subscription.id is not None
        assert subscription.guardian_id == sample_guardian.id
        assert subscription.endpoint == "https://fcm.googleapis.com/fcm/send/new-endpoint"
        assert subscription.p256dh == "test-p256dh-key"
        assert subscription.auth == "test-auth-key"
        assert subscription.is_active is True

    async def test_get_by_id(
        self, push_repo: PushSubscriptionRepository, sample_subscription: PushSubscription
    ):
        """Test retrieving subscription by ID."""
        result = await push_repo.get_by_id(sample_subscription.id)

        assert result is not None
        assert result.id == sample_subscription.id
        assert result.endpoint == sample_subscription.endpoint

    async def test_get_by_id_not_found(self, push_repo: PushSubscriptionRepository):
        """Test retrieving non-existent subscription returns None."""
        result = await push_repo.get_by_id(99999)

        assert result is None

    async def test_get_by_endpoint(
        self, push_repo: PushSubscriptionRepository, sample_subscription: PushSubscription
    ):
        """Test retrieving subscription by endpoint."""
        result = await push_repo.get_by_endpoint(sample_subscription.endpoint)

        assert result is not None
        assert result.id == sample_subscription.id

    async def test_get_by_endpoint_not_found(self, push_repo: PushSubscriptionRepository):
        """Test retrieving by non-existent endpoint returns None."""
        result = await push_repo.get_by_endpoint("https://non-existent-endpoint.com")

        assert result is None

    async def test_list_by_guardian(
        self,
        push_repo: PushSubscriptionRepository,
        sample_guardian: Guardian,
        sample_subscription: PushSubscription,
    ):
        """Test listing subscriptions by guardian."""
        # Create another subscription for the same guardian
        await push_repo.create(
            guardian_id=sample_guardian.id,
            endpoint="https://fcm.googleapis.com/fcm/send/second-endpoint",
            p256dh="test-p256dh-2",
            auth="test-auth-2",
        )

        result = await push_repo.list_by_guardian(sample_guardian.id)

        assert len(result) == 2
        assert all(s.guardian_id == sample_guardian.id for s in result)

    async def test_list_by_guardian_excludes_inactive(
        self,
        db_session: AsyncSession,
        push_repo: PushSubscriptionRepository,
        sample_guardian: Guardian,
    ):
        """Test that listing by guardian excludes inactive subscriptions."""
        # Create active subscription
        active = await push_repo.create(
            guardian_id=sample_guardian.id,
            endpoint="https://fcm.googleapis.com/fcm/send/active",
            p256dh="test-p256dh",
            auth="test-auth",
        )

        # Create inactive subscription
        inactive = PushSubscription(
            guardian_id=sample_guardian.id,
            endpoint="https://fcm.googleapis.com/fcm/send/inactive",
            p256dh="test-p256dh-2",
            auth="test-auth-2",
            is_active=False,
        )
        db_session.add(inactive)
        await db_session.flush()

        result = await push_repo.list_by_guardian(sample_guardian.id)

        assert len(result) == 1
        assert result[0].id == active.id

    async def test_update_or_create_creates_new(
        self, push_repo: PushSubscriptionRepository, sample_guardian: Guardian
    ):
        """Test update_or_create creates new subscription if not exists."""
        endpoint = "https://fcm.googleapis.com/fcm/send/brand-new"

        result = await push_repo.update_or_create(
            guardian_id=sample_guardian.id,
            endpoint=endpoint,
            p256dh="new-p256dh",
            auth="new-auth",
        )

        assert result.id is not None
        assert result.endpoint == endpoint
        assert result.p256dh == "new-p256dh"

    async def test_update_or_create_updates_existing(
        self, push_repo: PushSubscriptionRepository, sample_subscription: PushSubscription
    ):
        """Test update_or_create updates existing subscription."""
        original_id = sample_subscription.id

        result = await push_repo.update_or_create(
            guardian_id=sample_subscription.guardian_id,
            endpoint=sample_subscription.endpoint,
            p256dh="updated-p256dh",
            auth="updated-auth",
        )

        assert result.id == original_id
        assert result.p256dh == "updated-p256dh"
        assert result.auth == "updated-auth"
        assert result.is_active is True

    async def test_deactivate(
        self, push_repo: PushSubscriptionRepository, sample_subscription: PushSubscription
    ):
        """Test deactivating a subscription."""
        result = await push_repo.deactivate(sample_subscription.id)

        assert result is True

        # Verify it's deactivated
        subscription = await push_repo.get_by_id(sample_subscription.id)
        assert subscription.is_active is False

    async def test_deactivate_not_found(self, push_repo: PushSubscriptionRepository):
        """Test deactivating non-existent subscription returns False."""
        result = await push_repo.deactivate(99999)

        assert result is False

    async def test_deactivate_by_endpoint(
        self, push_repo: PushSubscriptionRepository, sample_subscription: PushSubscription
    ):
        """Test deactivating by endpoint."""
        result = await push_repo.deactivate_by_endpoint(sample_subscription.endpoint)

        assert result is True

        subscription = await push_repo.get_by_id(sample_subscription.id)
        assert subscription.is_active is False

    async def test_delete(
        self,
        db_session: AsyncSession,
        push_repo: PushSubscriptionRepository,
        sample_subscription: PushSubscription,
    ):
        """Test deleting a subscription."""
        subscription_id = sample_subscription.id

        result = await push_repo.delete(subscription_id)

        assert result is True

        # Verify it's deleted
        deleted = await push_repo.get_by_id(subscription_id)
        assert deleted is None

    async def test_delete_not_found(self, push_repo: PushSubscriptionRepository):
        """Test deleting non-existent subscription returns False."""
        result = await push_repo.delete(99999)

        assert result is False

    async def test_delete_by_endpoint(
        self, push_repo: PushSubscriptionRepository, sample_subscription: PushSubscription
    ):
        """Test deleting by endpoint."""
        result = await push_repo.delete_by_endpoint(sample_subscription.endpoint)

        assert result is True

    async def test_delete_all_for_guardian(
        self,
        push_repo: PushSubscriptionRepository,
        sample_guardian: Guardian,
        sample_subscription: PushSubscription,
    ):
        """Test deleting all subscriptions for a guardian."""
        # Create another subscription
        await push_repo.create(
            guardian_id=sample_guardian.id,
            endpoint="https://fcm.googleapis.com/fcm/send/second",
            p256dh="test",
            auth="test",
        )

        result = await push_repo.delete_all_for_guardian(sample_guardian.id)

        assert result == 2

        # Verify all deleted
        remaining = await push_repo.list_by_guardian(sample_guardian.id)
        assert len(remaining) == 0


# ============================================================================
# Worker Tests
# ============================================================================

# Check if pywebpush is available
try:
    import pywebpush
    HAS_PYWEBPUSH = True
except ImportError:
    HAS_PYWEBPUSH = False


@pytest.mark.skipif(not HAS_PYWEBPUSH, reason="pywebpush not installed")
class TestSendPushWorker:
    """Tests for send_push worker job."""

    def test_send_push_notification_simulated(self):
        """Test push notification in simulated mode (ENABLE_REAL_NOTIFICATIONS=false)."""
        from app.workers.jobs.send_push import send_push_notification

        subscription_info = {
            "endpoint": "https://fcm.googleapis.com/fcm/send/test",
            "keys": {
                "p256dh": "test-key",
                "auth": "test-auth",
            },
        }
        payload = {
            "title": "Test Notification",
            "body": "This is a test",
        }

        with patch("app.workers.jobs.send_push.settings") as mock_settings:
            mock_settings.enable_real_notifications = False
            mock_settings.vapid_private_key = "test-private-key"
            mock_settings.vapid_public_key = "test-public-key"

            result = send_push_notification(
                notification_id=1,
                subscription_info=subscription_info,
                payload=payload,
            )

            assert result is True

    def test_send_push_notification_without_vapid_keys(self):
        """Test push notification fails gracefully without VAPID keys."""
        from app.workers.jobs.send_push import send_push_notification

        subscription_info = {"endpoint": "https://test.com", "keys": {}}
        payload = {"title": "Test"}

        with patch("app.workers.jobs.send_push.settings") as mock_settings:
            mock_settings.enable_real_notifications = True
            mock_settings.vapid_private_key = ""
            mock_settings.vapid_public_key = ""

            result = send_push_notification(
                notification_id=1,
                subscription_info=subscription_info,
                payload=payload,
            )

            assert result is False

    def test_send_push_notification_real_mode_success(self):
        """Test push notification in real mode with mocked webpush."""
        from app.workers.jobs.send_push import send_push_notification

        subscription_info = {
            "endpoint": "https://fcm.googleapis.com/fcm/send/real-test",
            "keys": {
                "p256dh": "real-key",
                "auth": "real-auth",
            },
        }
        payload = {"title": "Real Test", "body": "Body"}

        with patch("app.workers.jobs.send_push.settings") as mock_settings, \
             patch("app.workers.jobs.send_push.webpush") as mock_webpush:
            mock_settings.enable_real_notifications = True
            mock_settings.vapid_private_key = "test-private-key"
            mock_settings.vapid_public_key = "test-public-key"
            mock_settings.vapid_subject = "mailto:test@test.com"
            mock_webpush.return_value = MagicMock(status_code=201)

            result = send_push_notification(
                notification_id=1,
                subscription_info=subscription_info,
                payload=payload,
            )

            assert result is True
            mock_webpush.assert_called_once()

    def test_send_push_notification_webpush_error(self):
        """Test push notification handles WebPushException."""
        from pywebpush import WebPushException  # noqa: F401 - available due to skipif
        from app.workers.jobs.send_push import send_push_notification

        subscription_info = {"endpoint": "https://test.com", "keys": {}}
        payload = {"title": "Test"}

        with patch("app.workers.jobs.send_push.settings") as mock_settings, \
             patch("app.workers.jobs.send_push.webpush") as mock_webpush:
            mock_settings.enable_real_notifications = True
            mock_settings.vapid_private_key = "test-private-key"
            mock_settings.vapid_public_key = "test-public-key"
            mock_settings.vapid_subject = "mailto:test@test.com"

            # Simulate WebPushException
            mock_webpush.side_effect = WebPushException("Test error")

            result = send_push_notification(
                notification_id=1,
                subscription_info=subscription_info,
                payload=payload,
            )

            assert result is False

    def test_send_push_batch(self):
        """Test sending batch of push notifications."""
        from app.workers.jobs.send_push import send_push_batch

        notifications = [
            {
                "notification_id": 1,
                "subscription_info": {"endpoint": "https://test1.com", "keys": {}},
                "payload": {"title": "Test 1"},
            },
            {
                "notification_id": 2,
                "subscription_info": {"endpoint": "https://test2.com", "keys": {}},
                "payload": {"title": "Test 2"},
            },
        ]

        with patch("app.workers.jobs.send_push.settings") as mock_settings:
            mock_settings.enable_real_notifications = False
            mock_settings.vapid_private_key = "test-private-key"
            mock_settings.vapid_public_key = "test-public-key"

            result = send_push_batch(notifications)

            assert result["success"] == 2
            assert result["failed"] == 0


# ============================================================================
# API Tests
# ============================================================================


class TestPushSubscriptionAPI:
    """Tests for Push Subscription API endpoints."""

    @pytest.fixture
    def mock_user_with_guardian(self):
        """Create a mock user with guardian_id."""
        user = MagicMock()
        user.id = 1
        user.guardian_id = 1
        user.role = "PARENT"
        return user

    @pytest.fixture
    def mock_user_without_guardian(self):
        """Create a mock user without guardian_id (e.g., staff)."""
        user = MagicMock()
        user.id = 2
        user.guardian_id = None
        user.role = "ADMIN"
        return user

    def test_get_vapid_public_key_success(self):
        """Test getting VAPID public key when configured."""
        from app.api.v1.push_subscriptions import get_vapid_public_key
        from app.schemas.push_subscription import VapidPublicKeyResponse
        import asyncio

        with patch("app.api.v1.push_subscriptions.settings") as mock_settings:
            mock_settings.vapid_public_key = "test-vapid-public-key"

            result = asyncio.get_event_loop().run_until_complete(get_vapid_public_key())

            assert isinstance(result, VapidPublicKeyResponse)
            assert result.public_key == "test-vapid-public-key"

    def test_get_vapid_public_key_not_configured(self):
        """Test getting VAPID public key when not configured."""
        from app.api.v1.push_subscriptions import get_vapid_public_key
        from fastapi import HTTPException
        import asyncio

        with patch("app.api.v1.push_subscriptions.settings") as mock_settings:
            mock_settings.vapid_public_key = ""

            with pytest.raises(HTTPException) as exc_info:
                asyncio.get_event_loop().run_until_complete(get_vapid_public_key())

            assert exc_info.value.status_code == 503
            assert "not configured" in exc_info.value.detail

    async def test_subscribe_success(
        self,
        db_session: AsyncSession,
        sample_guardian: Guardian,
        mock_user_with_guardian,
    ):
        """Test successful push subscription."""
        from app.api.v1.push_subscriptions import subscribe
        from app.schemas.push_subscription import PushSubscriptionCreate, PushSubscriptionKeys

        mock_user_with_guardian.guardian_id = sample_guardian.id
        push_repo = PushSubscriptionRepository(db_session)

        subscription_data = PushSubscriptionCreate(
            endpoint="https://fcm.googleapis.com/fcm/send/api-test",
            keys=PushSubscriptionKeys(
                p256dh="api-test-p256dh",
                auth="api-test-auth",
            ),
            device_name="API Test Device",
        )

        with patch("app.api.v1.push_subscriptions.settings") as mock_settings:
            mock_settings.vapid_public_key = "test-vapid-key"

            result = await subscribe(
                subscription=subscription_data,
                current_user=mock_user_with_guardian,
                push_repo=push_repo,
                user_agent="Test Agent",
            )

            assert result.endpoint == subscription_data.endpoint
            assert result.is_active is True

    async def test_subscribe_not_guardian_fails(
        self,
        db_session: AsyncSession,
        mock_user_without_guardian,
    ):
        """Test that non-guardians cannot subscribe."""
        from app.api.v1.push_subscriptions import subscribe
        from app.schemas.push_subscription import PushSubscriptionCreate, PushSubscriptionKeys
        from fastapi import HTTPException

        push_repo = PushSubscriptionRepository(db_session)

        subscription_data = PushSubscriptionCreate(
            endpoint="https://test.com",
            keys=PushSubscriptionKeys(p256dh="test", auth="test"),
        )

        with patch("app.api.v1.push_subscriptions.settings") as mock_settings:
            mock_settings.vapid_public_key = "test-vapid-key"

            with pytest.raises(HTTPException) as exc_info:
                await subscribe(
                    subscription=subscription_data,
                    current_user=mock_user_without_guardian,
                    push_repo=push_repo,
                )

            assert exc_info.value.status_code == 403
            assert "Only guardians" in exc_info.value.detail

    async def test_unsubscribe_success(
        self,
        db_session: AsyncSession,
        sample_guardian: Guardian,
        sample_subscription: PushSubscription,
        mock_user_with_guardian,
    ):
        """Test successful unsubscribe."""
        from app.api.v1.push_subscriptions import unsubscribe

        mock_user_with_guardian.guardian_id = sample_guardian.id
        push_repo = PushSubscriptionRepository(db_session)

        await unsubscribe(
            endpoint=sample_subscription.endpoint,
            current_user=mock_user_with_guardian,
            push_repo=push_repo,
        )

        # Verify deactivated
        subscription = await push_repo.get_by_id(sample_subscription.id)
        assert subscription.is_active is False

    async def test_unsubscribe_unauthorized(
        self,
        db_session: AsyncSession,
        sample_subscription: PushSubscription,
        mock_user_with_guardian,
    ):
        """Test unsubscribe fails for different guardian."""
        from app.api.v1.push_subscriptions import unsubscribe
        from fastapi import HTTPException

        mock_user_with_guardian.guardian_id = 999  # Different guardian
        push_repo = PushSubscriptionRepository(db_session)

        with pytest.raises(HTTPException) as exc_info:
            await unsubscribe(
                endpoint=sample_subscription.endpoint,
                current_user=mock_user_with_guardian,
                push_repo=push_repo,
            )

        assert exc_info.value.status_code == 403

    async def test_list_subscriptions(
        self,
        db_session: AsyncSession,
        sample_guardian: Guardian,
        sample_subscription: PushSubscription,
        mock_user_with_guardian,
    ):
        """Test listing subscriptions."""
        from app.api.v1.push_subscriptions import list_subscriptions

        mock_user_with_guardian.guardian_id = sample_guardian.id
        push_repo = PushSubscriptionRepository(db_session)

        result = await list_subscriptions(
            current_user=mock_user_with_guardian,
            push_repo=push_repo,
        )

        assert len(result.subscriptions) == 1
        assert result.subscriptions[0].endpoint == sample_subscription.endpoint

    async def test_delete_subscription_success(
        self,
        db_session: AsyncSession,
        sample_guardian: Guardian,
        sample_subscription: PushSubscription,
        mock_user_with_guardian,
    ):
        """Test deleting a subscription."""
        from app.api.v1.push_subscriptions import delete_subscription

        mock_user_with_guardian.guardian_id = sample_guardian.id
        push_repo = PushSubscriptionRepository(db_session)

        await delete_subscription(
            subscription_id=sample_subscription.id,
            current_user=mock_user_with_guardian,
            push_repo=push_repo,
        )

        # Verify deleted
        deleted = await push_repo.get_by_id(sample_subscription.id)
        assert deleted is None

    async def test_delete_subscription_not_found(
        self,
        db_session: AsyncSession,
        mock_user_with_guardian,
    ):
        """Test deleting non-existent subscription."""
        from app.api.v1.push_subscriptions import delete_subscription
        from fastapi import HTTPException

        push_repo = PushSubscriptionRepository(db_session)

        with pytest.raises(HTTPException) as exc_info:
            await delete_subscription(
                subscription_id=99999,
                current_user=mock_user_with_guardian,
                push_repo=push_repo,
            )

        assert exc_info.value.status_code == 404

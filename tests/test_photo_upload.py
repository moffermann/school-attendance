"""Tests for photo upload validation in AttendanceService."""

from __future__ import annotations

from datetime import datetime
from types import SimpleNamespace
from unittest.mock import AsyncMock, MagicMock

import pytest

from app.services.attendance_service import AttendanceService

# Valid magic bytes for different image types
JPEG_MAGIC = b"\xff\xd8\xff\xe0\x00\x10JFIF" + b"\x00" * 100  # JPEG header
PNG_MAGIC = b"\x89PNG\r\n\x1a\n" + b"\x00" * 100  # PNG header
WEBP_MAGIC = b"RIFF\x00\x00\x00\x00WEBP" + b"\x00" * 100  # WebP header
GIF_MAGIC = b"GIF89a" + b"\x00" * 100  # GIF header


class FakeUploadFile:
    """Fake UploadFile for testing with chunk support."""

    def __init__(self, content: bytes, content_type: str, filename: str):
        self._content = content
        self._position = 0
        self.content_type = content_type
        self.filename = filename

    async def read(self, size: int = -1) -> bytes:
        """Read content in chunks, like real UploadFile."""
        if size == -1 or size >= len(self._content) - self._position:
            result = self._content[self._position :]
            self._position = len(self._content)
            return result
        result = self._content[self._position : self._position + size]
        self._position += size
        return result


@pytest.fixture
def attendance_service():
    """Create AttendanceService with mocked dependencies."""
    session = MagicMock()
    session.commit = AsyncMock()
    service = AttendanceService(session)
    # Mock the photo service
    service.photo_service = MagicMock()
    service.photo_service.store_photo = AsyncMock(return_value="stored_key")
    return service


class TestPhotoUploadValidation:
    """Test suite for photo upload validation."""

    @pytest.mark.anyio
    async def test_rejects_invalid_mime_type(self, attendance_service):
        """Should reject files with invalid MIME types."""
        fake_file = FakeUploadFile(
            content=b"fake content",
            content_type="application/pdf",
            filename="document.pdf",
        )

        with pytest.raises(ValueError) as exc_info:
            await attendance_service.attach_photo(1, fake_file)

        assert "Tipo de archivo no permitido" in str(exc_info.value)
        assert "application/pdf" in str(exc_info.value)

    @pytest.mark.anyio
    async def test_rejects_empty_file(self, attendance_service):
        """Should reject empty files."""
        fake_file = FakeUploadFile(
            content=b"",
            content_type="image/jpeg",
            filename="empty.jpg",
        )

        with pytest.raises(ValueError) as exc_info:
            await attendance_service.attach_photo(1, fake_file)

        assert "Archivo vacío" in str(exc_info.value)

    @pytest.mark.anyio
    async def test_rejects_file_too_large(self, attendance_service):
        """Should reject files larger than MAX_PHOTO_SIZE (10MB)."""
        # Create a file slightly larger than 10MB
        large_content = b"x" * (11 * 1024 * 1024)
        fake_file = FakeUploadFile(
            content=large_content,
            content_type="image/jpeg",
            filename="huge.jpg",
        )

        with pytest.raises(ValueError) as exc_info:
            await attendance_service.attach_photo(1, fake_file)

        assert "Archivo muy grande" in str(exc_info.value)
        assert "10MB" in str(exc_info.value)

    @pytest.mark.anyio
    async def test_rejects_invalid_extension(self, attendance_service):
        """Should reject files with invalid extensions."""
        fake_file = FakeUploadFile(
            content=JPEG_MAGIC,  # Valid JPEG content
            content_type="image/jpeg",  # Valid MIME but wrong extension
            filename="malicious.exe",
        )

        with pytest.raises(ValueError) as exc_info:
            await attendance_service.attach_photo(1, fake_file)

        assert "Extensión no permitida" in str(exc_info.value)
        assert "exe" in str(exc_info.value)

    @pytest.mark.anyio
    async def test_accepts_valid_jpeg(self, attendance_service):
        """Should accept valid JPEG files."""
        fake_file = FakeUploadFile(
            content=JPEG_MAGIC,
            content_type="image/jpeg",
            filename="photo.jpg",
        )

        # Mock the repository to return a fake event
        fake_event = SimpleNamespace(
            id=1,
            student_id=1,
            type="IN",
            gate_id="GATE-1",
            device_id="DEV-1",
            occurred_at=datetime.utcnow(),
            local_seq=None,
            photo_ref="events/1/abc.jpg",
            synced_at=None,
        )
        attendance_service.attendance_repo.update_photo_ref = AsyncMock(return_value=fake_event)

        result = await attendance_service.attach_photo(1, fake_file)

        assert result.photo_ref == "events/1/abc.jpg"
        attendance_service.photo_service.store_photo.assert_awaited_once()

    @pytest.mark.anyio
    async def test_accepts_valid_png(self, attendance_service):
        """Should accept valid PNG files."""
        fake_file = FakeUploadFile(
            content=PNG_MAGIC,
            content_type="image/png",
            filename="photo.png",
        )

        fake_event = SimpleNamespace(
            id=1,
            student_id=1,
            type="IN",
            gate_id="GATE-1",
            device_id="DEV-1",
            occurred_at=datetime.utcnow(),
            local_seq=None,
            photo_ref="events/1/abc.png",
            synced_at=None,
        )
        attendance_service.attendance_repo.update_photo_ref = AsyncMock(return_value=fake_event)

        result = await attendance_service.attach_photo(1, fake_file)

        assert result is not None
        attendance_service.photo_service.store_photo.assert_awaited_once()

    @pytest.mark.anyio
    async def test_accepts_valid_webp(self, attendance_service):
        """Should accept valid WebP files."""
        fake_file = FakeUploadFile(
            content=WEBP_MAGIC,
            content_type="image/webp",
            filename="photo.webp",
        )

        fake_event = SimpleNamespace(
            id=1,
            student_id=1,
            type="IN",
            gate_id="GATE-1",
            device_id="DEV-1",
            occurred_at=datetime.utcnow(),
            local_seq=None,
            photo_ref="events/1/abc.webp",
            synced_at=None,
        )
        attendance_service.attendance_repo.update_photo_ref = AsyncMock(return_value=fake_event)

        result = await attendance_service.attach_photo(1, fake_file)

        assert result is not None

    @pytest.mark.anyio
    async def test_sanitizes_path_traversal_in_filename(self, attendance_service):
        """Should sanitize path traversal attempts in filename."""
        fake_file = FakeUploadFile(
            content=JPEG_MAGIC,
            content_type="image/jpeg",
            filename="../../../etc/passwd.jpg",
        )

        fake_event = SimpleNamespace(
            id=1,
            student_id=1,
            type="IN",
            gate_id="GATE-1",
            device_id="DEV-1",
            occurred_at=datetime.utcnow(),
            local_seq=None,
            photo_ref="events/1/abc.jpg",
            synced_at=None,
        )
        attendance_service.attendance_repo.update_photo_ref = AsyncMock(return_value=fake_event)

        # Should not raise - path traversal should be sanitized
        result = await attendance_service.attach_photo(1, fake_file)
        assert result is not None

        # Verify the stored key doesn't contain path traversal
        call_args = attendance_service.photo_service.store_photo.call_args
        stored_key = call_args[0][0]
        assert ".." not in stored_key
        assert stored_key.startswith("events/1/")

    @pytest.mark.anyio
    async def test_handles_missing_filename(self, attendance_service):
        """Should handle files with no filename."""
        fake_file = FakeUploadFile(
            content=JPEG_MAGIC,
            content_type="image/jpeg",
            filename=None,
        )

        fake_event = SimpleNamespace(
            id=1,
            student_id=1,
            type="IN",
            gate_id="GATE-1",
            device_id="DEV-1",
            occurred_at=datetime.utcnow(),
            local_seq=None,
            photo_ref="events/1/abc.jpg",
            synced_at=None,
        )
        attendance_service.attendance_repo.update_photo_ref = AsyncMock(return_value=fake_event)

        # Should use default extension
        result = await attendance_service.attach_photo(1, fake_file)
        assert result is not None

    @pytest.mark.anyio
    async def test_case_insensitive_mime_type(self, attendance_service):
        """Should handle MIME types case-insensitively."""
        fake_file = FakeUploadFile(
            content=JPEG_MAGIC,
            content_type="IMAGE/JPEG",  # Uppercase
            filename="photo.jpg",
        )

        fake_event = SimpleNamespace(
            id=1,
            student_id=1,
            type="IN",
            gate_id="GATE-1",
            device_id="DEV-1",
            occurred_at=datetime.utcnow(),
            local_seq=None,
            photo_ref="events/1/abc.jpg",
            synced_at=None,
        )
        attendance_service.attendance_repo.update_photo_ref = AsyncMock(return_value=fake_event)

        result = await attendance_service.attach_photo(1, fake_file)
        assert result is not None


class TestAllowedTypes:
    """Test that all documented types are correctly configured."""

    def test_allowed_mime_types(self):
        """Verify ALLOWED_MIME_TYPES contains expected values."""
        expected = {"image/jpeg", "image/png", "image/gif", "image/webp"}
        assert AttendanceService.ALLOWED_MIME_TYPES == expected

    def test_allowed_extensions(self):
        """Verify ALLOWED_EXTENSIONS contains expected values."""
        expected = {"jpg", "jpeg", "png", "gif", "webp"}
        assert AttendanceService.ALLOWED_EXTENSIONS == expected

    def test_max_photo_size(self):
        """Verify MAX_PHOTO_SIZE is 10MB."""
        assert AttendanceService.MAX_PHOTO_SIZE == 10 * 1024 * 1024

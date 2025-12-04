"""Tag provisioning schemas."""

from pydantic import BaseModel, Field


class TagProvisionRequest(BaseModel):
    student_id: int


class TagProvisionResponse(BaseModel):
    ndef_uri: str
    # R13-VAL4 fix: Add max_length to match DB constraint (16 chars)
    tag_token_preview: str = Field(..., max_length=16)
    checksum: str


class TagConfirmRequest(BaseModel):
    student_id: int
    # R13-VAL4 fix: Add max_length to match DB constraint (16 chars)
    tag_token_preview: str = Field(..., max_length=16)
    tag_uid: str | None = None


class TagRead(BaseModel):
    id: int
    student_id: int
    status: str
    # R13-VAL4 fix: Add max_length to match DB constraint (16 chars)
    tag_token_preview: str = Field(..., max_length=16)

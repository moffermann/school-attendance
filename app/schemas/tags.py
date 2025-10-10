"""Tag provisioning schemas."""

from pydantic import BaseModel


class TagProvisionRequest(BaseModel):
    student_id: int


class TagProvisionResponse(BaseModel):
    ndef_uri: str
    tag_token_preview: str
    checksum: str


class TagConfirmRequest(BaseModel):
    student_id: int
    tag_token_preview: str
    tag_uid: str | None = None


class TagRead(BaseModel):
    id: int
    student_id: int
    status: str
    tag_token_preview: str

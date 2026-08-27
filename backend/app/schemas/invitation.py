import uuid
from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, EmailStr


class InvitationCreate(BaseModel):
    email: EmailStr
    role: Literal["owner", "member"] = "member"


class InvitationOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    project_id: uuid.UUID
    email: str
    role: str
    status: str
    created_at: datetime

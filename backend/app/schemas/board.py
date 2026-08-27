import uuid
from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field

from app.schemas.user import UserOut

Priority = Literal["low", "medium", "high"]


# --- Statuses ---
class StatusCreate(BaseModel):
    name: str = Field(min_length=1, max_length=100)
    color: str = Field(default="#94a3b8", max_length=20)
    position: int | None = None


class StatusUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=100)
    color: str | None = Field(default=None, max_length=20)
    position: int | None = None


class StatusOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    project_id: uuid.UUID
    name: str
    color: str
    position: int


# --- Labels ---
class LabelCreate(BaseModel):
    name: str = Field(min_length=1, max_length=60)
    color: str = Field(default="#6366f1", max_length=20)


class LabelUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=60)
    color: str | None = Field(default=None, max_length=20)


class LabelOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    project_id: uuid.UUID
    name: str
    color: str


# --- Tasks ---
class TaskCreate(BaseModel):
    title: str = Field(min_length=1, max_length=255)
    description: str | None = None
    due_date: datetime | None = None
    status_id: uuid.UUID | None = None  # defaults to the first status if omitted
    assignee_id: uuid.UUID | None = None
    priority: Priority = "medium"
    label_ids: list[uuid.UUID] = Field(default_factory=list)


class TaskUpdate(BaseModel):
    title: str | None = Field(default=None, min_length=1, max_length=255)
    description: str | None = None
    due_date: datetime | None = None
    status_id: uuid.UUID | None = None
    assignee_id: uuid.UUID | None = None
    priority: Priority | None = None
    label_ids: list[uuid.UUID] | None = None


class TaskMove(BaseModel):
    """Move a task to a status at a given position (Kanban drag & drop)."""

    status_id: uuid.UUID
    position: int = Field(ge=0)


class TaskOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    project_id: uuid.UUID
    title: str
    description: str | None
    due_date: datetime | None
    status_id: uuid.UUID
    assignee_id: uuid.UUID | None
    assignee: UserOut | None
    priority: str
    position: int
    labels: list[LabelOut]
    created_by: uuid.UUID | None
    created_at: datetime
    updated_at: datetime

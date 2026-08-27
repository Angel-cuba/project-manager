import uuid
from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, String, Uuid, UniqueConstraint, func
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base
from app.models.project import ROLE_MEMBER

# Invitation lifecycle states.
STATUS_PENDING = "pending"
STATUS_ACCEPTED = "accepted"


class Invitation(Base):
    __tablename__ = "invitations"
    __table_args__ = (
        UniqueConstraint("project_id", "email", name="uq_invitation_project_email"),
    )

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    project_id: Mapped[uuid.UUID] = mapped_column(
        Uuid, ForeignKey("projects.id", ondelete="CASCADE"), nullable=False, index=True
    )
    email: Mapped[str] = mapped_column(String(255), nullable=False, index=True)
    role: Mapped[str] = mapped_column(String(20), nullable=False, default=ROLE_MEMBER)
    status: Mapped[str] = mapped_column(
        String(20), nullable=False, default=STATUS_PENDING
    )
    invited_by: Mapped[uuid.UUID | None] = mapped_column(
        Uuid, ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

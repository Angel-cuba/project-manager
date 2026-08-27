import uuid

from fastapi import APIRouter, HTTPException, status
from sqlalchemy import select

from app.core.deps import DbSession, OwnerAccess, ProjectAccess
from app.models.invitation import STATUS_ACCEPTED, STATUS_PENDING, Invitation
from app.models.project import ProjectMember
from app.models.user import User
from app.schemas.invitation import InvitationCreate, InvitationOut

router = APIRouter(prefix="/projects/{project_id}/invitations", tags=["invitations"])


@router.get("", response_model=list[InvitationOut])
def list_invitations(access: ProjectAccess, db: DbSession) -> list[Invitation]:
    project, _ = access
    return list(
        db.scalars(
            select(Invitation)
            .where(Invitation.project_id == project.id)
            .order_by(Invitation.created_at)
        ).all()
    )


@router.post("", response_model=InvitationOut, status_code=status.HTTP_201_CREATED)
def create_invitation(
    data: InvitationCreate, access: OwnerAccess, db: DbSession
) -> Invitation:
    project, membership = access
    user = db.scalar(select(User).where(User.email == data.email))

    if user is not None:
        # The invitee already has an account: resolve the invite immediately.
        existing_member = db.scalar(
            select(ProjectMember).where(
                ProjectMember.project_id == project.id,
                ProjectMember.user_id == user.id,
            )
        )
        if existing_member is not None:
            raise HTTPException(
                status.HTTP_409_CONFLICT, "User is already a member"
            )
        db.add(
            ProjectMember(
                project_id=project.id, user_id=user.id, role=data.role
            )
        )
        invitation = Invitation(
            project_id=project.id,
            email=data.email,
            role=data.role,
            status=STATUS_ACCEPTED,
            invited_by=membership.user_id,
        )
        db.add(invitation)
        db.commit()
        db.refresh(invitation)
        return invitation

    # No account yet: record a pending invitation for auto-accept on register.
    existing_pending = db.scalar(
        select(Invitation).where(
            Invitation.project_id == project.id,
            Invitation.email == data.email,
            Invitation.status == STATUS_PENDING,
        )
    )
    if existing_pending is not None:
        raise HTTPException(
            status.HTTP_409_CONFLICT, "A pending invitation already exists"
        )
    invitation = Invitation(
        project_id=project.id,
        email=data.email,
        role=data.role,
        status=STATUS_PENDING,
        invited_by=membership.user_id,
    )
    db.add(invitation)
    db.commit()
    db.refresh(invitation)
    return invitation


@router.delete("/{invitation_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_invitation(
    invitation_id: uuid.UUID, access: OwnerAccess, db: DbSession
) -> None:
    project, _ = access
    invitation = db.scalar(
        select(Invitation).where(
            Invitation.id == invitation_id,
            Invitation.project_id == project.id,
        )
    )
    if invitation is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Invitation not found")
    db.delete(invitation)
    db.commit()

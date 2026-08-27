import uuid

from fastapi import APIRouter, HTTPException, status
from sqlalchemy import select

from app.core.deps import DbSession, OwnerAccess, ProjectAccess
from app.models.project import ROLE_OWNER, Project, ProjectMember
from app.models.user import User
from app.schemas.project import MemberAdd, MemberOut, MemberRoleUpdate

router = APIRouter(prefix="/projects/{project_id}/members", tags=["members"])


@router.get("", response_model=list[MemberOut])
def list_members(access: ProjectAccess, db: DbSession) -> list[ProjectMember]:
    project, _ = access
    return list(
        db.scalars(
            select(ProjectMember)
            .where(ProjectMember.project_id == project.id)
            .order_by(ProjectMember.created_at)
        ).all()
    )


@router.post("", response_model=MemberOut, status_code=status.HTTP_201_CREATED)
def add_member(data: MemberAdd, access: OwnerAccess, db: DbSession) -> ProjectMember:
    project, _ = access
    if db.get(User, data.user_id) is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "User not found")
    existing = db.scalar(
        select(ProjectMember).where(
            ProjectMember.project_id == project.id,
            ProjectMember.user_id == data.user_id,
        )
    )
    if existing:
        raise HTTPException(status.HTTP_409_CONFLICT, "User is already a member")
    member = ProjectMember(
        project_id=project.id, user_id=data.user_id, role=data.role
    )
    db.add(member)
    db.commit()
    db.refresh(member)
    return member


def _get_member_or_404(
    db: DbSession, project: Project, user_id: uuid.UUID
) -> ProjectMember:
    member = db.scalar(
        select(ProjectMember).where(
            ProjectMember.project_id == project.id,
            ProjectMember.user_id == user_id,
        )
    )
    if member is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Member not found")
    return member


@router.patch("/{user_id}", response_model=MemberOut)
def update_member_role(
    user_id: uuid.UUID, data: MemberRoleUpdate, access: OwnerAccess, db: DbSession
) -> ProjectMember:
    project, _ = access
    member = _get_member_or_404(db, project, user_id)
    # Prevent demoting the last owner, which would orphan the project.
    if member.role == ROLE_OWNER and data.role != ROLE_OWNER:
        owner_count = len(
            db.scalars(
                select(ProjectMember).where(
                    ProjectMember.project_id == project.id,
                    ProjectMember.role == ROLE_OWNER,
                )
            ).all()
        )
        if owner_count <= 1:
            raise HTTPException(
                status.HTTP_400_BAD_REQUEST, "A project must keep at least one owner"
            )
    member.role = data.role
    db.commit()
    db.refresh(member)
    return member


@router.delete("/{user_id}", status_code=status.HTTP_204_NO_CONTENT)
def remove_member(user_id: uuid.UUID, access: OwnerAccess, db: DbSession) -> None:
    project, _ = access
    member = _get_member_or_404(db, project, user_id)
    if member.role == ROLE_OWNER and member.user_id == project.owner_id:
        raise HTTPException(
            status.HTTP_400_BAD_REQUEST, "Cannot remove the project creator"
        )
    db.delete(member)
    db.commit()

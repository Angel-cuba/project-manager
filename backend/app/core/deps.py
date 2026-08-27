"""Reusable FastAPI dependencies: current user + project access control."""
import uuid
from typing import Annotated

import jwt
from fastapi import Depends, HTTPException, Path, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.security import ACCESS, decode_token
from app.models.project import ROLE_OWNER, Project, ProjectMember
from app.models.user import User

_bearer = HTTPBearer(auto_error=True)

_CREDENTIALS_EXC = HTTPException(
    status_code=status.HTTP_401_UNAUTHORIZED,
    detail="Could not validate credentials",
    headers={"WWW-Authenticate": "Bearer"},
)


def get_user_from_token(token: str, db: Session, *, expected_type: str = ACCESS) -> User:
    try:
        payload = decode_token(token)
    except jwt.PyJWTError:
        raise _CREDENTIALS_EXC
    if payload.get("type") != expected_type:
        raise _CREDENTIALS_EXC
    sub = payload.get("sub")
    if not sub:
        raise _CREDENTIALS_EXC
    try:
        user_id = uuid.UUID(sub)
    except (ValueError, TypeError):
        raise _CREDENTIALS_EXC
    user = db.get(User, user_id)
    if user is None:
        raise _CREDENTIALS_EXC
    return user


def get_current_user(
    credentials: Annotated[HTTPAuthorizationCredentials, Depends(_bearer)],
    db: Annotated[Session, Depends(get_db)],
) -> User:
    return get_user_from_token(credentials.credentials, db)


CurrentUser = Annotated[User, Depends(get_current_user)]
DbSession = Annotated[Session, Depends(get_db)]


def _get_membership(
    db: Session, project_id: uuid.UUID, user_id: uuid.UUID
) -> ProjectMember | None:
    return db.scalar(
        select(ProjectMember).where(
            ProjectMember.project_id == project_id,
            ProjectMember.user_id == user_id,
        )
    )


def get_project_membership(
    project_id: Annotated[uuid.UUID, Path()],
    current_user: CurrentUser,
    db: DbSession,
) -> tuple[Project, ProjectMember]:
    """Ensure the current user is a member of the project. Returns (project, membership)."""
    project = db.get(Project, project_id)
    if project is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Project not found")
    membership = _get_membership(db, project_id, current_user.id)
    if membership is None:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Not a member of this project")
    return project, membership


ProjectAccess = Annotated[tuple[Project, ProjectMember], Depends(get_project_membership)]


def require_owner(access: ProjectAccess) -> tuple[Project, ProjectMember]:
    _, membership = access
    if membership.role != ROLE_OWNER:
        raise HTTPException(
            status.HTTP_403_FORBIDDEN, "Only the project owner can perform this action"
        )
    return access


OwnerAccess = Annotated[tuple[Project, ProjectMember], Depends(require_owner)]

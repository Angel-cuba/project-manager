import uuid

from fastapi import APIRouter, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.deps import CurrentUser, DbSession, OwnerAccess, ProjectAccess
from app.models.board import TaskStatus
from app.models.project import ROLE_OWNER, Project, ProjectMember
from app.schemas.project import ProjectCreate, ProjectOut, ProjectUpdate

router = APIRouter(prefix="/projects", tags=["projects"])

# (name, color) seeded as the initial Kanban columns of every new project.
_DEFAULT_STATUSES = [
    ("Backlog", "#94a3b8"),
    ("En curso", "#3b82f6"),
    ("Hecho", "#22c55e"),
]


def _seed_default_statuses(db: Session, project_id: uuid.UUID) -> None:
    for position, (name, color) in enumerate(_DEFAULT_STATUSES):
        db.add(
            TaskStatus(
                project_id=project_id, name=name, color=color, position=position
            )
        )


def _to_out(project: Project, role: str | None) -> ProjectOut:
    out = ProjectOut.model_validate(project)
    out.role = role
    return out


@router.get("", response_model=list[ProjectOut])
def list_projects(current_user: CurrentUser, db: DbSession) -> list[ProjectOut]:
    rows = db.execute(
        select(Project, ProjectMember.role)
        .join(ProjectMember, ProjectMember.project_id == Project.id)
        .where(ProjectMember.user_id == current_user.id)
        .order_by(Project.created_at.desc())
    ).all()
    return [_to_out(project, role) for project, role in rows]


@router.post("", response_model=ProjectOut, status_code=status.HTTP_201_CREATED)
def create_project(
    data: ProjectCreate, current_user: CurrentUser, db: DbSession
) -> ProjectOut:
    project = Project(
        name=data.name, description=data.description, owner_id=current_user.id
    )
    db.add(project)
    db.flush()  # get project.id
    db.add(
        ProjectMember(
            project_id=project.id, user_id=current_user.id, role=ROLE_OWNER
        )
    )
    _seed_default_statuses(db, project.id)
    db.commit()
    db.refresh(project)
    return _to_out(project, ROLE_OWNER)


@router.get("/{project_id}", response_model=ProjectOut)
def get_project(access: ProjectAccess) -> ProjectOut:
    project, membership = access
    return _to_out(project, membership.role)


@router.patch("/{project_id}", response_model=ProjectOut)
def update_project(
    data: ProjectUpdate, access: ProjectAccess, db: DbSession
) -> ProjectOut:
    project, membership = access
    if data.name is not None:
        project.name = data.name
    if data.description is not None:
        project.description = data.description
    db.commit()
    db.refresh(project)
    return _to_out(project, membership.role)


@router.delete("/{project_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_project(access: OwnerAccess, db: DbSession) -> None:
    project, _ = access
    db.delete(project)
    db.commit()

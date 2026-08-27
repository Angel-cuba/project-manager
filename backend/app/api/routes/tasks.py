import uuid

from fastapi import APIRouter, HTTPException, Query, status
from sqlalchemy import func, select

from app.core.deps import CurrentUser, DbSession, ProjectAccess
from app.models.board import Label, Task, TaskStatus
from app.models.project import ProjectMember
from app.realtime import manager
from app.schemas.board import TaskCreate, TaskMove, TaskOut, TaskUpdate

router = APIRouter(prefix="/projects/{project_id}/tasks", tags=["tasks"])


def _dump(obj: Task) -> dict:
    return TaskOut.model_validate(obj).model_dump(mode="json")


def _resolve_status(
    db: DbSession, project_id: uuid.UUID, status_id: uuid.UUID
) -> TaskStatus:
    st = db.get(TaskStatus, status_id)
    if st is None or st.project_id != project_id:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, "Invalid status_id")
    return st


def _validate_assignee(
    db: DbSession, project_id: uuid.UUID, assignee_id: uuid.UUID
) -> None:
    is_member = db.scalar(
        select(ProjectMember).where(
            ProjectMember.project_id == project_id,
            ProjectMember.user_id == assignee_id,
        )
    )
    if is_member is None:
        raise HTTPException(
            status.HTTP_422_UNPROCESSABLE_ENTITY,
            "Assignee must be a member of the project",
        )


def _resolve_labels(
    db: DbSession, project_id: uuid.UUID, label_ids: list[uuid.UUID]
) -> list[Label]:
    if not label_ids:
        return []
    labels = list(
        db.scalars(
            select(Label).where(
                Label.project_id == project_id, Label.id.in_(label_ids)
            )
        ).all()
    )
    if len(labels) != len(set(label_ids)):
        raise HTTPException(
            status.HTTP_422_UNPROCESSABLE_ENTITY, "One or more labels are invalid"
        )
    return labels


def _next_position(db: DbSession, status_id: uuid.UUID) -> int:
    max_pos = db.scalar(
        select(func.max(Task.position)).where(Task.status_id == status_id)
    )
    return (max_pos + 1) if max_pos is not None else 0


@router.get("", response_model=list[TaskOut])
def list_tasks(
    access: ProjectAccess,
    db: DbSession,
    status_id: uuid.UUID | None = Query(default=None),
    assignee_id: uuid.UUID | None = Query(default=None),
) -> list[Task]:
    project, _ = access
    stmt = select(Task).where(Task.project_id == project.id)
    if status_id is not None:
        stmt = stmt.where(Task.status_id == status_id)
    if assignee_id is not None:
        stmt = stmt.where(Task.assignee_id == assignee_id)
    stmt = stmt.order_by(Task.status_id, Task.position, Task.created_at)
    return list(db.scalars(stmt).all())


@router.post("", response_model=TaskOut, status_code=status.HTTP_201_CREATED)
async def create_task(
    data: TaskCreate, access: ProjectAccess, current_user: CurrentUser, db: DbSession
) -> Task:
    project, _ = access

    status_id = data.status_id
    if status_id is None:
        first = db.scalar(
            select(TaskStatus)
            .where(TaskStatus.project_id == project.id)
            .order_by(TaskStatus.position)
            .limit(1)
        )
        if first is None:
            raise HTTPException(
                status.HTTP_400_BAD_REQUEST, "Create a status before adding tasks"
            )
        status_id = first.id
    else:
        _resolve_status(db, project.id, status_id)

    if data.assignee_id is not None:
        _validate_assignee(db, project.id, data.assignee_id)
    labels = _resolve_labels(db, project.id, data.label_ids)

    task = Task(
        project_id=project.id,
        title=data.title,
        description=data.description,
        due_date=data.due_date,
        status_id=status_id,
        assignee_id=data.assignee_id,
        priority=data.priority,
        position=_next_position(db, status_id),
        created_by=current_user.id,
        labels=labels,
    )
    db.add(task)
    db.commit()
    db.refresh(task)
    await manager.broadcast(project.id, "task.created", _dump(task))
    return task


def _get_task_or_404(
    db: DbSession, project_id: uuid.UUID, task_id: uuid.UUID
) -> Task:
    task = db.get(Task, task_id)
    if task is None or task.project_id != project_id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Task not found")
    return task


@router.get("/{task_id}", response_model=TaskOut)
def get_task(task_id: uuid.UUID, access: ProjectAccess, db: DbSession) -> Task:
    project, _ = access
    return _get_task_or_404(db, project.id, task_id)


@router.patch("/{task_id}", response_model=TaskOut)
async def update_task(
    task_id: uuid.UUID, data: TaskUpdate, access: ProjectAccess, db: DbSession
) -> Task:
    project, _ = access
    task = _get_task_or_404(db, project.id, task_id)

    fields = data.model_dump(exclude_unset=True)
    if "status_id" in fields and fields["status_id"] is not None:
        _resolve_status(db, project.id, fields["status_id"])
    if "assignee_id" in fields and fields["assignee_id"] is not None:
        _validate_assignee(db, project.id, fields["assignee_id"])
    if "label_ids" in fields and fields["label_ids"] is not None:
        task.labels = _resolve_labels(db, project.id, fields["label_ids"])

    for key in ("title", "description", "due_date", "status_id", "assignee_id", "priority"):
        if key in fields:
            setattr(task, key, fields[key])

    db.commit()
    db.refresh(task)
    await manager.broadcast(project.id, "task.updated", _dump(task))
    return task


@router.patch("/{task_id}/move", response_model=TaskOut)
async def move_task(
    task_id: uuid.UUID, data: TaskMove, access: ProjectAccess, db: DbSession
) -> Task:
    project, _ = access
    task = _get_task_or_404(db, project.id, task_id)
    _resolve_status(db, project.id, data.status_id)
    task.status_id = data.status_id
    task.position = data.position
    db.commit()
    db.refresh(task)
    await manager.broadcast(project.id, "task.moved", _dump(task))
    return task


@router.delete("/{task_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_task(
    task_id: uuid.UUID, access: ProjectAccess, db: DbSession
) -> None:
    project, _ = access
    task = _get_task_or_404(db, project.id, task_id)
    db.delete(task)
    db.commit()
    await manager.broadcast(project.id, "task.deleted", {"id": str(task_id)})

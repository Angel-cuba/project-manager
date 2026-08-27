import uuid

from fastapi import APIRouter, HTTPException, status
from sqlalchemy import func, select

from app.core.deps import DbSession, ProjectAccess
from app.models.board import Task, TaskStatus
from app.realtime import manager
from app.schemas.board import StatusCreate, StatusOut, StatusUpdate

router = APIRouter(prefix="/projects/{project_id}/statuses", tags=["statuses"])


def _dump(obj: TaskStatus) -> dict:
    return StatusOut.model_validate(obj).model_dump(mode="json")


def _get_status_or_404(
    db: DbSession, project_id: uuid.UUID, status_id: uuid.UUID
) -> TaskStatus:
    obj = db.get(TaskStatus, status_id)
    if obj is None or obj.project_id != project_id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Status not found")
    return obj


@router.get("", response_model=list[StatusOut])
def list_statuses(access: ProjectAccess, db: DbSession) -> list[TaskStatus]:
    project, _ = access
    return list(
        db.scalars(
            select(TaskStatus)
            .where(TaskStatus.project_id == project.id)
            .order_by(TaskStatus.position, TaskStatus.name)
        ).all()
    )


@router.post("", response_model=StatusOut, status_code=status.HTTP_201_CREATED)
async def create_status(
    data: StatusCreate, access: ProjectAccess, db: DbSession
) -> TaskStatus:
    project, _ = access
    position = data.position
    if position is None:
        max_pos = db.scalar(
            select(func.max(TaskStatus.position)).where(
                TaskStatus.project_id == project.id
            )
        )
        position = (max_pos + 1) if max_pos is not None else 0
    obj = TaskStatus(
        project_id=project.id, name=data.name, color=data.color, position=position
    )
    db.add(obj)
    db.commit()
    db.refresh(obj)
    await manager.broadcast(project.id, "status.created", _dump(obj))
    return obj


@router.patch("/{status_id}", response_model=StatusOut)
async def update_status(
    status_id: uuid.UUID, data: StatusUpdate, access: ProjectAccess, db: DbSession
) -> TaskStatus:
    project, _ = access
    obj = _get_status_or_404(db, project.id, status_id)
    if data.name is not None:
        obj.name = data.name
    if data.color is not None:
        obj.color = data.color
    if data.position is not None:
        obj.position = data.position
    db.commit()
    db.refresh(obj)
    await manager.broadcast(project.id, "status.updated", _dump(obj))
    return obj


@router.delete("/{status_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_status(
    status_id: uuid.UUID, access: ProjectAccess, db: DbSession
) -> None:
    project, _ = access
    obj = _get_status_or_404(db, project.id, status_id)
    task_count = db.scalar(
        select(func.count()).select_from(Task).where(Task.status_id == status_id)
    )
    if task_count:
        raise HTTPException(
            status.HTTP_400_BAD_REQUEST,
            "Move or delete the tasks in this status before removing it",
        )
    db.delete(obj)
    db.commit()
    await manager.broadcast(
        project.id, "status.deleted", {"id": str(status_id)}
    )


@router.post("/reorder", response_model=list[StatusOut])
async def reorder_statuses(
    ordered_ids: list[uuid.UUID], access: ProjectAccess, db: DbSession
) -> list[TaskStatus]:
    """Reorder columns: `ordered_ids` is the full list of status ids in new order."""
    project, _ = access
    statuses = {
        s.id: s
        for s in db.scalars(
            select(TaskStatus).where(TaskStatus.project_id == project.id)
        ).all()
    }
    for position, sid in enumerate(ordered_ids):
        if sid in statuses:
            statuses[sid].position = position
    db.commit()
    result = sorted(statuses.values(), key=lambda s: s.position)
    await manager.broadcast(
        project.id,
        "status.reordered",
        {"order": [str(s.id) for s in result]},
    )
    return result

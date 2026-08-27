import uuid

from fastapi import APIRouter, HTTPException, status
from sqlalchemy import select

from app.core.deps import DbSession, ProjectAccess
from app.models.board import Label
from app.realtime import manager
from app.schemas.board import LabelCreate, LabelOut, LabelUpdate

router = APIRouter(prefix="/projects/{project_id}/labels", tags=["labels"])


def _dump(obj: Label) -> dict:
    return LabelOut.model_validate(obj).model_dump(mode="json")


def _get_label_or_404(
    db: DbSession, project_id: uuid.UUID, label_id: uuid.UUID
) -> Label:
    obj = db.get(Label, label_id)
    if obj is None or obj.project_id != project_id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Label not found")
    return obj


@router.get("", response_model=list[LabelOut])
def list_labels(access: ProjectAccess, db: DbSession) -> list[Label]:
    project, _ = access
    return list(
        db.scalars(
            select(Label).where(Label.project_id == project.id).order_by(Label.name)
        ).all()
    )


@router.post("", response_model=LabelOut, status_code=status.HTTP_201_CREATED)
async def create_label(
    data: LabelCreate, access: ProjectAccess, db: DbSession
) -> Label:
    project, _ = access
    obj = Label(project_id=project.id, name=data.name, color=data.color)
    db.add(obj)
    db.commit()
    db.refresh(obj)
    await manager.broadcast(project.id, "label.created", _dump(obj))
    return obj


@router.patch("/{label_id}", response_model=LabelOut)
async def update_label(
    label_id: uuid.UUID, data: LabelUpdate, access: ProjectAccess, db: DbSession
) -> Label:
    project, _ = access
    obj = _get_label_or_404(db, project.id, label_id)
    if data.name is not None:
        obj.name = data.name
    if data.color is not None:
        obj.color = data.color
    db.commit()
    db.refresh(obj)
    await manager.broadcast(project.id, "label.updated", _dump(obj))
    return obj


@router.delete("/{label_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_label(
    label_id: uuid.UUID, access: ProjectAccess, db: DbSession
) -> None:
    project, _ = access
    obj = _get_label_or_404(db, project.id, label_id)
    db.delete(obj)
    db.commit()
    await manager.broadcast(project.id, "label.deleted", {"id": str(label_id)})

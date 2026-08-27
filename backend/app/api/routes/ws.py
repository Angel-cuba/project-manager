import uuid

from fastapi import (
    APIRouter,
    HTTPException,
    Query,
    WebSocket,
    WebSocketDisconnect,
    status,
)
from sqlalchemy import select

from app.core.database import SessionLocal
from app.core.deps import get_user_from_token
from app.models.project import ProjectMember
from app.realtime import manager

router = APIRouter(tags=["realtime"])


@router.websocket("/ws/projects/{project_id}")
async def project_ws(
    websocket: WebSocket,
    project_id: uuid.UUID,
    token: str = Query(...),
) -> None:
    """Real-time board channel. Auth via ?token= (JWT access token).

    Browsers cannot set Authorization headers on WebSocket connections, so the
    access token is passed as a query parameter and validated on connect.
    """
    db = SessionLocal()
    try:
        try:
            user = get_user_from_token(token, db)
        except HTTPException:
            await websocket.close(code=status.WS_1008_POLICY_VIOLATION)
            return
        membership = db.scalar(
            select(ProjectMember).where(
                ProjectMember.project_id == project_id,
                ProjectMember.user_id == user.id,
            )
        )
        if membership is None:
            await websocket.close(code=status.WS_1008_POLICY_VIOLATION)
            return
    finally:
        db.close()

    await manager.connect(project_id, websocket)
    try:
        while True:
            # We don't act on inbound messages; this keeps the socket open and
            # lets us detect disconnects.
            await websocket.receive_text()
    except WebSocketDisconnect:
        await manager.disconnect(project_id, websocket)

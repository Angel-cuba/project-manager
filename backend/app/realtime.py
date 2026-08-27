"""In-memory WebSocket connection manager for real-time board updates.

Clients connect to a project "room" and receive broadcast events whenever a
task or status changes. Suitable for a single-process deployment; for multiple
workers a Redis/pub-sub backend would replace the in-memory dict.
"""
import asyncio
import uuid
from collections import defaultdict

from fastapi import WebSocket


class ConnectionManager:
    def __init__(self) -> None:
        self._rooms: dict[uuid.UUID, set[WebSocket]] = defaultdict(set)
        self._lock = asyncio.Lock()

    async def connect(self, project_id: uuid.UUID, websocket: WebSocket) -> None:
        await websocket.accept()
        async with self._lock:
            self._rooms[project_id].add(websocket)

    async def disconnect(self, project_id: uuid.UUID, websocket: WebSocket) -> None:
        async with self._lock:
            self._rooms[project_id].discard(websocket)
            if not self._rooms[project_id]:
                self._rooms.pop(project_id, None)

    async def broadcast(
        self, project_id: uuid.UUID, event: str, payload: dict
    ) -> None:
        """Send an event to everyone connected to the project room."""
        message = {"event": event, "payload": payload}
        async with self._lock:
            targets = list(self._rooms.get(project_id, set()))
        dead: list[WebSocket] = []
        for ws in targets:
            try:
                await ws.send_json(message)
            except Exception:  # noqa: BLE001 - drop broken sockets
                dead.append(ws)
        for ws in dead:
            await self.disconnect(project_id, ws)


manager = ConnectionManager()

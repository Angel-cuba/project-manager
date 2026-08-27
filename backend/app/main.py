from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.routes import (
    auth,
    invitations,
    labels,
    members,
    projects,
    statuses,
    tasks,
    users,
    ws,
)
from app.core.config import settings

app = FastAPI(title="Admin Manager API", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health", tags=["health"])
def health() -> dict[str, str]:
    return {"status": "ok"}


for router in (
    auth.router,
    users.router,
    projects.router,
    members.router,
    statuses.router,
    labels.router,
    tasks.router,
    invitations.router,
):
    app.include_router(router, prefix="/api")

# WebSocket route is mounted without the /api prefix.
app.include_router(ws.router)

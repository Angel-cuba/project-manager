"""Tests for the collaborative + real-time flow.

Covers the in-memory ``ConnectionManager`` in isolation, the WebSocket auth /
membership gate, end-to-end broadcast delivery over a live WebSocket, and a
full multi-user REST collaboration scenario.

No pytest-asyncio is available, so async coroutines are driven with
``asyncio.run`` and fake sockets use ``unittest.mock.AsyncMock``.
"""
import asyncio
import uuid
from unittest.mock import AsyncMock

import pytest
from starlette.websockets import WebSocketDisconnect

from app.realtime import ConnectionManager, manager
from tests.conftest import auth_headers, register


def _fake_ws() -> AsyncMock:
    """A stand-in WebSocket exposing the async methods the manager calls."""
    ws = AsyncMock()
    ws.accept = AsyncMock()
    ws.send_json = AsyncMock()
    return ws


def test_connection_manager_broadcast_and_drop():
    """broadcast fans out {event, payload} and prunes sockets that raise."""

    async def scenario():
        mgr = ConnectionManager()
        project_id = uuid.uuid4()
        other_project = uuid.uuid4()

        good = _fake_ws()
        broken = _fake_ws()
        broken.send_json.side_effect = RuntimeError("connection reset")
        elsewhere = _fake_ws()

        await mgr.connect(project_id, good)
        await mgr.connect(project_id, broken)
        await mgr.connect(other_project, elsewhere)

        # both sockets accepted their connection
        good.accept.assert_awaited_once()
        broken.accept.assert_awaited_once()

        payload = {"id": "abc", "title": "Hello"}
        await mgr.broadcast(project_id, "task.created", payload)

        expected = {"event": "task.created", "payload": payload}
        good.send_json.assert_awaited_once_with(expected)
        broken.send_json.assert_awaited_once_with(expected)
        # a socket in a different room receives nothing
        elsewhere.send_json.assert_not_awaited()

        # the socket that raised was dropped; the healthy one remains
        assert good in mgr._rooms[project_id]
        assert broken not in mgr._rooms.get(project_id, set())

        # a second broadcast only reaches the survivor
        good.send_json.reset_mock()
        await mgr.broadcast(project_id, "task.updated", {"id": "abc"})
        good.send_json.assert_awaited_once()

    asyncio.run(scenario())


def _project_with_member(client):
    """Create a project owner + a member, return (owner, member, project_id)."""
    owner = register(client, "rt-owner@example.com", "Owner")
    member = register(client, "rt-member@example.com", "Member")
    ho = auth_headers(owner["access_token"])
    pid = client.post("/api/projects", json={"name": "Realtime"}, headers=ho).json()["id"]
    add = client.post(
        f"/api/projects/{pid}/members",
        json={"user_id": member["user"]["id"], "role": "member"},
        headers=ho,
    )
    assert add.status_code == 201, add.text
    return owner, member, pid


def test_ws_rejects_bad_token(client):
    """An invalid JWT closes the socket -> WebSocketDisconnect on connect."""
    owner = register(client, "rt-bad@example.com", "Owner")
    pid = client.post(
        "/api/projects", json={"name": "P"}, headers=auth_headers(owner["access_token"])
    ).json()["id"]

    with pytest.raises(WebSocketDisconnect):
        with client.websocket_connect(f"/ws/projects/{pid}?token=bad"):
            pass


def test_ws_accepts_valid_member(client):
    """A valid member token enters the connection context cleanly."""
    _owner, member, pid = _project_with_member(client)
    token = member["access_token"]
    with client.websocket_connect(f"/ws/projects/{pid}?token={token}") as ws:
        assert ws is not None


def test_ws_rejects_non_member(client):
    """A valid token for a user who is not a project member is rejected."""
    _owner, _member, pid = _project_with_member(client)
    stranger = register(client, "rt-stranger@example.com", "Stranger")

    with pytest.raises(WebSocketDisconnect):
        with client.websocket_connect(
            f"/ws/projects/{pid}?token={stranger['access_token']}"
        ):
            pass


def test_ws_broadcast_delivery(client):
    """A member connected over WS receives task.created when the owner POSTs."""
    owner, member, pid = _project_with_member(client)
    ho = auth_headers(owner["access_token"])
    url = f"/ws/projects/{pid}?token={member['access_token']}"

    with client.websocket_connect(url) as ws:
        created = client.post(
            f"/api/projects/{pid}/tasks",
            json={"title": "Realtime task", "priority": "high"},
            headers=ho,
        )
        assert created.status_code == 201, created.text
        event = ws.receive_json()

    assert event["event"] == "task.created"
    assert event["payload"]["title"] == "Realtime task"
    assert event["payload"]["id"] == created.json()["id"]


def test_ws_manager_broadcast_direct():
    """Direct check that the shared singleton delivers to a connected socket.

    Complements the end-to-end path above and exercises the module-level
    ``manager`` instance used by the route handlers.
    """

    async def scenario():
        project_id = uuid.uuid4()
        sock = _fake_ws()
        await manager.connect(project_id, sock)
        try:
            await manager.broadcast(project_id, "status.created", {"name": "Backlog"})
            sock.send_json.assert_awaited_once_with(
                {"event": "status.created", "payload": {"name": "Backlog"}}
            )
        finally:
            await manager.disconnect(project_id, sock)
        assert project_id not in manager._rooms

    asyncio.run(scenario())


def test_full_collaborative_rest_scenario(client):
    """Owner + member collaborate over REST; a non-member is forbidden."""
    owner = register(client, "collab-owner@example.com", "Owner")
    member = register(client, "collab-member@example.com", "Member")
    stranger = register(client, "collab-stranger@example.com", "Stranger")
    ho = auth_headers(owner["access_token"])
    hm = auth_headers(member["access_token"])
    hs = auth_headers(stranger["access_token"])

    pid = client.post("/api/projects", json={"name": "Team"}, headers=ho).json()["id"]

    # owner finds the second user and adds them as a member
    found = client.get("/api/users?search=collab-member", headers=ho).json()
    assert any(u["email"] == "collab-member@example.com" for u in found)
    add = client.post(
        f"/api/projects/{pid}/members",
        json={"user_id": member["user"]["id"], "role": "member"},
        headers=ho,
    )
    assert add.status_code == 201, add.text

    # member can read the project and create a task in it
    assert client.get(f"/api/projects/{pid}", headers=hm).status_code == 200
    made = client.post(
        f"/api/projects/{pid}/tasks",
        json={"title": "Member task"},
        headers=hm,
    )
    assert made.status_code == 201, made.text
    tid = made.json()["id"]

    # owner sees the task the member created
    owner_view = client.get(f"/api/projects/{pid}/tasks", headers=ho).json()
    assert [t["id"] for t in owner_view] == [tid]

    # a non-member is forbidden from both listing and creating tasks
    assert client.get(f"/api/projects/{pid}/tasks", headers=hs).status_code == 403
    denied = client.post(
        f"/api/projects/{pid}/tasks", json={"title": "Nope"}, headers=hs
    )
    assert denied.status_code == 403

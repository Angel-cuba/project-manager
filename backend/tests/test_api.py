from tests.conftest import auth_headers, register


def test_health(client):
    assert client.get("/health").json() == {"status": "ok"}


def test_register_login_me(client):
    data = register(client, "alice@example.com", "Alice")
    assert data["user"]["email"] == "alice@example.com"
    assert data["access_token"] and data["refresh_token"]

    # duplicate email rejected
    dup = client.post(
        "/api/auth/register",
        json={"email": "alice@example.com", "full_name": "A", "password": "password123"},
    )
    assert dup.status_code == 409

    login = client.post(
        "/api/auth/login",
        json={"email": "alice@example.com", "password": "password123"},
    )
    assert login.status_code == 200
    token = login.json()["access_token"]

    me = client.get("/api/auth/me", headers=auth_headers(token))
    assert me.status_code == 200
    assert me.json()["full_name"] == "Alice"

    # bad password
    bad = client.post(
        "/api/auth/login",
        json={"email": "alice@example.com", "password": "wrong"},
    )
    assert bad.status_code == 401


def test_project_seeds_default_statuses(client):
    reg = register(client, "bob@example.com", "Bob")
    h = auth_headers(reg["access_token"])
    proj = client.post("/api/projects", json={"name": "Web App"}, headers=h)
    assert proj.status_code == 201
    pid = proj.json()["id"]
    assert proj.json()["role"] == "owner"

    statuses = client.get(f"/api/projects/{pid}/statuses", headers=h).json()
    assert [s["name"] for s in statuses] == ["Backlog", "En curso", "Hecho"]


def test_members_and_permissions(client):
    owner = register(client, "owner@example.com", "Owner")
    member = register(client, "member@example.com", "Member")
    stranger = register(client, "stranger@example.com", "Stranger")
    ho = auth_headers(owner["access_token"])
    hm = auth_headers(member["access_token"])
    hs = auth_headers(stranger["access_token"])

    pid = client.post("/api/projects", json={"name": "Team"}, headers=ho).json()["id"]

    # owner searches and adds the member
    found = client.get("/api/users?search=member", headers=ho).json()
    assert any(u["email"] == "member@example.com" for u in found)
    add = client.post(
        f"/api/projects/{pid}/members",
        json={"user_id": member["user"]["id"], "role": "member"},
        headers=ho,
    )
    assert add.status_code == 201

    # member can now see the project; stranger cannot
    assert client.get(f"/api/projects/{pid}", headers=hm).status_code == 200
    assert client.get(f"/api/projects/{pid}", headers=hs).status_code == 403

    # member (not owner) cannot add members
    forbidden = client.post(
        f"/api/projects/{pid}/members",
        json={"user_id": stranger["user"]["id"], "role": "member"},
        headers=hm,
    )
    assert forbidden.status_code == 403


def test_task_lifecycle_and_move(client):
    owner = register(client, "dev@example.com", "Dev")
    h = auth_headers(owner["access_token"])
    pid = client.post("/api/projects", json={"name": "Kanban"}, headers=h).json()["id"]

    statuses = client.get(f"/api/projects/{pid}/statuses", headers=h).json()
    backlog, doing = statuses[0]["id"], statuses[1]["id"]

    label = client.post(
        f"/api/projects/{pid}/labels", json={"name": "bug", "color": "#ef4444"}, headers=h
    ).json()

    # create task without status -> lands in first status (Backlog)
    task = client.post(
        f"/api/projects/{pid}/tasks",
        json={
            "title": "Fix login",
            "description": "NPE on submit",
            "priority": "high",
            "assignee_id": owner["user"]["id"],
            "label_ids": [label["id"]],
        },
        headers=h,
    )
    assert task.status_code == 201, task.text
    tbody = task.json()
    assert tbody["status_id"] == backlog
    assert tbody["assignee"]["email"] == "dev@example.com"
    assert tbody["labels"][0]["name"] == "bug"
    tid = tbody["id"]

    # move to "En curso"
    moved = client.patch(
        f"/api/projects/{pid}/tasks/{tid}/move",
        json={"status_id": doing, "position": 0},
        headers=h,
    )
    assert moved.status_code == 200
    assert moved.json()["status_id"] == doing

    # filter by status
    in_doing = client.get(
        f"/api/projects/{pid}/tasks?status_id={doing}", headers=h
    ).json()
    assert len(in_doing) == 1 and in_doing[0]["id"] == tid

    # delete
    assert client.delete(f"/api/projects/{pid}/tasks/{tid}", headers=h).status_code == 204
    assert client.get(f"/api/projects/{pid}/tasks", headers=h).json() == []


def test_cannot_delete_status_with_tasks(client):
    owner = register(client, "pm@example.com", "PM")
    h = auth_headers(owner["access_token"])
    pid = client.post("/api/projects", json={"name": "P"}, headers=h).json()["id"]
    backlog = client.get(f"/api/projects/{pid}/statuses", headers=h).json()[0]["id"]
    client.post(f"/api/projects/{pid}/tasks", json={"title": "T"}, headers=h)

    resp = client.delete(f"/api/projects/{pid}/statuses/{backlog}", headers=h)
    assert resp.status_code == 400

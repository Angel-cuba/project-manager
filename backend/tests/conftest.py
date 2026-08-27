"""Test configuration.

Sets required env vars BEFORE importing the app, and points the app at a
throwaway SQLite database so tests need no running PostgreSQL.
"""
import os
import pathlib

os.environ.setdefault("SECRET_KEY", "test-secret-key")
_TEST_DB = pathlib.Path(__file__).parent / "test.db"
os.environ.setdefault("DATABASE_URL", f"sqlite:///{_TEST_DB}")
os.environ.setdefault("CORS_ORIGINS", "http://testserver")

import pytest  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402

from app.core.database import Base, engine  # noqa: E402
from app.main import app  # noqa: E402


@pytest.fixture(autouse=True)
def _create_schema():
    Base.metadata.create_all(bind=engine)
    yield
    Base.metadata.drop_all(bind=engine)


@pytest.fixture
def client():
    with TestClient(app) as c:
        yield c


def register(client: TestClient, email: str, name: str = "User", password: str = "password123"):
    resp = client.post(
        "/api/auth/register",
        json={"email": email, "full_name": name, "password": password},
    )
    assert resp.status_code == 201, resp.text
    return resp.json()


def auth_headers(token: str) -> dict[str, str]:
    return {"Authorization": f"Bearer {token}"}

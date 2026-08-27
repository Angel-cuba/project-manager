# Admin Manager — Backend

FastAPI + SQLAlchemy 2.0 + PostgreSQL, gestionado con [uv](https://docs.astral.sh/uv/).

```bash
cp .env.example .env            # SECRET_KEY + DATABASE_URL
uv sync
uv run alembic upgrade head
uv run uvicorn app.main:app --reload
uv run pytest
```

Documentación interactiva en http://localhost:8000/docs.

Ver el [README raíz](../README.md) para la visión completa del proyecto.

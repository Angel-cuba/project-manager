from fastapi import APIRouter, Query
from sqlalchemy import or_, select

from app.core.deps import CurrentUser, DbSession
from app.models.user import User
from app.schemas.user import UserOut

router = APIRouter(prefix="/users", tags=["users"])


@router.get("", response_model=list[UserOut])
def search_users(
    current_user: CurrentUser,
    db: DbSession,
    search: str = Query(default="", description="Match email or full name"),
    limit: int = Query(default=20, le=50),
) -> list[User]:
    """Search registered users (used to add members to a project)."""
    stmt = select(User)
    term = search.strip()
    if term:
        like = f"%{term}%"
        stmt = stmt.where(or_(User.email.ilike(like), User.full_name.ilike(like)))
    stmt = stmt.order_by(User.full_name).limit(limit)
    return list(db.scalars(stmt).all())

"""Import every model so Alembic's autogenerate and Base.metadata see them."""
from app.models.user import User
from app.models.project import Project, ProjectMember
from app.models.board import Label, Task, TaskStatus, task_labels
from app.models.invitation import Invitation

__all__ = [
    "User",
    "Project",
    "ProjectMember",
    "TaskStatus",
    "Label",
    "Task",
    "task_labels",
    "Invitation",
]

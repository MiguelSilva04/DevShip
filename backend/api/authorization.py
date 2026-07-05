import uuid

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from backend.bd.models.application import Application
from backend.bd.models.application_team_member import ApplicationTeamMember
from backend.bd.models.project import Project
from backend.bd.models.team_member import TeamMember, TeamMemberRole
from backend.bd.models.user import User


def _require_project_member(db: Session, project_id: uuid.UUID, user: User) -> TeamMember:
    """Nível 1 (Team) only — for routes that list across a project rather than
    targeting one Application (list_environments, list_applications, get_homepage)."""
    project = db.get(Project, project_id)
    if project is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Project not found")

    member = db.query(TeamMember).filter(
        TeamMember.team_id == project.team_id,
        TeamMember.user_id == user.id,
    ).first()
    if member is None:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not a member of this project's team")
    return member


def _require_application_access(db: Session, application_id: uuid.UUID, user: User) -> TeamMember:
    """Nível 1 (Team) + nível 2 (Application, só para DEVELOPER). Levanta 403/404."""
    app = db.get(Application, application_id)
    if app is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Application not found")

    project = db.get(Project, app.project_id)
    member = db.query(TeamMember).filter(
        TeamMember.team_id == project.team_id,
        TeamMember.user_id == user.id,
    ).first()
    if member is None:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not a member of this project's team")

    if member.role == TeamMemberRole.DEVELOPER:
        grant = db.query(ApplicationTeamMember).filter(
            ApplicationTeamMember.team_member_id == member.id,
            ApplicationTeamMember.application_id == application_id,
        ).first()
        if grant is None:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="No access to this application")

    return member

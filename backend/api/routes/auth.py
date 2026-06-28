from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from backend.api.deps import get_db
from backend.api.schemas.auth import LoginRequest, RegisterRequest, TokenResponse, UserResponse
from backend.api.security import create_token, hash_password, verify_password
from backend.bd.models.team import Team
from backend.bd.models.user import User

router = APIRouter()


def _domain(email: str) -> str:
    return email.rsplit("@", 1)[-1]


@router.post("/register", response_model=UserResponse, status_code=status.HTTP_201_CREATED)
def register(body: RegisterRequest, db: Session = Depends(get_db)):
    domain = _domain(body.email)
    existing_team = db.query(Team).filter(Team.domain == domain).first()

    user = User(name=body.name, email=body.email, password_hash=hash_password(body.password))
    db.add(user)
    try:
        db.flush()
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Email already registered")

    auto_team_id = None
    if existing_team:
        # Domain already has a team — user is created but stays pending (no TeamMember yet).
        # The Cloud Engineer of that team discovers them via GET /teams/{id}/members and adds them.
        db.commit()
    else:
        # First user from this domain — auto-create Team and make them Cloud Engineer.
        from backend.bd.models.team_member import TeamMember, TeamMemberRole
        team = Team(name=domain, domain=domain)
        member = TeamMember(team_id=team.id, user_id=user.id, role=TeamMemberRole.CLOUD_ENGINEER, added_by=None)
        db.add(team)
        db.add(member)
        db.commit()
        auto_team_id = str(team.id)

    db.refresh(user)
    return UserResponse(id=str(user.id), name=user.name, email=user.email, team_id=auto_team_id)


@router.post("/login", response_model=TokenResponse)
def login(body: LoginRequest, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == body.email).first()
    if user is None or not verify_password(body.password, user.password_hash):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid credentials")
    return TokenResponse(access_token=create_token(str(user.id)))

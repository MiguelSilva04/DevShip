from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from backend.api.deps import get_current_user, get_db
from backend.api.schemas.auth import LoginRequest, RegisterRequest, TokenResponse, UserResponse
from backend.api.security import create_token, hash_password, verify_password
from backend.bd.models.user import User

router = APIRouter()


@router.post("/register", response_model=UserResponse, status_code=status.HTTP_201_CREATED)
def register(body: RegisterRequest, db: Session = Depends(get_db)):
    user = User(name=body.name, email=body.email, password_hash=hash_password(body.password))
    db.add(user)
    try:
        with db.begin_nested():
            db.flush()
    except IntegrityError:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Este email já está registado.")
    db.commit()
    db.refresh(user)
    return UserResponse(id=str(user.id), name=user.name, email=user.email, team_id=None)


@router.post("/login", response_model=TokenResponse)
def login(body: LoginRequest, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == body.email).first()
    if user is None or not verify_password(body.password, user.password_hash):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Email ou password incorretos.")
    return TokenResponse(access_token=create_token(str(user.id)))


@router.get("/me", response_model=UserResponse)
def me(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    return UserResponse(
        id=str(current_user.id),
        name=current_user.name,
        email=current_user.email,
        team_id=None,
        github_username=current_user.github_username,
        github_email=current_user.github_email,
    )

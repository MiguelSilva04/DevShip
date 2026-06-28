import os

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from backend.api.deps import get_db
from backend.api.schemas.auth import LoginRequest, RegisterRequest, TokenResponse, UserResponse
from backend.api.security import create_token, hash_password, verify_password
from backend.bd.models.user import User

router = APIRouter()

_ALLOWED_DOMAINS = os.environ.get("ALLOWED_EMAIL_DOMAINS", "").split(",")


def _check_email_domain(email: str) -> None:
    if _ALLOWED_DOMAINS == [""]:
        return
    domain = email.split("@")[-1]
    if domain not in _ALLOWED_DOMAINS:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="Email domain not allowed")


@router.post("/register", response_model=UserResponse, status_code=status.HTTP_201_CREATED)
def register(body: RegisterRequest, db: Session = Depends(get_db)):
    _check_email_domain(body.email)
    user = User(name=body.name, email=body.email, password_hash=hash_password(body.password))
    db.add(user)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Email already registered")
    db.refresh(user)
    return user


@router.post("/login", response_model=TokenResponse)
def login(body: LoginRequest, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == body.email).first()
    if user is None or not verify_password(body.password, user.password_hash):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid credentials")
    return TokenResponse(access_token=create_token(str(user.id)))

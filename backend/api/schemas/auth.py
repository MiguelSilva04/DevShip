from pydantic import BaseModel, EmailStr


class RegisterRequest(BaseModel):
    name: str
    email: EmailStr
    password: str


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"


class UserResponse(BaseModel):
    id: str
    name: str
    email: str
    team_id: str | None = None  # set when register auto-creates a team (first user of domain)
    github_username: str | None = None
    github_email: str | None = None

    model_config = {"from_attributes": True}

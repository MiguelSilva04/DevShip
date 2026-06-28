import os
from datetime import datetime, timedelta, timezone

import bcrypt
import jwt


def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode(), bcrypt.gensalt()).decode()


def verify_password(password: str, hashed: str) -> bool:
    return bcrypt.checkpw(password.encode(), hashed.encode())


def create_token(user_id: str) -> str:
    expire = datetime.now(timezone.utc) + timedelta(hours=int(os.environ.get("JWT_EXPIRE_HOURS", 24)))
    return jwt.encode({"sub": user_id, "exp": expire}, os.environ["JWT_SECRET"], algorithm="HS256")

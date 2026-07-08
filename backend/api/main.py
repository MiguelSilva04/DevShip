from dotenv import load_dotenv
load_dotenv()

from fastapi import FastAPI
from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded

from backend.api.rate_limit import limiter
from backend.api.routes import auth, deploy, onboarding, visibility

app = FastAPI(title="DevShip")
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

app.include_router(auth.router, prefix="/auth", tags=["auth"])
app.include_router(onboarding.router, tags=["onboarding"])
app.include_router(deploy.router, tags=["deploy"])
app.include_router(visibility.router, tags=["visibility"])

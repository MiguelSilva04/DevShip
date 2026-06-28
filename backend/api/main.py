from fastapi import FastAPI

from backend.api.routes import auth, onboarding

app = FastAPI(title="DevShip")

app.include_router(auth.router, prefix="/auth", tags=["auth"])
app.include_router(onboarding.router, tags=["onboarding"])

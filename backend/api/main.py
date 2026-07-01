from dotenv import load_dotenv
load_dotenv()

from fastapi import FastAPI

from backend.api.routes import auth, deploy, onboarding, visibility

app = FastAPI(title="DevShip")

app.include_router(auth.router, prefix="/auth", tags=["auth"])
app.include_router(onboarding.router, tags=["onboarding"])
app.include_router(deploy.router, tags=["deploy"])
app.include_router(visibility.router, tags=["visibility"])

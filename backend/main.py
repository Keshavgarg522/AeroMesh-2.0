import os
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from backend.config import settings
from backend.database import init_db
from backend.routers import auth_routes, incident_routes

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Initialize database tables on startup
    init_db()
    # Ensure storage directories exist
    os.makedirs(os.path.join(settings.STORAGE_PATH, "videos"), exist_ok=True)
    os.makedirs(os.path.join(settings.STORAGE_PATH, "frames"), exist_ok=True)
    os.makedirs(os.path.join(settings.STORAGE_PATH, "models"), exist_ok=True)
    os.makedirs(os.path.join(settings.STORAGE_PATH, "reports"), exist_ok=True)
    yield

app = FastAPI(
    title="AeroMesh Vision Engine API",
    description="Real drone video processing, AI entity detection, 3D photogrammetry, and spatial intelligence platform.",
    version="2.4.0",
    lifespan=lifespan
)

# CORS configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list + ["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Mount local storage directory for static file access (videos, frames, GLBs, PDFs)
storage_abs_path = os.path.abspath(settings.STORAGE_PATH)
os.makedirs(storage_abs_path, exist_ok=True)
app.mount("/storage", StaticFiles(directory=storage_abs_path), name="storage")

# Include Routers
app.include_router(auth_routes.router, prefix="/api/auth")
app.include_router(auth_routes.router, prefix="/auth")
app.include_router(incident_routes.router)

@app.get("/api/health")
def health_check():
    return {
        "status": "healthy",
        "service": "AeroMesh Vision Engine",
        "version": "2.4.0",
        "database": settings.DATABASE_URL.split(":")[0],
        "yolo_model": settings.YOLO_MODEL
    }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("backend.main:app", host=settings.HOST, port=settings.PORT, reload=True)

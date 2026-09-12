import os
from typing import List
from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    PORT: int = 8000
    HOST: str = "0.0.0.0"
    CORS_ORIGINS: str = "http://localhost:5173,http://localhost:5174,http://127.0.0.1:5173,http://127.0.0.1:5174"
    
    # Database
    DATABASE_URL: str = "sqlite:///./aeromesh.db"
    
    # Auth
    GOOGLE_CLIENT_ID: str = ""
    SESSION_SECRET: str = "aeromesh-super-secret-session-key-2026-production-ready"
    JWT_ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 1440
    
    # Storage
    STORAGE_PATH: str = "./storage"
    
    # AI & 3D
    YOLO_MODEL: str = "yolov8n.pt"
    ENABLE_GPU: bool = False
    COLMAP_PATH: str = "auto"
    MAX_RECONSTRUCTION_KEYFRAMES: int = 30

    @property
    def cors_origins_list(self) -> List[str]:
        return [origin.strip() for origin in self.CORS_ORIGINS.split(",") if origin.strip()]

    class Config:
        env_file = os.path.join(os.path.dirname(__file__), ".env")
        env_file_encoding = "utf-8"
        extra = "ignore"

settings = Settings()

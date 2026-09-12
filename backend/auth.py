from datetime import datetime, timedelta, timezone
from typing import Optional
import jwt
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.orm import Session
from google.oauth2 import id_token
from google.auth.transport import requests as google_requests

from backend.config import settings
from backend.database import get_db
from backend.models import User

security = HTTPBearer(auto_error=False)

def create_access_token(data: dict, expires_delta: Optional[timedelta] = None) -> str:
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.now(timezone.utc) + expires_delta
    else:
        expire = datetime.now(timezone.utc) + timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, settings.SESSION_SECRET, algorithm=settings.JWT_ALGORITHM)
    return encoded_jwt

def decode_access_token(token: str) -> Optional[dict]:
    try:
        payload = jwt.decode(token, settings.SESSION_SECRET, algorithms=[settings.JWT_ALGORITHM])
        return payload
    except jwt.PyJWTError:
        return None

def verify_google_id_token(token_str: str) -> dict:
    """
    Verifies a Google OAuth ID Token server-side.
    Returns user claims (sub, email, name, picture).
    """
    try:
        # If client ID is configured, verify against it; otherwise verify signature without audience
        target_audience = settings.GOOGLE_CLIENT_ID if settings.GOOGLE_CLIENT_ID else None
        id_info = id_token.verify_oauth2_token(
            token_str,
            google_requests.Request(),
            audience=target_audience
        )
        return id_info
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"Google ID token verification failed: {str(e)}"
        )

def get_current_user(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(security),
    db: Session = Depends(get_db)
) -> User:
    """
    Dependency to authenticate and return the current user.
    Enforces strict user isolation.
    """
    if not credentials or not credentials.credentials:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing authentication credentials",
            headers={"WWW-Authenticate": "Bearer"}
        )

    token = credentials.credentials
    payload = decode_access_token(token)
    if not payload:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired access token",
            headers={"WWW-Authenticate": "Bearer"}
        )

    user_id = payload.get("sub")
    if not user_id:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Malformed token payload"
        )

    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User account no longer exists"
        )

    return user

def get_or_create_google_user(db: Session, google_info: dict) -> User:
    google_id = google_info["sub"]
    email = google_info.get("email", "")
    name = google_info.get("name", email.split("@")[0] if email else "AeroMesh User")
    profile_image = google_info.get("picture")

    user = db.query(User).filter(User.google_id == google_id).first()
    if not user:
        user = db.query(User).filter(User.email == email).first()
        if user:
            user.google_id = google_id
            if profile_image:
                user.profile_image = profile_image
        else:
            user = User(
                google_id=google_id,
                email=email,
                name=name,
                profile_image=profile_image,
                last_login=datetime.now(timezone.utc)
            )
            db.add(user)
    else:
        user.last_login = datetime.now(timezone.utc)
        if profile_image:
            user.profile_image = profile_image
        if name:
            user.name = name

    db.commit()
    db.refresh(user)
    return user

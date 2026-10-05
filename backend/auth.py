from datetime import datetime, timedelta, timezone
from typing import Optional, Union, Set
import jwt
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.orm import Session
from google.oauth2 import id_token
from google.auth.transport import requests as google_requests

from backend.config import settings
from backend.database import get_db
from backend.models import User, AuthorizedRescuer
from backend.schemas import UserResponse

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

RESCUER_ROLES: Set[str] = {
    "AUTHORIZED_RESCUER",
    "FIRE_RESCUER",
    "POLICE_RESCUER",
    "DISASTER_RESPONSE",
    "SEARCH_RESCUE",
    "EMERGENCY_OPERATOR"
}

def to_user_response(account: Union[User, AuthorizedRescuer]) -> UserResponse:
    """
    Serializes a database User or AuthorizedRescuer into a unified UserResponse schema.
    Password hashes and sensitive credentials are never exposed.
    """
    if isinstance(account, AuthorizedRescuer):
        return UserResponse(
            id=account.id,
            rescuer_id=account.rescuer_id,
            name=account.name,
            role=account.role or "AUTHORIZED_RESCUER",
            user_type="rescuer",
            organization=account.organization,
            department=account.department,
            designation=account.designation,
            is_active=account.is_active,
            created_at=account.created_at,
            updated_at=account.updated_at,
            last_login=account.last_login,
            profile_image=None
        )
    else:
        return UserResponse(
            id=account.id,
            email=account.email,
            name=account.name,
            role=account.role or "GENERAL_USER",
            user_type="general",
            is_active=account.is_active,
            profile_image=account.profile_image,
            created_at=account.created_at,
            updated_at=account.updated_at,
            last_login=account.last_login
        )

def get_current_user(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(security),
    db: Session = Depends(get_db)
) -> Union[User, AuthorizedRescuer]:
    """
    Dependency to authenticate and return the current user or rescuer.
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
    user_type = payload.get("user_type")
    if not user_id:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Malformed token payload"
        )

    if user_type == "rescuer":
        rescuer = db.query(AuthorizedRescuer).filter(
            (AuthorizedRescuer.id == user_id) | (AuthorizedRescuer.rescuer_id == user_id)
        ).first()
        if not rescuer:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Authorized responder account no longer exists"
            )
        if not rescuer.is_active:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="This authorized responder account is currently inactive."
            )
        return rescuer

    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        # Fallback check for rescuer if user_type was unspecified
        rescuer = db.query(AuthorizedRescuer).filter(
            (AuthorizedRescuer.id == user_id) | (AuthorizedRescuer.rescuer_id == user_id)
        ).first()
        if rescuer:
            if not rescuer.is_active:
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="This authorized responder account is currently inactive."
                )
            return rescuer
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User account no longer exists"
        )

    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Account is currently inactive."
        )

    return user

def require_rescuer(
    current_user: Union[User, AuthorizedRescuer] = Depends(get_current_user)
) -> AuthorizedRescuer:
    if isinstance(current_user, AuthorizedRescuer) or current_user.role in RESCUER_ROLES:
        return current_user  # type: ignore
    raise HTTPException(
        status_code=status.HTTP_403_FORBIDDEN,
        detail="Access denied: Authorized Rescuer credentials required."
    )

def verify_google_id_token(token_str: str) -> dict:
    try:
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

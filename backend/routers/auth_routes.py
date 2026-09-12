from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from datetime import datetime, timezone
import uuid

from backend.database import get_db
from backend.models import User
from backend.schemas import (
    GoogleAuthRequest, DevLoginRequest, AuthTokenResponse, UserResponse
)
from backend.auth import (
    verify_google_id_token, get_or_create_google_user, create_access_token, get_current_user
)

router = APIRouter(prefix="/api/auth", tags=["Authentication"])

@router.post("/google", response_model=AuthTokenResponse)
def login_with_google(req: GoogleAuthRequest, db: Session = Depends(get_db)):
    """
    Verifies Google OAuth ID token server-side, retrieves or creates the user in PostgreSQL,
    and returns a signed JWT session token.
    """
    google_info = verify_google_id_token(req.id_token)
    user = get_or_create_google_user(db, google_info)
    access_token = create_access_token(data={"sub": user.id, "email": user.email})

    return AuthTokenResponse(
        access_token=access_token,
        token_type="bearer",
        user=UserResponse(
            id=user.id,
            email=user.email,
            name=user.name,
            profile_image=user.profile_image,
            created_at=user.created_at,
            last_login=user.last_login
        )
    )

@router.post("/dev-login", response_model=AuthTokenResponse)
def login_dev(req: DevLoginRequest, db: Session = Depends(get_db)):
    """
    Offline/Development login for local validation without Google OAuth credentials.
    Creates or retrieves the real database user account and returns a real signed JWT.
    """
    user = db.query(User).filter(User.email == req.email).first()
    if not user:
        user = User(
            id=str(uuid.uuid4()),
            google_id=f"dev_{uuid.uuid4().hex[:12]}",
            email=req.email,
            name=req.name,
            profile_image=req.profile_image or "/assets/avatar_keshav.png",
            created_at=datetime.now(timezone.utc),
            last_login=datetime.now(timezone.utc)
        )
        db.add(user)
    else:
        user.last_login = datetime.now(timezone.utc)
        user.name = req.name
    
    db.commit()
    db.refresh(user)

    access_token = create_access_token(data={"sub": user.id, "email": user.email})
    return AuthTokenResponse(
        access_token=access_token,
        token_type="bearer",
        user=UserResponse(
            id=user.id,
            email=user.email,
            name=user.name,
            profile_image=user.profile_image,
            created_at=user.created_at,
            last_login=user.last_login
        )
    )

@router.get("/me", response_model=UserResponse)
def get_me(current_user: User = Depends(get_current_user)):
    """
    Returns the authenticated user's profile from database.
    """
    return UserResponse(
        id=current_user.id,
        email=current_user.email,
        name=current_user.name,
        profile_image=current_user.profile_image,
        created_at=current_user.created_at,
        last_login=current_user.last_login
    )

@router.post("/logout")
def logout(current_user: User = Depends(get_current_user)):
    return {"message": "Logged out successfully"}

import re
import uuid
from datetime import datetime, timezone
from typing import Union
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import func
from sqlalchemy.orm import Session

from backend.database import get_db
from backend.models import User, AuthorizedRescuer
from backend.schemas import (
    GeneralRegisterRequest,
    GeneralLoginRequest,
    RescuerLoginRequest,
    GoogleAuthRequest,
    DevLoginRequest,
    AuthTokenResponse,
    UserResponse
)
from backend.auth import (
    create_access_token,
    get_current_user,
    to_user_response,
    verify_google_id_token,
    get_or_create_google_user
)
from backend.security import hash_password, verify_password, validate_password_strength

router = APIRouter(tags=["Authentication"])

@router.post("/register", response_model=AuthTokenResponse, status_code=status.HTTP_201_CREATED)
def register_general_user(req: GeneralRegisterRequest, db: Session = Depends(get_db)):
    """
    Registers a new GENERAL USER account with real bcrypt password hashing.
    """
    clean_email = req.email.strip().lower()
    clean_name = req.name.strip()

    if not re.match(r"^[^@\s]+@[^@\s]+\.[^@\s]+$", clean_email):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Please provide a valid email address."
        )

    is_valid, msg = validate_password_strength(req.password)
    if not is_valid:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=msg
        )

    existing_user = db.query(User).filter(func.lower(User.email) == clean_email).first()
    if existing_user:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="An account with this email address already exists. Please sign in."
        )

    now = datetime.now(timezone.utc)
    hashed_pwd = hash_password(req.password)

    new_user = User(
        id=str(uuid.uuid4()),
        email=clean_email,
        name=clean_name,
        password_hash=hashed_pwd,
        role="GENERAL_USER",
        is_active=True,
        profile_image="/assets/avatar_keshav.png",
        created_at=now,
        updated_at=now,
        last_login=now
    )
    db.add(new_user)
    db.commit()
    db.refresh(new_user)

    token_payload = {
        "sub": new_user.id,
        "email": new_user.email,
        "name": new_user.name,
        "role": "GENERAL_USER",
        "user_type": "general"
    }
    access_token = create_access_token(data=token_payload)

    return AuthTokenResponse(
        access_token=access_token,
        token_type="bearer",
        user=to_user_response(new_user)
    )

@router.post("/login", response_model=AuthTokenResponse)
def login_general_user(req: GeneralLoginRequest, db: Session = Depends(get_db)):
    """
    Authenticates a GENERAL USER with email and password.
    """
    clean_email = req.email.strip().lower()

    user = db.query(User).filter(func.lower(User.email) == clean_email).first()
    if not user or not user.password_hash:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password."
        )

    if not verify_password(req.password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password."
        )

    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Account is currently inactive."
        )

    user.last_login = datetime.now(timezone.utc)
    db.commit()
    db.refresh(user)

    token_payload = {
        "sub": user.id,
        "email": user.email,
        "name": user.name,
        "role": user.role or "GENERAL_USER",
        "user_type": "general"
    }
    access_token = create_access_token(data=token_payload)

    return AuthTokenResponse(
        access_token=access_token,
        token_type="bearer",
        user=to_user_response(user)
    )

@router.post("/rescuer/login", response_model=AuthTokenResponse)
def login_authorized_rescuer(req: RescuerLoginRequest, db: Session = Depends(get_db)):
    """
    Authenticates an AUTHORIZED RESCUER using unique rescuer_id and password.
    """
    clean_id = req.rescuer_id.strip()

    rescuer = db.query(AuthorizedRescuer).filter(
        func.lower(AuthorizedRescuer.rescuer_id) == clean_id.lower()
    ).first()

    if not rescuer:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid rescuer ID or password."
        )

    if not rescuer.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="This authorized responder account is currently inactive."
        )

    if not verify_password(req.password, rescuer.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid rescuer ID or password."
        )

    rescuer.last_login = datetime.now(timezone.utc)
    db.commit()
    db.refresh(rescuer)

    token_payload = {
        "sub": rescuer.id,
        "rescuer_id": rescuer.rescuer_id,
        "name": rescuer.name,
        "role": rescuer.role or "AUTHORIZED_RESCUER",
        "user_type": "rescuer"
    }
    access_token = create_access_token(data=token_payload)

    return AuthTokenResponse(
        access_token=access_token,
        token_type="bearer",
        user=to_user_response(rescuer)
    )

@router.post("/dev-login", response_model=AuthTokenResponse)
def login_dev(req: DevLoginRequest, db: Session = Depends(get_db)):
    """
    Offline/Development analyst login. Creates or retrieves analyst account.
    """
    user = db.query(User).filter(User.email == req.email).first()
    now = datetime.now(timezone.utc)
    if not user:
        user = User(
            id=str(uuid.uuid4()),
            google_id=f"dev_{uuid.uuid4().hex[:12]}",
            email=req.email,
            name=req.name,
            role="GENERAL_USER",
            is_active=True,
            profile_image=req.profile_image or "/assets/avatar_keshav.png",
            created_at=now,
            updated_at=now,
            last_login=now
        )
        db.add(user)
    else:
        user.last_login = now
        user.name = req.name
    
    db.commit()
    db.refresh(user)

    token_payload = {
        "sub": user.id,
        "email": user.email,
        "name": user.name,
        "role": user.role or "GENERAL_USER",
        "user_type": "general"
    }
    access_token = create_access_token(data=token_payload)
    return AuthTokenResponse(
        access_token=access_token,
        token_type="bearer",
        user=to_user_response(user)
    )

@router.get("/me", response_model=UserResponse)
def get_me(current_user: Union[User, AuthorizedRescuer] = Depends(get_current_user)):
    """
    Returns the authenticated user or rescuer profile from database.
    """
    return to_user_response(current_user)

@router.post("/logout")
def logout(current_user: Union[User, AuthorizedRescuer] = Depends(get_current_user)):
    return {"message": "Logged out successfully", "user_id": current_user.id}

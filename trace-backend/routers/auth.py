"""
Authentication Router — JWT login + user info.

POST /auth/login  → returns JWT token + user info
GET  /auth/me     → returns current user from token
"""
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from auth import (
    USERS_DB,
    verify_password,
    create_access_token,
    get_current_user,
)


class LoginRequest(BaseModel):
    username: str
    password: str


class LoginResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: dict


class UserResponse(BaseModel):
    username: str
    display_name: str
    badge: str
    unit: str
    role: str


router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/login", response_model=LoginResponse)
def login(payload: LoginRequest):
    """Authenticate with username/password, returns JWT token."""
    user = USERS_DB.get(payload.username)
    if not user or not verify_password(payload.password, user["password_hash"]):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid credentials",
        )

    token = create_access_token({"sub": user["username"], "role": user["role"]})
    return LoginResponse(
        access_token=token,
        user={
            "username": user["username"],
            "display_name": user["display_name"],
            "badge": user["badge"],
            "unit": user["unit"],
            "role": user["role"],
        },
    )


@router.get("/me", response_model=UserResponse)
def get_me(current_user: dict = Depends(get_current_user)):
    """Return current authenticated user info."""
    return UserResponse(
        username=current_user["username"],
        display_name=current_user["display_name"],
        badge=current_user["badge"],
        unit=current_user["unit"],
        role=current_user["role"],
    )

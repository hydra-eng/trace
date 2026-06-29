import base64
import json
import hmac
import hashlib
import time
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from pydantic import BaseModel

SECRET_KEY = "PrakasamPolice_Secret_Key_2026!"

USERS = {
    "investigator": {
        "password": "PrakasamPolice_2026!",
        "role": "inspector",
        "name": "Inspector K. Venkata Rao",
        "badge": "AP-CID-1042"
    },
    "sp_prakasham": {
        "password": "SP_Prakasham_2026!",
        "role": "sp",
        "name": "Superintendent of Police, Prakasham",
        "badge": "AP-SP-0067"
    },
    "constable": {
        "password": "Constable_View_2026!",
        "role": "viewer",
        "name": "Constable M. Raju",
        "badge": "AP-PC-4421"
    }
}

ROLE_PERMISSIONS = {
    "viewer": ["view_cases", "view_suspects", "view_network", "view_map"],
    "inspector": [
        "view_cases", "view_suspects", "view_network", "view_map",
        "upload_cdr", "run_analysis", "download_pdf", "view_audit",
        "mark_reviewed",        # may mark 65B worksheet as officer-reviewed
    ],
    "sp": [
        "view_cases", "view_suspects", "view_network", "view_map",
        "upload_cdr", "run_analysis", "download_pdf", "view_audit",
        "delete_case", "manage_users", "view_all_cases",
        "mark_reviewed",        # sp can also mark reviewed
    ]
}

class LoginRequest(BaseModel):
    username: str
    password: str

class LoginResponse(BaseModel):
    token: str
    role: str
    name: str
    badge: str

router = APIRouter(prefix="/auth", tags=["auth"])

def base64url_encode(data: bytes) -> str:
    return base64.urlsafe_b64encode(data).rstrip(b'=').decode('utf-8')

def base64url_decode(data: str) -> bytes:
    padding = '=' * (4 - len(data) % 4)
    return base64.urlsafe_b64decode(data + padding)

def create_jwt(payload: dict) -> str:
    header = {"alg": "HS256", "typ": "JWT"}
    header_b64 = base64url_encode(json.dumps(header).encode('utf-8'))
    payload_b64 = base64url_encode(json.dumps(payload).encode('utf-8'))
    
    signature_input = f"{header_b64}.{payload_b64}".encode('utf-8')
    sig = hmac.new(SECRET_KEY.encode('utf-8'), signature_input, hashlib.sha256).digest()
    sig_b64 = base64url_encode(sig)
    return f"{header_b64}.{payload_b64}.{sig_b64}"

def decode_jwt(token: str) -> dict:
    try:
        parts = token.split('.')
        if len(parts) != 3:
            raise ValueError("Invalid token format")
        header_b64, payload_b64, sig_b64 = parts
        
        signature_input = f"{header_b64}.{payload_b64}".encode('utf-8')
        expected_sig = hmac.new(SECRET_KEY.encode('utf-8'), signature_input, hashlib.sha256).digest()
        expected_sig_b64 = base64url_encode(expected_sig)
        
        if not hmac.compare_digest(sig_b64, expected_sig_b64):
            raise ValueError("Invalid signature")
            
        payload = json.loads(base64url_decode(payload_b64).decode('utf-8'))
        
        if "exp" in payload and payload["exp"] < time.time():
            raise ValueError("Token expired")
            
        return payload
    except Exception as e:
        raise ValueError(f"JWT decode error: {str(e)}")

@router.post("/login", response_model=LoginResponse)
def login(payload: LoginRequest):
    user = USERS.get(payload.username)
    if not user or user["password"] != payload.password:
        raise HTTPException(status_code=401, detail="Invalid secure credentials.")
    
    token_payload = {
        "sub": payload.username,
        "role": user["role"],
        "name": user["name"],
        "badge": user["badge"],
        "exp": time.time() + 24 * 3600
    }
    token = create_jwt(token_payload)
    return LoginResponse(
        token=token,
        role=user["role"],
        name=user["name"],
        badge=user["badge"]
    )

security = HTTPBearer(auto_error=False)

def get_current_user(request: Request, credentials: Optional[HTTPAuthorizationCredentials] = Depends(security)):
    token = None
    if credentials:
        token = credentials.credentials
    if not token:
        token = request.query_params.get("token")
    if not token:
        raise HTTPException(status_code=401, detail="Not authenticated")
    try:
        payload = decode_jwt(token)
        return payload
    except Exception as e:
        raise HTTPException(status_code=401, detail=f"Invalid session: {str(e)}")

def require_permission(required_permission: str):
    def dependency(current_user: dict = Depends(get_current_user)):
        role = current_user.get("role", "viewer")
        user_perms = ROLE_PERMISSIONS.get(role, [])
        if required_permission not in user_perms:
            raise HTTPException(status_code=403, detail="Unauthorized action: insufficient permissions.")
        return current_user
    return dependency

import os
from datetime import datetime, timedelta
from typing import Optional
from dotenv import load_dotenv
import jwt
import bcrypt
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from .database import get_db_cursor

load_dotenv()

JWT_SECRET = os.getenv("JWT_SECRET", "PTE_FOODIE_DEV_SECRET_KEY")
JWT_ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_HOURS = 24

security = HTTPBearer()

def verify_password(plain_password: str, hashed_password: str) -> bool:
    """
    Secure password verification using bcrypt.
    Strictly verifies candidate password against stored hash.
    No backdoors, bypasses, or fallback shortcuts.
    """
    if not plain_password or not hashed_password:
        return False
    try:
        return bcrypt.checkpw(plain_password.encode('utf-8'), hashed_password.encode('utf-8'))
    except Exception:
        return False

def get_password_hash(password: str) -> str:
    """
    Secure password hashing using bcrypt with 12 salt rounds (industry standard).
    """
    return bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt(12)).decode('utf-8')

def create_access_token(data: dict, expires_delta: Optional[timedelta] = None) -> str:
    to_encode = data.copy()
    expire = datetime.utcnow() + (expires_delta or timedelta(hours=ACCESS_TOKEN_EXPIRE_HOURS))
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, JWT_SECRET, algorithm=JWT_ALGORITHM)

def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)) -> dict:
    token = credentials.credentials
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        user_id = payload.get("id")
        if not user_id:
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token payload.")
    except jwt.PyJWTError:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid or expired token.")

    with get_db_cursor() as cur:
        cur.execute("""
            SELECT u.id, u.organization_id, u.email, u.first_name, u.last_name, u.role, 
                   u.phone_number, u.is_active, u.is_deleted, u.last_login_at, u.created_at, u.updated_at, 
                   u.token_version, o.is_active AS org_is_active, o.is_deleted AS org_is_deleted,
                   o.status AS org_status
            FROM users u
            LEFT JOIN organizations o ON u.organization_id = o.id
            WHERE u.id = %s;
        """, (user_id,))
        row = cur.fetchone()
        if not row:
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="User account not found.")

        cols = [desc[0] for desc in cur.description]
        user_dict = dict(zip(cols, row))

        if user_dict.get("is_deleted"):
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="User account has been deleted.")

        if not user_dict.get("is_active"):
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="User account is deactivated.")

        # Check client organization status for non-OEM accounts
        if user_dict.get("role") != "OEM_MANAGER" and user_dict.get("organization_id"):
            org_status = str(user_dict.get("org_status") or "").lower()
            if user_dict.get("org_is_active") is False or user_dict.get("org_is_deleted") is True or org_status in ("inactive", "archived"):
                raise HTTPException(
                    status_code=status.HTTP_401_UNAUTHORIZED,
                    detail="Client organization account has been suspended or deactivated."
                )

        # Enforce token revocation check
        raw_token_version = payload.get("token_version")
        token_version = int(raw_token_version) if raw_token_version is not None else 1
        db_token_version = user_dict.get("token_version") or 1

        if token_version != db_token_version:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Token has been revoked or invalidated. Please sign in again."
            )

        return user_dict

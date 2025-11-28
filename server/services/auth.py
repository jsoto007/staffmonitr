from __future__ import annotations

import secrets
from datetime import datetime, timedelta
from typing import Optional

import bcrypt
import hashlib
import jwt
from flask import current_app
from jwt import PyJWTError


def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')


def verify_password(password: str, password_hash: Optional[str]) -> bool:
    if not password_hash:
        return False
    return bcrypt.checkpw(password.encode('utf-8'), password_hash.encode('utf-8'))


def create_access_token(staff_id: str, role: str, expiry: Optional[timedelta] = None) -> dict:
    expires_in = expiry or current_app.config['JWT_EXPIRY']
    expires_at = datetime.utcnow() + expires_in
    payload = {
        'sub': staff_id,
        'role': role,
        'exp': expires_at,
    }
    token = jwt.encode(payload, current_app.config['SECRET_KEY'], algorithm='HS256')
    return {'token': token, 'expires_at': expires_at.isoformat()}


def decode_access_token(token: str) -> Optional[dict]:
    try:
        return jwt.decode(token, current_app.config['SECRET_KEY'], algorithms=['HS256'])
    except PyJWTError:
        return None


def create_invite_token(expiry: Optional[timedelta] = None) -> dict:
    return {
        'token': secrets.token_urlsafe(32),
        'expires_at': datetime.utcnow() + (expiry or timedelta(hours=24)),
    }


def validate_invite(token: str, expires_at: datetime) -> bool:
    return datetime.utcnow() < expires_at


def oauth2_state() -> str:
    return secrets.token_urlsafe(16)


def hash_invite_token(token: str) -> str:
    """Return the SHA-256 digest of the invite token for safe storage."""
    return hashlib.sha256(token.encode('utf-8')).hexdigest()

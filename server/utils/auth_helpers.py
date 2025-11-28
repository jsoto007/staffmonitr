from __future__ import annotations

from functools import wraps
from typing import Callable, Optional

from flask import current_app, g, jsonify, request

from ..models import StaffMember
from ..services.auth import decode_access_token


def _token_from_request() -> Optional[str]:
    cookie_name = current_app.config.get('JWT_COOKIE_NAME', 'staffmonitr_access_token')
    token = request.cookies.get(cookie_name)
    if token:
        return token
    header = request.headers.get('Authorization', '')
    parts = header.split()
    if len(parts) == 2 and parts[0].lower() == 'bearer':
        return parts[1]
    return None


def require_auth(func: Callable) -> Callable:
    @wraps(func)
    def decorated(*args, **kwargs):
        token = _token_from_request()
        if not token:
            return jsonify({'error': 'Authorization token required'}), 401

        payload = decode_access_token(token)
        if not payload:
            return jsonify({'error': 'Invalid or expired token'}), 401

        staff_id = payload.get('sub')
        if not staff_id:
            return jsonify({'error': 'Invalid token payload'}), 401

        staff = StaffMember.query.get(staff_id)
        if not staff:
            return jsonify({'error': 'Staff member not found'}), 404

        g.current_staff = staff

        return func(*args, current_staff=staff, **kwargs)

    return decorated


def require_role(*allowed_roles: str) -> Callable:
    def decorator(func: Callable) -> Callable:
        @wraps(func)
        def decorated(*args, **kwargs):
            staff = kwargs.get('current_staff')
            if not staff or staff.role not in allowed_roles:
                return jsonify({'error': 'Insufficient permissions'}), 403
            return func(*args, **kwargs)

        return decorated

    return decorator

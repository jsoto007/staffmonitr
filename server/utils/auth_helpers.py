from __future__ import annotations

from functools import wraps
from typing import Callable, Optional

from flask import current_app, g, jsonify, request

from ..models import StaffMember
from ..services.role_service import get_effective_permissions_for_user
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


def _cached_permissions(staff: StaffMember) -> set[str]:
    if getattr(g, 'current_permissions', None) is None:
        g.current_permissions = get_effective_permissions_for_user(staff)
    return g.current_permissions


def require_role(*allowed_roles: str) -> Callable:
    def _normalize(value: str) -> str:
        return ''.join(value.replace('_', ' ').lower().split())

    def decorator(func: Callable) -> Callable:
        @wraps(func)
        def decorated(*args, **kwargs):
            staff = kwargs.get('current_staff')
            if not staff:
                return jsonify({'error': 'Insufficient permissions'}), 403
            if allowed_roles and all(_normalize(staff.role) != _normalize(role) for role in allowed_roles):
                return jsonify({'error': 'Insufficient permissions'}), 403
            return func(*args, **kwargs)

        return decorated

    return decorator


def require_permission(*permission_codes: str) -> Callable:
    def decorator(func: Callable) -> Callable:
        @wraps(func)
        def decorated(*args, **kwargs):
            staff: StaffMember | None = kwargs.get('current_staff')
            if not staff:
                return jsonify({'error': 'Authorization required'}), 401
            permissions = _cached_permissions(staff)
            missing = [code for code in permission_codes if code not in permissions]
            if missing:
                return jsonify({'error': 'Insufficient permissions', 'missing': missing}), 403
            return func(*args, **kwargs)

        return decorated

    return decorator

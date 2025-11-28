from datetime import datetime

from flask import Blueprint, current_app, jsonify, make_response, request
from pydantic import ValidationError
from sqlalchemy.exc import IntegrityError

from ..database import db
from ..models import AccountGroup, StaffMember
from ..schemas import LoginSchema, SignupSchema
from ..services.auth import create_access_token, hash_password, verify_password
from ..utils.auth_helpers import require_auth

auth_bp = Blueprint('auth', __name__)


def _account_payload(account: AccountGroup) -> dict:
    return {
        'id': account.id,
        'name': account.name,
        'timezone': account.timezone,
        'branding': {
            'primaryColor': account.brand_primary,
            'logoUrl': account.logo_url,
        },
        'geofence': {
            'lat': account.geofence_lat,
            'lon': account.geofence_lon,
            'radiusMeters': account.geofence_radius,
        },
    }


def _staff_payload(staff: StaffMember) -> dict:
    return {
        'id': staff.id,
        'full_name': staff.full_name,
        'email': staff.email,
        'role': staff.role,
        'status': staff.status,
        'assigned_account_ids': [account.id for account in staff.accounts],
        'invite_expires_at': staff.invite_expires_at.isoformat() if staff.invite_expires_at else None,
    }


def _cookie_settings() -> dict:
    """Central auth-cookie settings so logout and login stay in sync."""
    return {
        'httponly': True,
        'secure': current_app.config.get('JWT_COOKIE_SECURE', False),
        'samesite': current_app.config.get('JWT_COOKIE_SAMESITE', 'Lax'),
        'path': current_app.config.get('JWT_COOKIE_PATH', '/'),
    }


def _attach_auth_cookie(response, token: str):
    cookie_settings = _cookie_settings()
    cookie_settings['max_age'] = int(current_app.config['JWT_EXPIRY'].total_seconds())
    response.set_cookie(current_app.config['JWT_COOKIE_NAME'], token, **cookie_settings)
    # TODO: Add CSRF token validation on state-changing requests when cookies are the primary auth method.


def _clear_auth_cookie(response):
    cookie_settings = _cookie_settings()
    response.set_cookie(
        current_app.config['JWT_COOKIE_NAME'],
        '',
        expires=0,
        max_age=0,
        **cookie_settings,
    )


def _build_auth_response(staff: StaffMember, status_code: int = 200):
    token_data = create_access_token(staff.id, staff.role)
    response = make_response(
        jsonify(
            {
                'expires_at': token_data['expires_at'],
                'staff': _staff_payload(staff),
                'accounts': [_account_payload(account) for account in staff.accounts],
            }
        ),
        status_code,
    )
    _attach_auth_cookie(response, token_data['token'])
    return response


@auth_bp.route('/auth/signup', methods=['POST'])
def signup():
    """Public endpoint for workspace owners to register a new account."""
    try:
        validated = SignupSchema.model_validate(request.json or {})
    except ValidationError as exc:
        return jsonify({'error': 'Invalid signup payload', 'details': exc.errors()}), 400

    if StaffMember.query.filter_by(email=validated.email).first():
        return jsonify({'error': 'Email already registered'}), 409

    friendly_name = validated.full_name.strip()
    lead_name = friendly_name.split()[0] if friendly_name else 'Workspace'
    account_name = (
        validated.account_name
        or validated.company
        or validated.organization
        or f"{lead_name}'s workspace"
    )
    branding = validated.branding.dict() if validated.branding else {}
    geofence = validated.geofence.dict() if validated.geofence else {}

    account = AccountGroup(
        name=account_name,
        timezone=validated.timezone,
        brand_primary=branding.get('primaryColor', '#1d4ed8'),
        logo_url=branding.get('logoUrl') or validated.logo_url,
        geofence_lat=float(geofence.get('lat', 0.0)),
        geofence_lon=float(geofence.get('lon', 0.0)),
        geofence_radius=int(geofence.get('radiusMeters', 900)),
    )
    staff = StaffMember(
        full_name=validated.full_name,
        email=validated.email,
        role=validated.role.value,
        status='active',
        invited_at=datetime.utcnow(),
        password_hash=hash_password(validated.password),
    )
    account.staff.append(staff)

    try:
        db.session.add(account)
        db.session.commit()
    except IntegrityError:
        db.session.rollback()
        return jsonify({'error': 'Unable to register account'}), 422

    return _build_auth_response(staff, status_code=201)


@auth_bp.route('/auth/login', methods=['POST'])
def login():
    """Issue a session cookie for a verified staff member."""
    try:
        validated = LoginSchema.model_validate(request.json or {})
    except ValidationError as exc:
        return jsonify({'error': 'Invalid login payload', 'details': exc.errors()}), 400

    staff = StaffMember.query.filter_by(email=validated.email).first()
    if not staff or not verify_password(validated.password, staff.password_hash):
        return jsonify({'error': 'Invalid credentials'}), 401

    return _build_auth_response(staff)


@auth_bp.route('/auth/me', methods=['GET'])
@require_auth
def me(*, current_staff):
    return (
        jsonify(
            {
                'staff': _staff_payload(current_staff),
                'accounts': [_account_payload(account) for account in current_staff.accounts],
            }
        ),
        200,
    )


@auth_bp.route('/auth/logout', methods=['POST'])
@require_auth
def logout(*, current_staff):
    """Clear the auth cookie so the browser no longer sends a valid JWT."""
    response = make_response(jsonify({'success': True}), 200)
    _clear_auth_cookie(response)
    return response

from datetime import datetime, timedelta

from flask import Blueprint, jsonify, request
from pydantic import ValidationError
from sqlalchemy.exc import IntegrityError

from ..database import db
from ..models import AccountGroup, Invitation, StaffMember, UserRole
from ..roles import INVITE_ALLOWED_ROLE_VALUES, MANAGER_ROLE_VALUES, SUPER_ADMIN_ROLE_VALUES
from ..schemas import CreateAccountSchema, InviteCreateSchema
from ..services.auth import create_invite_token, hash_invite_token, hash_password
from ..services.role_service import find_access_role_by_name
from ..utils.auth_helpers import require_auth, require_role

accounts_bp = Blueprint('accounts', __name__)

@accounts_bp.route('/accounts', methods=['GET'])
def list_accounts():
    accounts = AccountGroup.query.order_by(AccountGroup.name).all()
    return jsonify([{'id': acc.id, 'name': acc.name, 'timezone': acc.timezone} for acc in accounts])

@accounts_bp.route('/accounts', methods=['POST'])
@require_auth
@require_role(*MANAGER_ROLE_VALUES)
def create_account(*, current_staff):
    """Admins with manage permissions may create new tenant accounts."""
    try:
        validated = CreateAccountSchema.model_validate(request.json or {})
    except ValidationError as exc:
        return jsonify({'error': 'Invalid account payload', 'details': exc.errors()}), 400

    geofence = validated.geofence.dict() if validated.geofence else {}
    account = AccountGroup(
        name=validated.name,
        timezone=validated.timezone,
        brand_primary=validated.theme,
        geofence_lat=float(geofence.get('lat', 0.0)),
        geofence_lon=float(geofence.get('lon', 0.0)),
        geofence_radius=int(geofence.get('radiusMeters', 900)),
    )
    try:
        db.session.add(account)
        db.session.commit()
    except IntegrityError:
        db.session.rollback()
        return jsonify({'error': 'Unable to create account'}), 422
    return jsonify({'id': account.id, 'message': 'Account created'}), 201

@accounts_bp.route('/accounts/<account_id>/staff', methods=['GET'])
def account_staff(account_id):
    account = AccountGroup.query.get_or_404(account_id)
    staff = [
        {
            'id': member.id,
            'full_name': member.full_name,
            'role': member.role,
            'email': member.email,
            'phone_number': member.phone_number,
            'photo_url': member.photo_url,
        }
        for member in account.staff
    ]
    return jsonify({'staff': staff})


@accounts_bp.route('/accounts/<account_id>/staff', methods=['POST'])
@require_auth
@require_role(*MANAGER_ROLE_VALUES)
def create_account_staff(account_id, *, current_staff):
    account = AccountGroup.query.get_or_404(account_id)
    if account not in current_staff.accounts:
        return jsonify({'error': 'Not assigned to the requested account'}), 403

    data = request.json or {}
    full_name = data.get('full_name', '').strip()
    email = (data.get('email') or '').strip().lower()
    phone_number = (data.get('phone_number') or '').strip()
    photo_url = (data.get('photo_url') or '').strip()
    password = data.get('password')
    role = data.get('role', 'Staff')

    if not (full_name and email and password):
        return jsonify({'error': 'full_name, email, and password are required'}), 400
    access_role = find_access_role_by_name(role)
    if not access_role:
        return jsonify({'error': 'Unsupported role. Create it via + Create role first.'}), 400
    if StaffMember.query.filter_by(email=email).first():
        return jsonify({'error': 'Email already registered'}), 409

    staff = StaffMember(
        full_name=full_name,
        email=email,
        phone_number=phone_number,
        photo_url=photo_url,
        role=access_role.name,
        status='active',
        invited_at=datetime.utcnow(),
        password_hash=hash_password(password),
    )
    staff.accounts.append(account)

    try:
        db.session.add(staff)
        db.session.flush()
        db.session.add(UserRole(staff_id=staff.id, role_id=access_role.id))
        db.session.commit()
    except IntegrityError:
        db.session.rollback()
        return jsonify({'error': 'Unable to create staff member'}), 422

    return jsonify(
        {
            'id': staff.id,
            'full_name': staff.full_name,
            'email': staff.email,
            'phone_number': staff.phone_number,
            'photo_url': staff.photo_url,
            'role': staff.role,
            'status': staff.status,
            'assigned_account_ids': [acct.id for acct in staff.accounts],
        }
    ), 201


@accounts_bp.route('/accounts/<account_id>/staff/<staff_id>', methods=['PATCH'])
@require_auth
@require_role(*MANAGER_ROLE_VALUES)
def update_account_staff(account_id, staff_id, *, current_staff):
    account = AccountGroup.query.get_or_404(account_id)
    if account not in current_staff.accounts:
        return jsonify({'error': 'Not assigned to the requested account'}), 403
    staff = StaffMember.query.get_or_404(staff_id)
    if staff not in account.staff:
        return jsonify({'error': 'Staff not assigned to this account'}), 404
    data = request.json or {}
    if 'role' in data:
        access_role = find_access_role_by_name(data['role'])
        if not access_role:
            return jsonify({'error': 'Unsupported role. Create it via + Create role first.'}), 400
        staff.role = access_role.name
        UserRole.query.filter_by(staff_id=staff.id).delete()
        db.session.add(UserRole(staff_id=staff.id, role_id=access_role.id))
    if 'status' in data:
        staff.status = data['status']
    if 'phone_number' in data:
        staff.phone_number = data['phone_number']
    if 'photo_url' in data:
        staff.photo_url = data['photo_url']
    db.session.commit()
    return jsonify(
        {
            'id': staff.id,
            'full_name': staff.full_name,
            'email': staff.email,
            'phone_number': staff.phone_number,
            'photo_url': staff.photo_url,
            'role': staff.role,
        'status': staff.status,
        'assigned_account_ids': [acct.id for acct in staff.accounts],
    }
)


@accounts_bp.route('/accounts/<account_id>/staff/<staff_id>', methods=['DELETE'])
@require_auth
@require_role(*MANAGER_ROLE_VALUES)
def remove_account_staff(account_id, staff_id, *, current_staff):
    account = AccountGroup.query.get_or_404(account_id)
    if account not in current_staff.accounts:
        return jsonify({'error': 'Not assigned to the requested account'}), 403
    staff = StaffMember.query.get_or_404(staff_id)
    if staff not in account.staff:
        return jsonify({'error': 'Staff not assigned to this account'}), 404
    account.staff.remove(staff)
    db.session.commit()
    return jsonify({'message': 'Staff removed from account'})

@accounts_bp.route('/accounts/<account_id>/invite', methods=['POST'])
@require_auth
@require_role(*INVITE_ALLOWED_ROLE_VALUES)
def invite_staff(account_id, *, current_staff):
    """Invite new staff; only owners/admins can request invites for their assigned account."""
    try:
        validated = InviteCreateSchema.model_validate(request.json or {})
    except ValidationError as exc:
        return jsonify({'error': 'Invalid invite payload', 'details': exc.errors()}), 400

    account = AccountGroup.query.get_or_404(account_id)
    if account not in current_staff.accounts and current_staff.role not in SUPER_ADMIN_ROLE_VALUES:
        return jsonify({'error': 'Not assigned to the requested account'}), 403

    normalized_email = validated.email.lower()
    if StaffMember.query.filter_by(email=normalized_email).first():
        return jsonify({'error': 'Staff member already exists'}), 409
    if Invitation.query.filter_by(email=normalized_email, account_group_id=account_id).first():
        return jsonify({'error': 'Invite already exists'}), 409

    token_data = create_invite_token(timedelta(hours=validated.expires_in))
    token_hash = hash_invite_token(token_data['token'])
    invite = Invitation(
        email=normalized_email,
        role=validated.role.value,
        expires_at=token_data['expires_at'],
        account_group_id=account_id,
        token=token_hash,
        token_hash=token_hash,
    )
    try:
        db.session.add(invite)
        db.session.commit()
    except IntegrityError:
        db.session.rollback()
        return jsonify({'error': 'Unable to create invite'}), 422

    return jsonify({'token': token_data['token'], 'expires_at': invite.expires_at.isoformat()}), 201

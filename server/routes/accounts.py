from datetime import datetime, timedelta
from flask import Blueprint, jsonify, request
from sqlalchemy.exc import IntegrityError

from ..database import db
from ..models import AccountGroup, Invitation, StaffMember
from ..services.auth import create_invite_token, hash_password, supported_roles
from ..utils.auth_helpers import require_auth, require_role

accounts_bp = Blueprint('accounts', __name__)

@accounts_bp.route('/accounts', methods=['GET'])
def list_accounts():
    accounts = AccountGroup.query.order_by(AccountGroup.name).all()
    return jsonify([{'id': acc.id, 'name': acc.name, 'timezone': acc.timezone} for acc in accounts])

@accounts_bp.route('/accounts', methods=['POST'])
def create_account():
    payload = request.json or {}
    account = AccountGroup(
        name=payload.get('name', 'New Site'),
        timezone=payload.get('timezone', 'UTC'),
        brand_primary=payload.get('theme', '#2563eb'),
        geofence_lat=payload.get('geofence', {}).get('lat', 0.0),
        geofence_lon=payload.get('geofence', {}).get('lon', 0.0),
        geofence_radius=payload.get('geofence', {}).get('radiusMeters', 900),
    )
    db.session.add(account)
    db.session.commit()
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
        }
        for member in account.staff
    ]
    return jsonify({'staff': staff})


@accounts_bp.route('/accounts/<account_id>/staff', methods=['POST'])
@require_auth
@require_role('Owner_admin')
def create_account_staff(account_id, *, current_staff):
    account = AccountGroup.query.get_or_404(account_id)
    if account not in current_staff.accounts:
        return jsonify({'error': 'Not assigned to the requested account'}), 403

    data = request.json or {}
    full_name = data.get('full_name', '').strip()
    email = (data.get('email') or '').strip().lower()
    password = data.get('password')
    role = data.get('role', 'Staff')

    if not (full_name and email and password):
        return jsonify({'error': 'full_name, email, and password are required'}), 400
    if role not in supported_roles():
        return jsonify({'error': 'Unsupported role'}), 400
    if StaffMember.query.filter_by(email=email).first():
        return jsonify({'error': 'Email already registered'}), 409

    staff = StaffMember(
        full_name=full_name,
        email=email,
        role=role,
        status='active',
        invited_at=datetime.utcnow(),
        password_hash=hash_password(password),
    )
    staff.accounts.append(account)

    try:
        db.session.add(staff)
        db.session.commit()
    except IntegrityError:
        db.session.rollback()
        return jsonify({'error': 'Unable to create staff member'}), 422

    return jsonify(
        {
            'id': staff.id,
            'full_name': staff.full_name,
            'email': staff.email,
            'role': staff.role,
            'status': staff.status,
            'assigned_account_ids': [acct.id for acct in staff.accounts],
        }
    ), 201


@accounts_bp.route('/accounts/<account_id>/staff/<staff_id>', methods=['PATCH'])
@require_auth
@require_role('Owner_admin')
def update_account_staff(account_id, staff_id, *, current_staff):
    account = AccountGroup.query.get_or_404(account_id)
    if account not in current_staff.accounts:
        return jsonify({'error': 'Not assigned to the requested account'}), 403
    staff = StaffMember.query.get_or_404(staff_id)
    if staff not in account.staff:
        return jsonify({'error': 'Staff not assigned to this account'}), 404
    data = request.json or {}
    if 'role' in data:
        if data['role'] not in supported_roles():
            return jsonify({'error': 'Unsupported role'}), 400
        staff.role = data['role']
    if 'status' in data:
        staff.status = data['status']
    db.session.commit()
    return jsonify(
        {
            'id': staff.id,
            'full_name': staff.full_name,
            'email': staff.email,
            'role': staff.role,
            'status': staff.status,
            'assigned_account_ids': [acct.id for acct in staff.accounts],
        }
    )


@accounts_bp.route('/accounts/<account_id>/staff/<staff_id>', methods=['DELETE'])
@require_auth
@require_role('Owner_admin')
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
def invite_staff(account_id):
    data = request.json or {}
    email = data.get('email')
    role = data.get('role', 'Staff')
    expires_in_hours = data.get('expires_in', 48)
    token_data = create_invite_token(timedelta(hours=expires_in_hours))
    invite = Invitation(
        email=email,
        role=role,
        expires_at=token_data['expires_at'],
        account_group_id=account_id,
        token=token_data['token'],
    )
    try:
        db.session.add(invite)
        db.session.commit()
    except IntegrityError:
        db.session.rollback()
        return jsonify({'error': 'Invite already exists'}), 422
    return jsonify({'token': invite.token, 'expires_at': invite.expires_at.isoformat()}), 201

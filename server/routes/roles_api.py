from __future__ import annotations

from flask import Blueprint, jsonify, request
from sqlalchemy import func
from sqlalchemy.orm import joinedload

from ..database import db
from ..models import AccessRole, Permission, Shift, UserRole
from ..services.role_service import (
    ensure_default_permissions,
    get_effective_permissions_for_user,
    resolve_permissions,
    serialize_permission,
    serialize_role,
    serialize_shift,
)
from ..utils.auth_helpers import require_auth, require_permission

roles_bp = Blueprint('roles', __name__)


@roles_bp.route('/roles/permissions', methods=['GET'])
@require_auth
@require_permission('MANAGE_ROLES')
def list_permissions(*, current_staff):
    ensure_default_permissions()
    permissions = Permission.query.order_by(Permission.code).all()
    return jsonify([serialize_permission(permission) for permission in permissions])


@roles_bp.route('/roles/shifts', methods=['GET'])
@require_auth
@require_permission('MANAGE_ROLES')
def list_shift_scopes(*, current_staff):
    account_id = request.args.get('account_id')
    query = Shift.query
    if account_id:
        if account_id not in {account.id for account in current_staff.accounts}:
            return jsonify({'error': 'Missing access to the requested account'}), 403
        query = query.filter_by(account_group_id=account_id)
    shifts = query.order_by(Shift.start_time).limit(200).all()
    return jsonify([serialize_shift(shift) for shift in shifts])


@roles_bp.route('/roles', methods=['GET'])
@require_auth
@require_permission('MANAGE_ROLES')
def list_roles(*, current_staff):
    ensure_default_permissions()
    roles = (
        AccessRole.query.options(
            joinedload(AccessRole.permissions),
            joinedload(AccessRole.shifts),
        )
        .order_by(AccessRole.level, func.lower(AccessRole.name))
        .all()
    )
    return jsonify([serialize_role(role) for role in roles])


@roles_bp.route('/roles', methods=['POST'])
@require_auth
@require_permission('MANAGE_ROLES')
def create_role(*, current_staff):
    ensure_default_permissions()
    payload = request.json or {}
    name = (payload.get('name') or '').strip()
    description = (payload.get('description') or '').strip() or None
    raw_level = payload.get('level')
    permission_codes = payload.get('permissionCodes') or []
    shift_ids = payload.get('shiftIds') or payload.get('shift_ids') or []

    if not name:
        return jsonify({'error': 'name is required.'}), 400
    try:
        level = int(raw_level)
    except (TypeError, ValueError):
        return jsonify({'error': 'level must be an integer.'}), 400

    existing = AccessRole.query.filter(func.lower(AccessRole.name) == name.lower()).first()
    if existing:
        return jsonify({'error': 'A role with this name already exists.'}), 400

    permissions, missing = resolve_permissions(permission_codes)
    if missing:
        return jsonify({'error': f'Unknown permission codes: {", ".join(missing)}'}), 400

    role = AccessRole(name=name, description=description, level=level)
    role.permissions = permissions

    if shift_ids:
        shifts = Shift.query.filter(Shift.id.in_(shift_ids)).all()
        if len(shifts) != len(set(shift_ids)):
            return jsonify({'error': 'One or more shifts were not found.'}), 400
        role.shifts = shifts

    db.session.add(role)
    db.session.commit()
    return jsonify(serialize_role(role)), 201


@roles_bp.route('/roles/<role_id>', methods=['PUT'])
@require_auth
@require_permission('MANAGE_ROLES')
def update_role(role_id: str, *, current_staff):
    ensure_default_permissions()
    payload = request.json or {}
    role = (
        AccessRole.query.options(
            joinedload(AccessRole.permissions),
            joinedload(AccessRole.shifts),
        )
        .filter_by(id=role_id)
        .first_or_404()
    )

    if 'name' in payload:
        new_name = (payload.get('name') or '').strip()
        if not new_name:
            return jsonify({'error': 'name cannot be empty.'}), 400
        existing = (
            AccessRole.query.filter(func.lower(AccessRole.name) == new_name.lower(), AccessRole.id != role_id).first()
        )
        if existing:
            return jsonify({'error': 'A role with this name already exists.'}), 400
        role.name = new_name

    if 'description' in payload:
        role.description = (payload.get('description') or '').strip() or None

    if 'level' in payload:
        try:
            role.level = int(payload.get('level'))
        except (TypeError, ValueError):
            return jsonify({'error': 'level must be an integer.'}), 400

    if 'permissionCodes' in payload:
        permissions, missing = resolve_permissions(payload.get('permissionCodes') or [])
        if missing:
            return jsonify({'error': f'Unknown permission codes: {", ".join(missing)}'}), 400
        role.permissions = permissions

    if 'shiftIds' in payload or 'shift_ids' in payload:
        shift_ids = payload.get('shiftIds') or payload.get('shift_ids') or []
        if shift_ids:
            shifts = Shift.query.filter(Shift.id.in_(shift_ids)).all()
            if len(shifts) != len(set(shift_ids)):
                return jsonify({'error': 'One or more shifts were not found.'}), 400
            role.shifts = shifts
        else:
            role.shifts = []

    db.session.commit()
    return jsonify(serialize_role(role))


@roles_bp.route('/roles/<role_id>', methods=['DELETE'])
@require_auth
@require_permission('MANAGE_ROLES')
def delete_role(role_id: str, *, current_staff):
    role = AccessRole.query.filter_by(id=role_id).first_or_404()
    in_use = UserRole.query.filter_by(role_id=role_id).first()
    if in_use:
        return jsonify({'error': 'Role is assigned to a user and cannot be removed.'}), 400
    db.session.delete(role)
    db.session.commit()
    return jsonify({'deleted': role_id})


@roles_bp.route('/me/permissions', methods=['GET'])
@require_auth
def me_permissions(*, current_staff):
    ensure_default_permissions()
    assignments = (
        UserRole.query.options(
            joinedload(UserRole.role).joinedload(AccessRole.permissions),
            joinedload(UserRole.role).joinedload(AccessRole.shifts),
            joinedload(UserRole.shifts),
        )
        .filter_by(staff_id=current_staff.id)
        .all()
    )
    return (
        jsonify(
            {
                'staffId': current_staff.id,
                'effectivePermissions': sorted(get_effective_permissions_for_user(current_staff)),
                'roles': [
                    {
                        'assignmentId': assignment.id,
                        'role': serialize_role(assignment.role),
                        'shiftScopes': [
                            serialize_shift(shift) for shift in (assignment.shifts or assignment.role.shifts or [])
                        ],
                    }
                    for assignment in assignments
                ],
            }
        ),
        200,
    )

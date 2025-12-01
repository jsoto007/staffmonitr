from __future__ import annotations

from datetime import datetime
from typing import Iterable, Sequence

from sqlalchemy.orm import joinedload

from ..database import db
from ..roles import Role
from ..models import AccessRole, Permission, ShiftTemplate, StaffMember, UserRole

DEFAULT_PERMISSIONS: list[dict[str, str]] = [
    {'code': 'VIEW_OWN_SCHEDULE', 'description': 'View their own assigned shifts or schedules.'},
    {'code': 'VIEW_ALL_SCHEDULES', 'description': 'View schedules for all staff across shifts.'},
    {'code': 'EDIT_STAFF_MATRIX', 'description': 'Edit staff matrix assignments.'},
    {'code': 'MANAGE_ROLES', 'description': 'Create and manage access roles and permissions.'},
    {'code': 'VIEW_INCIDENT_REPORTS', 'description': 'View incident reports.'},
]

LEGACY_PERMISSION_BRIDGE: dict[str, set[str]] = {
    Role.OWNER_ADMIN.value: {'VIEW_OWN_SCHEDULE', 'VIEW_ALL_SCHEDULES', 'EDIT_STAFF_MATRIX', 'MANAGE_ROLES'},
    Role.ADMIN.value: {'VIEW_OWN_SCHEDULE', 'VIEW_ALL_SCHEDULES', 'EDIT_STAFF_MATRIX', 'MANAGE_ROLES'},
    Role.DIRECTOR.value: {'VIEW_ALL_SCHEDULES', 'EDIT_STAFF_MATRIX'},
    Role.LEAD.value: {'VIEW_ALL_SCHEDULES', 'EDIT_STAFF_MATRIX'},
    Role.ASSISTANT_PROGRAM_DIRECTOR.value: {'VIEW_ALL_SCHEDULES', 'EDIT_STAFF_MATRIX', 'MANAGE_ROLES'},
}


def _legacy_permissions_for_staff(staff: StaffMember | None) -> set[str]:
    """Fallback permissions based on the legacy string-based role field."""
    if not staff:
        return set()
    defaults = {'VIEW_OWN_SCHEDULE'}
    defaults.update(LEGACY_PERMISSION_BRIDGE.get(staff.role, set()))
    return defaults


def ensure_default_permissions() -> list[Permission]:
    """Insert baseline permission codes so lookups succeed even on empty databases."""
    existing = {permission.code: permission for permission in Permission.query.all()}
    created: list[Permission] = []
    for entry in DEFAULT_PERMISSIONS:
        if entry['code'] in existing:
            continue
        permission = Permission(code=entry['code'], description=entry.get('description'))
        db.session.add(permission)
        created.append(permission)
    if created:
        db.session.commit()
        existing.update({permission.code: permission for permission in created})
    return list(existing.values())


def _permissions_by_code(codes: Iterable[str]) -> dict[str, Permission]:
    normalized = [code.strip() for code in codes if code]
    if not normalized:
        return {}
    records = Permission.query.filter(Permission.code.in_(normalized)).all()
    return {permission.code: permission for permission in records}


def resolve_permissions(codes: Sequence[str]) -> tuple[list[Permission], list[str]]:
    """Return Permission rows for the given codes and any missing codes for validation."""
    by_code = _permissions_by_code(codes)
    missing = [code for code in codes if code not in by_code]
    return list(by_code.values()), missing


def _normalize_role_name(name: str) -> str:
    """Normalize role names to compare user-friendly values and legacy enum values."""
    return ''.join(name.replace('_', ' ').lower().split())


def find_access_role_by_name(name: str) -> AccessRole | None:
    """Lookup an AccessRole by name, ignoring underscores/casing/spacing."""
    normalized_target = _normalize_role_name(name)
    roles = AccessRole.query.all()
    for role in roles:
        if _normalize_role_name(role.name) == normalized_target:
            return role
    return None


def get_effective_permissions_for_role(role: AccessRole) -> set[str]:
    """Return explicit + inherited permission codes for a role based on level ordering."""
    if role is None:
        return set()
    explicit = {permission.code for permission in role.permissions}
    inherited: set[str] = set()
    lower_roles = AccessRole.query.options(joinedload(AccessRole.permissions)).filter(AccessRole.level > role.level).all()
    for lower in lower_roles:
        inherited.update(permission.code for permission in lower.permissions)
    return explicit | inherited


def get_effective_permissions_for_user(staff: StaffMember) -> set[str]:
    """Combine effective permissions across all roles assigned to a user."""
    assignments = (
        UserRole.query.options(
            joinedload(UserRole.role).joinedload(AccessRole.permissions),
            joinedload(UserRole.role).joinedload(AccessRole.shift_templates),
            joinedload(UserRole.shift_templates),
        )
        .filter_by(staff_id=staff.id)
        .all()
    )
    permission_codes: set[str] = set()
    for assignment in assignments:
        permission_codes.update(get_effective_permissions_for_role(assignment.role))
    permission_codes.update(_legacy_permissions_for_staff(staff))
    return permission_codes


def user_has_permission(staff: StaffMember, permission_code: str) -> bool:
    return permission_code in get_effective_permissions_for_user(staff)


def can_edit_staff_matrix(staff: StaffMember, target_shift_id: str | None, timestamp: datetime | None = None) -> bool:
    """
    Check whether a user can edit the staff matrix for a given shift and optional timestamp.
    Users with the highest level (level <= 1) or unrestricted shift scopes can edit any shift.
    """
    if not user_has_permission(staff, 'EDIT_STAFF_MATRIX'):
        return False

    assignments = (
        UserRole.query.options(
            joinedload(UserRole.role).joinedload(AccessRole.shift_templates),
            joinedload(UserRole.shift_templates),
        )
        .filter_by(staff_id=staff.id)
        .all()
    )
    if not assignments:
        return False

    top_level = min((assignment.role.level for assignment in assignments if assignment.role), default=99)
    if top_level <= 1:
        return True

    if not target_shift_id:
        return True

    # Prefer user-level shift scopes; fall back to role-level scopes.
    for assignment in assignments:
        shift_pool = assignment.shift_templates or assignment.role.shift_templates
        if not shift_pool:
            return True
        for shift in shift_pool:
            if shift.id != target_shift_id:
                continue
            return True
    return False


def serialize_permission(permission: Permission) -> dict:
    return {
        'id': permission.id,
        'code': permission.code,
        'description': permission.description,
    }


def serialize_shift_template(shift: ShiftTemplate) -> dict:
    def _fmt(minutes: int | None) -> str | None:
        if minutes is None:
            return None
        hours = minutes // 60
        mins = minutes % 60
        return f"{hours:02d}:{mins:02d}"

    return {
        'id': shift.id,
        'name': shift.label,
        'start_time': _fmt(shift.start_minute),
        'end_time': _fmt(shift.end_minute),
        'site': None,
    }


def serialize_role(role: AccessRole, include_effective: bool = True) -> dict:
    return {
        'id': role.id,
        'name': role.name,
        'description': role.description,
        'level': role.level,
        'permissions': [serialize_permission(permission) for permission in role.permissions],
        'permissionCodes': [permission.code for permission in role.permissions],
        'effectivePermissions': sorted(get_effective_permissions_for_role(role)) if include_effective else None,
        'shifts': [serialize_shift_template(shift) for shift in role.shift_templates],
    }

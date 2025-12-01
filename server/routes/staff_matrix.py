from collections import defaultdict
from datetime import date, datetime, timedelta
from typing import Optional

from flask import Blueprint, jsonify, request
from sqlalchemy.orm import joinedload

from ..database import db
from ..models import (
    AccountGroup,
    AccessRole,
    PermanentScheduleTemplate,
    ScheduleOverride,
    StaffMember,
    StaffScheduleAssignment,
    SupplementalShift,
    ShiftTemplate,
    UserRole,
    STAFF_MATRIX_DAY_KEYS,
)
from ..services.role_service import (
    ensure_default_permissions,
    find_access_role_by_name,
    resolve_permissions,
    serialize_role as serialize_access_role,
)
from ..utils.auth_helpers import require_auth, require_role

staff_matrix_bp = Blueprint('staff_matrix', __name__)

ALLOWED_OVERRIDE_TYPES = {'day_off', 'vacation', 'personal'}
MINUTES_PER_DAY = 24 * 60
VALID_SHIFT_TYPES = {'Morning', 'Evening', 'Night'}
DEFAULT_CALENDAR_RANGE_DAYS = 28
MAX_CALENDAR_RANGE_DAYS = 90
YOUTH_CARE_WORKER_ROLE = 'Youth Care Worker'
YOUTH_CARE_WORKER_ROLE_NORMALIZED = YOUTH_CARE_WORKER_ROLE.casefold()


def _format_minutes(minutes: int) -> str:
    hours = minutes // 60
    mins = minutes % 60
    return f"{hours:02d}:{mins:02d}"


def _parse_time(value: Optional[str], field_name: str) -> int:
    if not isinstance(value, str):
        raise ValueError(f'{field_name} must be a HH:MM string.')
    parts = value.split(':')
    if len(parts) != 2:
        raise ValueError(f'{field_name} must include hours and minutes.')
    hours, minutes = parts
    if not hours.isdigit() or not minutes.isdigit():
        raise ValueError(f'{field_name} must contain numeric values.')
    parsed_hours = int(hours)
    parsed_minutes = int(minutes)
    if not (0 <= parsed_hours < 24) or not (0 <= parsed_minutes < 60):
        raise ValueError(f'{field_name} must be between 00:00 and 23:59.')
    return parsed_hours * 60 + parsed_minutes


def _parse_date(value: Optional[str]) -> datetime.date:
    if not isinstance(value, str):
        raise ValueError('date must be an ISO YYYY-MM-DD string.')
    return datetime.strptime(value, '%Y-%m-%d').date()


def _normalize_shift_type(value: Optional[str]) -> str | None:
    if not value:
        return None
    normalized = value.strip().title()
    if normalized not in VALID_SHIFT_TYPES:
        raise ValueError(f'shift_type must be one of {", ".join(sorted(VALID_SHIFT_TYPES))}.')
    return normalized


def _is_youth_care_worker_role(role: str | None) -> bool:
    if not isinstance(role, str):
        return False
    return role.strip().casefold() == YOUTH_CARE_WORKER_ROLE_NORMALIZED


def _weekday_key_for_date(target_date: date) -> str:
    return STAFF_MATRIX_DAY_KEYS[(target_date.weekday() + 1) % 7]


def _iterate_date_range(start_date: date, end_date: date):
    current = start_date
    while current <= end_date:
        yield current
        current += timedelta(days=1)


def _derive_shift_type(role: str | None, start_minute: int, end_minute: int) -> str | None:
    if not _is_youth_care_worker_role(role):
        return None
    if start_minute == 480 and end_minute == 960:
        return 'Morning'
    if start_minute == 960 and end_minute == 0:
        return 'Evening'
    if start_minute == 0 and end_minute == 480:
        return 'Night'
    return None


def _gather_assignments(account_id: str):
    query = StaffScheduleAssignment.query.options(joinedload(StaffScheduleAssignment.staff)).filter_by(
        account_group_id=account_id
    )
    assignments: dict[str, list[StaffScheduleAssignment]] = defaultdict(list)
    for assignment in query:
        assignments[assignment.template_id].append(assignment)
    return assignments


def _serialize_role(role: AccessRole) -> dict:
    # Reuse the access-role serializer to surface permissions/levels to the UI.
    return serialize_access_role(role)


def _normalize_weekly_pattern(payload: Optional[dict]) -> dict[str, list[dict[str, int]]]:
    if payload is None:
        payload = {}
    if not isinstance(payload, dict):
        raise ValueError('weekly_pattern must be an object keyed by day codes.')
    normalized: dict[str, list[dict[str, int]]] = {}
    for day in STAFF_MATRIX_DAY_KEYS:
        entries = payload.get(day, [])
        if entries is None:
            normalized[day] = []
            continue
        if not isinstance(entries, list):
            raise ValueError(f'weekly_pattern[{day}] must be an array.')
        rows: list[dict[str, int]] = []
        for entry in entries:
            if not isinstance(entry, dict):
                raise ValueError(f'weekly_pattern[{day}] entries must be objects.')
            start_raw = entry.get('start_time')
            end_raw = entry.get('end_time')
            if not start_raw or not end_raw:
                continue
            start = _parse_time(start_raw, f'{day} start_time')
            end = _parse_time(end_raw, f'{day} end_time')
            span = end - start if end > start else MINUTES_PER_DAY - start + end
            if span <= 0:
                raise ValueError(f'{day} end_time must be after start_time.')
            rows.append({'start_minute': start, 'end_minute': end})
        normalized[day] = rows
    return normalized


@staff_matrix_bp.route('/accounts/<account_id>/staff-matrix/calendar', methods=['GET'])
@require_auth
@require_role('Owner_admin', 'Admin')
def get_staff_matrix_calendar(account_id: str, *, current_staff):
    account = _authorize_account(account_id, current_staff)
    if not account:
        return jsonify({'error': 'Missing access to the requested account'}), 403

    try:
        start_date = _parse_date(request.args.get('start_date')) if request.args.get('start_date') else datetime.utcnow().date()
    except ValueError as exc:
        return jsonify({'error': str(exc)}), 400
    try:
        end_date = _parse_date(request.args.get('end_date')) if request.args.get('end_date') else start_date + timedelta(days=DEFAULT_CALENDAR_RANGE_DAYS - 1)
    except ValueError as exc:
        return jsonify({'error': str(exc)}), 400

    if end_date < start_date:
        return jsonify({'error': 'end_date must be on or after start_date'}), 400
    total_days = (end_date - start_date).days + 1
    if total_days > MAX_CALENDAR_RANGE_DAYS:
        return jsonify({'error': f'Date range cannot exceed {MAX_CALENDAR_RANGE_DAYS} days.'}), 400

    templates = PermanentScheduleTemplate.query.filter_by(account_group_id=account_id).all()
    assignment_map = _gather_assignments(account_id)
    entries_by_date: dict[str, list[dict]] = defaultdict(list)

    for current_date in _iterate_date_range(start_date, end_date):
        day_key = _weekday_key_for_date(current_date)
        for template in templates:
            segments = (template.weekly_pattern or {}).get(day_key) or []
            for index, segment in enumerate(segments):
                start_minute = segment['start_minute']
                end_minute = segment['end_minute']
                entry_id = f'{template.id}-{current_date.isoformat()}-{index}'
                assignment_for_day = next(
                    (
                        assignment
                        for assignment in assignment_map.get(template.id, [])
                        if (not assignment.start_date or assignment.start_date <= current_date)
                        and (not assignment.end_date or assignment.end_date >= current_date)
                    ),
                    None,
                )
                staff_member = assignment_for_day.staff if assignment_for_day else None
                entries_by_date[current_date.isoformat()].append(
                    {
                        'id': entry_id,
                        'template_id': template.id,
                        'template_label': template.label,
                        'template_role': template.role,
                        'template_color': template.color,
                        'template_notes': template.notes,
                        'date': current_date.isoformat(),
                        'start_time': _format_minutes(start_minute),
                        'end_time': _format_minutes(end_minute),
                        'start_minute': start_minute,
                        'end_minute': end_minute,
                        'shift_type': template.shift_type or _derive_shift_type(template.role, start_minute, end_minute),
                        'assignment_id': assignment_for_day.id if assignment_for_day else None,
                        'staff_id': staff_member.id if staff_member else None,
                        'staff_name': staff_member.full_name if staff_member else None,
                        'staff_role': staff_member.role if staff_member else None,
                        'is_open': not bool(staff_member),
                    }
                )

    return jsonify(
        {
            'start_date': start_date.isoformat(),
            'end_date': end_date.isoformat(),
            'entries': [
                entry
                for day in sorted(entries_by_date)
                for entry in sorted(entries_by_date[day], key=lambda item: item['start_minute'])
            ],
        },
    )


def _serialize_weekly_pattern(pattern: Optional[dict]) -> dict[str, list[dict[str, str]]]:
    if not pattern:
        return {day: [] for day in STAFF_MATRIX_DAY_KEYS}
    serialized: dict[str, list[dict[str, str]]] = {}
    for day in STAFF_MATRIX_DAY_KEYS:
        entries = pattern.get(day) or []
        serialized[day] = [
            {'start_time': _format_minutes(segment['start_minute']), 'end_time': _format_minutes(segment['end_minute'])}
            for segment in entries
        ]
    return serialized


def _authorize_account(account_id: str, current_staff: StaffMember) -> Optional[AccountGroup]:
    account = AccountGroup.query.get_or_404(account_id)
    if account not in current_staff.accounts:
        return None
    return account


def _serialize_template(template: PermanentScheduleTemplate) -> dict:
    return {
        'id': template.id,
        'label': template.label,
        'role': template.role,
        'color': template.color,
        'notes': template.notes,
        'weekly_pattern': _serialize_weekly_pattern(template.weekly_pattern),
        'shift_type': template.shift_type,
    }


def _serialize_assignment(assignment: StaffScheduleAssignment) -> dict:
    return {
        'id': assignment.id,
        'template_id': assignment.template_id,
        'staff_id': assignment.staff_id,
        'staff_name': assignment.staff.full_name,
        'staff_role': assignment.staff.role,
        'start_date': assignment.start_date.isoformat() if assignment.start_date else None,
        'end_date': assignment.end_date.isoformat() if assignment.end_date else None,
    }


def _serialize_override(override: ScheduleOverride) -> dict:
    return {
        'id': override.id,
        'staff_id': override.staff_id,
        'staff_name': override.staff.full_name,
        'date': override.date.isoformat(),
        'type': override.override_type,
        'reason': override.reason,
    }


def _serialize_supplemental(shift: SupplementalShift) -> dict:
    return {
        'id': shift.id,
        'staff_id': shift.staff_id,
        'staff_name': shift.staff.full_name,
        'date': shift.date.isoformat(),
        'label': shift.label,
        'start_time': _format_minutes(shift.start_minute),
        'end_time': _format_minutes(shift.end_minute),
        'is_overtime': shift.is_overtime,
        'notes': shift.notes,
    }


@staff_matrix_bp.route('/accounts/<account_id>/staff-matrix', methods=['GET'])
@require_auth
@require_role('Owner_admin', 'Admin')
def get_staff_matrix(account_id: str, *, current_staff):
    account = _authorize_account(account_id, current_staff)
    if not account:
        return jsonify({'error': 'Missing access to the requested account'}), 403

    templates = PermanentScheduleTemplate.query.filter_by(account_group_id=account_id).all()
    assignments = StaffScheduleAssignment.query.filter_by(account_group_id=account_id).all()
    overrides = ScheduleOverride.query.filter_by(account_group_id=account_id).all()
    extras = SupplementalShift.query.filter_by(account_group_id=account_id).all()
    roles = AccessRole.query.options(joinedload(AccessRole.permissions), joinedload(AccessRole.shift_templates)).all()

    return jsonify(
        {
            'templates': [_serialize_template(template) for template in templates],
            'assignments': [_serialize_assignment(assignment) for assignment in assignments],
            'overrides': [_serialize_override(override) for override in overrides],
            'additional_shifts': [_serialize_supplemental(shift) for shift in extras],
            'roles': [_serialize_role(role) for role in roles],
        },
    )


@staff_matrix_bp.route('/accounts/<account_id>/staff-matrix/roles', methods=['GET'])
@require_auth
@require_role('Owner_admin', 'Admin')
def list_roles(account_id: str, *, current_staff):
    account = _authorize_account(account_id, current_staff)
    if not account:
        return jsonify({'error': 'Missing access to the requested account'}), 403

    roles = AccessRole.query.options(joinedload(AccessRole.permissions), joinedload(AccessRole.shift_templates)).all()
    return jsonify([_serialize_role(role) for role in roles])


@staff_matrix_bp.route('/accounts/<account_id>/staff-matrix/roles', methods=['POST'])
@require_auth
@require_role('Owner_admin', 'Admin')
def create_role(account_id: str, *, current_staff):
    account = _authorize_account(account_id, current_staff)
    if not account:
        return jsonify({'error': 'Missing access to the requested account'}), 403

    payload = request.json or {}
    ensure_default_permissions()

    name = (payload.get('name') or '').strip()
    description = (payload.get('description') or '').strip() or None
    raw_level = payload.get('level', 3)
    permission_codes = payload.get('permissionCodes') or []
    shift_ids = payload.get('shiftIds') or payload.get('shift_ids') or []

    if not name:
        return jsonify({'error': 'Role name is required.'}), 400
    try:
        level = int(raw_level)
    except (TypeError, ValueError):
        return jsonify({'error': 'level must be an integer.'}), 400

    existing = find_access_role_by_name(name)
    if existing:
        return jsonify({'error': 'A role with this name already exists.'}), 400

    permissions, missing = resolve_permissions(permission_codes)
    if missing:
        return jsonify({'error': f'Unknown permission codes: {", ".join(missing)}'}), 400

    role = AccessRole(name=name, description=description, level=level)
    role.permissions = permissions

    if shift_ids:
        shift_templates = ShiftTemplate.query.filter(ShiftTemplate.id.in_(shift_ids)).all()
        if len(shift_templates) != len(set(shift_ids)):
            return jsonify({'error': 'One or more shifts were not found.'}), 400
        role.shift_templates = shift_templates

    db.session.add(role)
    db.session.commit()
    return jsonify(_serialize_role(role)), 201


@staff_matrix_bp.route('/accounts/<account_id>/staff-matrix/roles/<role_id>', methods=['PATCH'])
@require_auth
@require_role('Owner_admin', 'Admin')
def update_role(account_id: str, role_id: str, *, current_staff):
    account = _authorize_account(account_id, current_staff)
    if not account:
        return jsonify({'error': 'Missing access to the requested account'}), 403

    role = AccessRole.query.options(joinedload(AccessRole.permissions), joinedload(AccessRole.shift_templates)).filter_by(
        id=role_id
    ).first_or_404()
    payload = request.json or {}

    if 'name' in payload:
        new_name = (payload.get('name') or '').strip()
        if not new_name:
            return jsonify({'error': 'Role name cannot be empty.'}), 400
        existing = find_access_role_by_name(new_name)
        if existing and existing.id != role_id:
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
            shift_templates = ShiftTemplate.query.filter(ShiftTemplate.id.in_(shift_ids)).all()
            if len(shift_templates) != len(set(shift_ids)):
                return jsonify({'error': 'One or more shifts were not found.'}), 400
            role.shift_templates = shift_templates
        else:
            role.shift_templates = []

    db.session.commit()
    return jsonify(_serialize_role(role))


@staff_matrix_bp.route('/accounts/<account_id>/staff-matrix/roles/<role_id>', methods=['DELETE'])
@require_auth
@require_role('Owner_admin', 'Admin')
def delete_role(account_id: str, role_id: str, *, current_staff):
    account = _authorize_account(account_id, current_staff)
    if not account:
        return jsonify({'error': 'Missing access to the requested account'}), 403

    role = AccessRole.query.filter_by(id=role_id).first_or_404()

    in_use_template = PermanentScheduleTemplate.query.filter_by(role=role.name).first()
    if in_use_template:
        return jsonify({'error': 'Role is currently used by a schedule and cannot be removed.'}), 400

    in_use_assignment = UserRole.query.filter_by(role_id=role_id).first()
    if in_use_assignment:
        return jsonify({'error': 'Role is assigned to a user and cannot be removed.'}), 400

    db.session.delete(role)
    db.session.commit()
    return jsonify({'deleted': role_id})


@staff_matrix_bp.route('/accounts/<account_id>/staff-matrix/templates', methods=['POST'])
@require_auth
@require_role('Owner_admin', 'Admin')
def create_template(account_id: str, *, current_staff):
    account = _authorize_account(account_id, current_staff)
    if not account:
        return jsonify({'error': 'Missing access to the requested account'}), 403

    payload = request.json or {}
    label = (payload.get('label') or '').strip()
    role = (payload.get('role') or '').strip()
    if not label:
        return jsonify({'error': 'Template label is required.'}), 400
    if not role:
        return jsonify({'error': 'Template role is required.'}), 400
    if not find_access_role_by_name(role):
        return jsonify({'error': 'Template role must match an existing access role created via + Create role.'}), 400

    try:
        pattern = _normalize_weekly_pattern(payload.get('weekly_pattern'))
    except ValueError as exc:
        return jsonify({'error': str(exc)}), 400

    shift_type = None
    raw_shift_type = payload.get('shift_type')
    if raw_shift_type:
        try:
            normalized = _normalize_shift_type(raw_shift_type)
        except ValueError as exc:
            return jsonify({'error': str(exc)}), 400
        if _is_youth_care_worker_role(role):
            shift_type = normalized

    template = PermanentScheduleTemplate(
        account_group_id=account_id,
        label=label,
        role=role,
        shift_type=shift_type,
        color=payload.get('color'),
        notes=payload.get('notes'),
        weekly_pattern=pattern,
    )
    db.session.add(template)
    db.session.commit()

    return jsonify(_serialize_template(template)), 201


@staff_matrix_bp.route('/accounts/<account_id>/staff-matrix/templates/<template_id>', methods=['PATCH'])
@require_auth
@require_role('Owner_admin', 'Admin')
def update_template(account_id: str, template_id: str, *, current_staff):
    account = _authorize_account(account_id, current_staff)
    if not account:
        return jsonify({'error': 'Missing access to the requested account'}), 403

    template = PermanentScheduleTemplate.query.filter_by(id=template_id, account_group_id=account_id).first_or_404()
    payload = request.json or {}

    label = payload.get('label')
    role = payload.get('role')
    if label is not None:
        template.label = label.strip() or template.label
    if role is not None and role.strip():
        template.role = role.strip()
        if not find_access_role_by_name(template.role):
            return jsonify({'error': 'Template role must match an existing access role.'}), 400
        if not _is_youth_care_worker_role(template.role):
            template.shift_type = None

    if 'weekly_pattern' in payload:
        try:
            template.weekly_pattern = _normalize_weekly_pattern(payload.get('weekly_pattern'))
        except ValueError as exc:
            return jsonify({'error': str(exc)}), 400

    if 'color' in payload:
        template.color = payload.get('color')
    if 'notes' in payload:
        template.notes = payload.get('notes')
    if 'shift_type' in payload:
        raw_shift_type = payload.get('shift_type')
        try:
            normalized = _normalize_shift_type(raw_shift_type)
        except ValueError as exc:
            return jsonify({'error': str(exc)}), 400
        template.shift_type = normalized if _is_youth_care_worker_role(template.role) else None

    db.session.commit()
    return jsonify(_serialize_template(template))


@staff_matrix_bp.route('/accounts/<account_id>/staff-matrix/templates/<template_id>', methods=['DELETE'])
@require_auth
@require_role('Owner_admin', 'Admin')
def delete_template(account_id: str, template_id: str, *, current_staff):
    account = _authorize_account(account_id, current_staff)
    if not account:
        return jsonify({'error': 'Missing access to the requested account'}), 403

    template = PermanentScheduleTemplate.query.filter_by(id=template_id, account_group_id=account_id).first_or_404()
    db.session.delete(template)
    db.session.commit()
    return jsonify({'deleted': template_id})


@staff_matrix_bp.route('/accounts/<account_id>/staff-matrix/templates/<template_id>/assignments', methods=['POST'])
@require_auth
@require_role('Owner_admin', 'Admin')
def assign_staff_to_template(account_id: str, template_id: str, *, current_staff):
    account = _authorize_account(account_id, current_staff)
    if not account:
        return jsonify({'error': 'Missing access to the requested account'}), 403

    template = PermanentScheduleTemplate.query.filter_by(id=template_id, account_group_id=account_id).first_or_404()
    access_role = find_access_role_by_name(template.role)
    if not access_role:
        return jsonify({'error': 'Template role must match an existing access role.'}), 400
    payload = request.json or {}
    staff_id = payload.get('staff_id')
    if not staff_id:
        return jsonify({'error': 'staff_id is required.'}), 400

    staff = StaffMember.query.get_or_404(staff_id)
    if account not in staff.accounts:
        return jsonify({'error': 'Staff member must belong to the target account.'}), 400

    start_date = payload.get('start_date')
    end_date = payload.get('end_date')
    try:
        parsed_start = _parse_date(start_date) if start_date else None
        parsed_end = _parse_date(end_date) if end_date else None
    except ValueError as exc:
        return jsonify({'error': str(exc)}), 400

    assignment = StaffScheduleAssignment(
        account_group_id=account_id,
        template_id=template.id,
        staff_id=staff_id,
        start_date=parsed_start,
        end_date=parsed_end,
    )
    # Keep staff profile + access bindings in sync with the assigned schedule role.
    staff.role = access_role.name
    UserRole.query.filter_by(staff_id=staff_id).delete()
    db.session.add(UserRole(staff_id=staff_id, role_id=access_role.id))

    db.session.add(assignment)
    db.session.commit()
    return jsonify(_serialize_assignment(assignment)), 201


@staff_matrix_bp.route('/accounts/<account_id>/staff-matrix/assignments/<assignment_id>', methods=['DELETE'])
@require_auth
@require_role('Owner_admin', 'Admin')
def unassign_staff(account_id: str, assignment_id: str, *, current_staff):
    account = _authorize_account(account_id, current_staff)
    if not account:
        return jsonify({'error': 'Missing access to the requested account'}), 403

    assignment = StaffScheduleAssignment.query.filter_by(id=assignment_id, account_group_id=account_id).first_or_404()
    db.session.delete(assignment)
    db.session.commit()
    return jsonify({'deleted': assignment_id})


@staff_matrix_bp.route('/accounts/<account_id>/staff-matrix/overrides', methods=['POST'])
@require_auth
@require_role('Owner_admin', 'Admin')
def add_override(account_id: str, *, current_staff):
    account = _authorize_account(account_id, current_staff)
    if not account:
        return jsonify({'error': 'Missing access to the requested account'}), 403

    payload = request.json or {}
    staff_id = payload.get('staff_id')
    if not staff_id:
        return jsonify({'error': 'staff_id is required.'}), 400
    staff = StaffMember.query.get_or_404(staff_id)
    if account not in staff.accounts:
        return jsonify({'error': 'Staff member must belong to the target account.'}), 400

    override_type = (payload.get('type') or 'day_off').strip().lower()
    if override_type not in ALLOWED_OVERRIDE_TYPES:
        return jsonify({'error': f'type must be one of {", ".join(ALLOWED_OVERRIDE_TYPES)}'}), 400
    try:
        override_date = _parse_date(payload.get('date'))
    except ValueError as exc:
        return jsonify({'error': str(exc)}), 400

    existing = ScheduleOverride.query.filter_by(
        account_group_id=account_id,
        staff_id=staff_id,
        date=override_date,
        override_type=override_type,
    ).first()
    if existing:
        return jsonify({'error': 'An override for that day already exists.'}), 400

    template_id = payload.get('template_id')
    if template_id:
        template_exists = PermanentScheduleTemplate.query.filter_by(id=template_id, account_group_id=account_id).first()
        if not template_exists:
            return jsonify({'error': 'template_id must belong to this account.'}), 400

    override = ScheduleOverride(
        account_group_id=account_id,
        staff_id=staff_id,
        date=override_date,
        override_type=override_type,
        reason=payload.get('reason'),
        template_id=template_id if template_id else None,
    )
    db.session.add(override)
    db.session.commit()
    return jsonify(_serialize_override(override)), 201


@staff_matrix_bp.route('/accounts/<account_id>/staff-matrix/overrides/<override_id>', methods=['DELETE'])
@require_auth
@require_role('Owner_admin', 'Admin')
def remove_override(account_id: str, override_id: str, *, current_staff):
    account = _authorize_account(account_id, current_staff)
    if not account:
        return jsonify({'error': 'Missing access to the requested account'}), 403

    override = ScheduleOverride.query.filter_by(id=override_id, account_group_id=account_id).first_or_404()
    db.session.delete(override)
    db.session.commit()
    return jsonify({'deleted': override_id})


@staff_matrix_bp.route('/accounts/<account_id>/staff-matrix/additional-shifts', methods=['POST'])
@require_auth
@require_role('Owner_admin', 'Admin')
def add_additional_shift(account_id: str, *, current_staff):
    account = _authorize_account(account_id, current_staff)
    if not account:
        return jsonify({'error': 'Missing access to the requested account'}), 403

    payload = request.json or {}
    staff_id = payload.get('staff_id')
    if not staff_id:
        return jsonify({'error': 'staff_id is required.'}), 400

    staff = StaffMember.query.get_or_404(staff_id)
    if account not in staff.accounts:
        return jsonify({'error': 'Staff member must belong to the target account.'}), 400

    try:
        shift_date = _parse_date(payload.get('date'))
        start_minute = _parse_time(payload.get('start_time'), 'start_time')
        end_minute = _parse_time(payload.get('end_time'), 'end_time')
    except ValueError as exc:
        return jsonify({'error': str(exc)}), 400
    if end_minute <= start_minute:
        return jsonify({'error': 'end_time must be after start_time.'}), 400

    label = (payload.get('label') or 'Additional shift').strip()
    shift = SupplementalShift(
        account_group_id=account_id,
        staff_id=staff_id,
        date=shift_date,
        label=label,
        start_minute=start_minute,
        end_minute=end_minute,
        is_overtime=bool(payload.get('is_overtime')),
        notes=payload.get('notes'),
    )
    db.session.add(shift)
    db.session.commit()
    return jsonify(_serialize_supplemental(shift)), 201


@staff_matrix_bp.route('/accounts/<account_id>/staff-matrix/additional-shifts/<shift_id>', methods=['DELETE'])
@require_auth
@require_role('Owner_admin', 'Admin')
def remove_additional_shift(account_id: str, shift_id: str, *, current_staff):
    account = _authorize_account(account_id, current_staff)
    if not account:
        return jsonify({'error': 'Missing access to the requested account'}), 403

    shift = SupplementalShift.query.filter_by(id=shift_id, account_group_id=account_id).first_or_404()
    db.session.delete(shift)
    db.session.commit()
    return jsonify({'deleted': shift_id})

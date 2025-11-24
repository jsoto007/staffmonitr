import uuid
from flask import Blueprint, jsonify, request

from ..database import db
from ..models import AccountGroup, ProjectionSettings, ShiftTemplate
from ..utils.auth_helpers import require_auth, require_role

projection_settings_bp = Blueprint('projection_settings', __name__)

ALLOWED_COVERAGE_MODES = {'full_24h', 'partial_coverage'}
DEFAULT_COVERAGE_MODE = 'partial_coverage'
ALLOWED_SHIFT_CATEGORIES = {'coverage', 'role'}
DAY_KEYS = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat']
DEFAULT_SHIFT_DAYS = DAY_KEYS[:]
VALID_DAY_SET = set(DAY_KEYS)
MINUTES_PER_DAY = 24 * 60


def _format_minutes(minutes: int) -> str:
    normalized = minutes % MINUTES_PER_DAY
    hours = normalized // 60
    mins = normalized % 60
    return f"{hours:02d}:{mins:02d}"


def _parse_time(value: str) -> int:
    if not isinstance(value, str):
        raise ValueError('Time values must be strings in HH:MM format.')
    parts = value.split(':')
    if len(parts) != 2:
        raise ValueError('Time values must include hours and minutes.')
    hours, minutes = parts
    if not hours.isdigit() or not minutes.isdigit():
        raise ValueError('Time values must be numeric.')
    parsed_hours = int(hours)
    parsed_minutes = int(minutes)
    if not (0 <= parsed_hours < 24) or not (0 <= parsed_minutes < 60):
        raise ValueError('Hours must be 0-23 and minutes 0-59.')
    return parsed_hours * 60 + parsed_minutes


def _serialize_shift(template: ShiftTemplate) -> dict:
    return {
        'id': template.id,
        'label': template.label,
        'start_time': _format_minutes(template.start_minute),
        'end_time': _format_minutes(template.end_minute),
        'color': template.color,
        'order': template.sort_order,
        'category': template.category or 'coverage',
        'role': template.role,
        'days': (template.days or '').split(',') if template.days else DEFAULT_SHIFT_DAYS,
    }


def _validate_shift_sequence(shifts: list[dict]) -> None:
    coverage_shifts = [shift for shift in shifts if shift.get('category', 'coverage') == 'coverage']
    if not coverage_shifts:
        return
    ordered = sorted(coverage_shifts, key=lambda payload: payload.get('order', 0))
    for shift in ordered:
        start = shift['start_minute']
        end = shift['end_minute']
        if not (0 <= start < MINUTES_PER_DAY) or not (0 <= end < MINUTES_PER_DAY):
            raise ValueError('Shift times must stay within a single day.')
        duration = end - start if end > start else end + MINUTES_PER_DAY - start
        if duration <= 0:
            raise ValueError('Each shift must cover at least one minute.')
    for current, next_shift in zip(ordered, ordered[1:]):
        if next_shift['start_minute'] != current['end_minute']:
            raise ValueError('Segments must connect directly—no gaps or overlaps for coverage shifts.')


def _get_projection_settings(account_id: str) -> ProjectionSettings:
    settings = ProjectionSettings.query.get(account_id)
    if not settings:
        settings = ProjectionSettings(account_group_id=account_id)
        db.session.add(settings)
        db.session.flush()
    return settings


def _build_shift_payload(raw: dict, index: int) -> dict:
    start_raw = raw.get('start_time')
    end_raw = raw.get('end_time')
    if start_raw is None or end_raw is None:
        raise ValueError('Each shift requires both start_time and end_time.')
    start_minute = _parse_time(start_raw)
    end_minute = _parse_time(end_raw)
    label = (raw.get('label') or f'Shift {index + 1}').strip() or f'Shift {index + 1}'
    color = raw.get('color')
    order = raw.get('order')
    if order is None:
        order = index
    category = (raw.get('category') or 'coverage').strip().lower()
    if category not in ALLOWED_SHIFT_CATEGORIES:
        raise ValueError(f"category must be one of {', '.join(ALLOWED_SHIFT_CATEGORIES)}")
    role = raw.get('role')
    days_list = _parse_days(raw.get('days'), category)
    if category == 'role' and not role:
        raise ValueError('Role-specific shifts require a role to be assigned.')
    return {
        'id': raw.get('id'),
        'label': label,
        'start_minute': start_minute,
        'end_minute': end_minute,
        'color': color,
        'order': order,
        'category': category,
        'role': role,
        'days': ','.join(days_list),
    }


def _parse_days(raw_days, category: str) -> list[str]:
    if raw_days is None:
        return DEFAULT_SHIFT_DAYS if category == 'coverage' else []
    if not isinstance(raw_days, list):
        raise ValueError('days must be an array of day codes.')
    normalized = []
    for entry in raw_days:
        if not isinstance(entry, str):
            raise ValueError('Day entries must be strings.')
        day_key = entry.strip().lower()
        if day_key not in VALID_DAY_SET:
            raise ValueError(f'Unsupported day code "{entry}". Use {", ".join(DAY_KEYS)}.')
        if day_key not in normalized:
            normalized.append(day_key)
    if category == 'role' and not normalized:
        raise ValueError('Role-specific shifts require at least one day.')
    return normalized if normalized else DEFAULT_SHIFT_DAYS


@projection_settings_bp.route('/accounts/<account_id>/projection-settings', methods=['GET'])
@require_auth
@require_role('Owner_admin', 'Admin')
def get_projection_settings(account_id: str, *, current_staff):
    account = AccountGroup.query.get_or_404(account_id)
    if account not in current_staff.accounts:
        return jsonify({'error': 'Missing access to the requested account'}), 403
    settings = ProjectionSettings.query.get(account_id)
    if not settings:
        return jsonify({'coverage_mode': DEFAULT_COVERAGE_MODE, 'shifts': []})
    return jsonify(
        {
            'coverage_mode': settings.coverage_mode,
            'shifts': [_serialize_shift(template) for template in settings.shift_templates],
        },
    )


@projection_settings_bp.route('/accounts/<account_id>/projection-settings', methods=['PUT'])
@require_auth
@require_role('Owner_admin', 'Admin')
def update_projection_settings(account_id: str, *, current_staff):
    account = AccountGroup.query.get_or_404(account_id)
    if account not in current_staff.accounts:
        return jsonify({'error': 'Missing access to the requested account'}), 403

    payload = request.json or {}
    coverage_mode = payload.get('coverage_mode') or DEFAULT_COVERAGE_MODE
    if coverage_mode not in ALLOWED_COVERAGE_MODES:
        return jsonify({'error': f"coverage_mode must be one of {', '.join(ALLOWED_COVERAGE_MODES)}"}), 400

    raw_shifts = payload.get('shifts') or []
    if not isinstance(raw_shifts, list):
        return jsonify({'error': 'shifts must be an array'}), 400

    parsed_shifts = []
    for index, raw_shift in enumerate(raw_shifts):
        try:
            parsed_shifts.append(_build_shift_payload(raw_shift, index))
        except ValueError as exc:
            return jsonify({'error': str(exc)}), 400

    try:
        _validate_shift_sequence(parsed_shifts)
    except ValueError as exc:
        return jsonify({'error': str(exc)}), 400

    settings = _get_projection_settings(account_id)
    settings.coverage_mode = coverage_mode

    existing_templates = {template.id: template for template in settings.shift_templates}
    kept_ids = set()

    for shift_spec in sorted(parsed_shifts, key=lambda spec: spec['order']):
        template = existing_templates.get(shift_spec.get('id'))
        if template is None:
            template = ShiftTemplate(
                id=shift_spec.get('id') or str(uuid.uuid4()),
                account_group_id=account_id,
            )
            db.session.add(template)
        template.label = shift_spec['label']
        template.start_minute = shift_spec['start_minute']
        template.end_minute = shift_spec['end_minute']
        template.color = shift_spec.get('color')
        template.sort_order = shift_spec['order']
        template.category = shift_spec.get('category', 'coverage')
        template.role = shift_spec.get('role')
        template.days = shift_spec.get('days') or ','.join(DEFAULT_SHIFT_DAYS)
        kept_ids.add(template.id)

    for template in settings.shift_templates:
        if template.id not in kept_ids:
            db.session.delete(template)

    db.session.commit()

    updated_settings = ProjectionSettings.query.get(account_id)
    return jsonify(
        {
            'coverage_mode': updated_settings.coverage_mode,
            'shifts': [_serialize_shift(template) for template in updated_settings.shift_templates],
        },
    )

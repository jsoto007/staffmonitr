import uuid
from flask import Blueprint, jsonify, request

from ..database import db
from ..models import AccountGroup, ShiftWindow
from ..utils.auth_helpers import require_auth, require_role

projection_settings_bp = Blueprint('projection_settings', __name__)


def _serialize_window(window: ShiftWindow) -> dict:
    return {
        'id': window.id,
        'account_group_id': window.account_group_id,
        'name': window.name,
        'start_minute': window.start_minute,
        'end_minute': window.end_minute,
        'order': window.sort_order,
    }


def _validate_sequence(windows: list[dict]) -> None:
    if not windows:
        raise ValueError('Provide at least one shift segment.')
    last_end = None
    for window in windows:
        start = window['start_minute']
        end = window['end_minute']
        if start < 0 or end > 1440:
            raise ValueError('Window times must stay within a single day.')
        if start >= end:
            raise ValueError('Start time must be before end time.')
        if last_end is not None and start != last_end:
            raise ValueError('Segments must connect without gaps or overlaps.')
        last_end = end


@projection_settings_bp.route('/shift-windows', methods=['GET'])
def list_shift_windows():
    account_id = request.args.get('account_id')
    if not account_id:
        return jsonify({'error': 'account_id is required'}), 400
    windows = (
        ShiftWindow.query.filter_by(account_group_id=account_id)
        .order_by(ShiftWindow.sort_order)
        .all()
    )
    return jsonify([_serialize_window(window) for window in windows])


@projection_settings_bp.route('/shift-windows', methods=['PUT'])
@require_auth
@require_role('Owner_admin', 'Admin')
def replace_shift_windows(*, current_staff):
    payload = request.json or {}
    account_id = payload.get('account_group_id')
    if not account_id:
        return jsonify({'error': 'account_group_id is required'}), 400
    account = AccountGroup.query.get_or_404(account_id)
    if account not in current_staff.accounts:
        return jsonify({'error': 'Missing access to the requested account'}), 403

    raw_windows = payload.get('windows') or []
    parsed = []
    for index, raw_window in enumerate(raw_windows):
        start = raw_window.get('start_minute')
        end = raw_window.get('end_minute')
        if start is None or end is None:
            return jsonify({'error': 'start_minute and end_minute are required for every segment'}), 400
        try:
            start_value = int(start)
            end_value = int(end)
        except (TypeError, ValueError):
            return jsonify({'error': 'start_minute and end_minute must be integers'}), 400
        parsed.append(
            {
                'id': raw_window.get('id'),
                'name': raw_window.get('name') or f'Shift {index + 1}',
                'start_minute': start_value,
                'end_minute': end_value,
                'sort_order': index,
            }
        )

    try:
        _validate_sequence(parsed)
    except ValueError as exc:
        return jsonify({'error': str(exc)}), 400

    existing = ShiftWindow.query.filter_by(account_group_id=account_id).all()
    existing_by_id = {window.id: window for window in existing}
    kept_ids = set()

    for window_spec in parsed:
        window_model = existing_by_id.get(window_spec['id']) if window_spec.get('id') else None
        if window_model is None:
            window_model = ShiftWindow(
                id=window_spec.get('id') or str(uuid.uuid4()),
                account_group_id=account_id,
            )
            db.session.add(window_model)
        window_model.name = window_spec['name']
        window_model.start_minute = window_spec['start_minute']
        window_model.end_minute = window_spec['end_minute']
        window_model.sort_order = window_spec['sort_order']
        kept_ids.add(window_model.id)

    for window in existing:
        if window.id not in kept_ids:
            db.session.delete(window)

    db.session.commit()
    updated = (
        ShiftWindow.query.filter_by(account_group_id=account_id)
        .order_by(ShiftWindow.sort_order)
        .all()
    )
    return jsonify({'shift_windows': [_serialize_window(window) for window in updated]})

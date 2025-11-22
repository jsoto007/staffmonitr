from datetime import datetime
from flask import Blueprint, current_app, jsonify, request
from sqlalchemy.orm import joinedload

from ..database import db
from ..models import AccountGroup, Assignment, Shift
from ..services.event_bus import broadcast_event
from ..services.mailgun import send_mailgun_message
from ..services.notifications import broadcast_open_shift, notify_shift_change
from ..utils.auth_helpers import require_auth, require_role
from ..utils.serializers import shift_payload

shifts_bp = Blueprint('shifts', __name__)


def _parse_iso_datetime(value: str, field_name: str) -> datetime:
    if not value:
        raise ValueError(f'{field_name} is required')
    try:
        return datetime.fromisoformat(value)
    except ValueError:
        raise ValueError(f'{field_name} must be ISO-8601 formatted')


@shifts_bp.route('/shifts', methods=['GET'])
def list_shifts():
    account_id = request.args.get('account_id')
    role_filter = request.args.get('role')
    query = Shift.query.options(
        joinedload(Shift.assignments).joinedload(Assignment.staff),
        joinedload(Shift.assignments).joinedload(Assignment.kids),
        joinedload(Shift.kids),
    )
    if account_id:
        query = query.filter_by(account_group_id=account_id)
    if role_filter:
        query = query.filter(Shift.assignments.any(Assignment.staff.has(role=role_filter)))
    shifts = query.order_by(Shift.start_time).all()
    return jsonify([shift_payload(shift) for shift in shifts])


@shifts_bp.route('/shifts', methods=['POST'])
def create_shift():
    payload = request.json or {}
    try:
        start_time = _parse_iso_datetime(payload.get('start_time'), 'start_time')
        end_time = _parse_iso_datetime(payload.get('end_time'), 'end_time')
    except ValueError as exc:
        return jsonify({'error': str(exc)}), 400

    account_group_id = payload.get('account_group_id')
    if not account_group_id:
        return jsonify({'error': 'account_group_id is required'}), 400

    shift = Shift(
        account_group_id=account_group_id,
        site=payload.get('site', 'Main Hall'),
        start_time=start_time,
        end_time=end_time,
        ratio_min=payload.get('ratio_min', 1),
        leads_required=payload.get('leads_required', 1),
        is_special=bool(payload.get('is_special', False)),
        difficulty=payload.get('difficulty', 'standard'),
        open_shift=bool(payload.get('openShift', False)),
    )
    db.session.add(shift)
    db.session.commit()
    broadcast_event('shift_create', shift_payload(shift))
    return jsonify({'id': shift.id}), 201


@shifts_bp.route('/shifts/<shift_id>', methods=['PATCH'])
def update_shift(shift_id):
    shift = Shift.query.options(joinedload(Shift.account_group).joinedload(AccountGroup.staff)).get_or_404(shift_id)
    payload = request.json or {}
    if start := payload.get('start_time'):
        try:
            shift.start_time = datetime.fromisoformat(start)
        except ValueError:
            return jsonify({'error': 'start_time must be ISO-8601 formatted'}), 400
    if end := payload.get('end_time'):
        try:
            shift.end_time = datetime.fromisoformat(end)
        except ValueError:
            return jsonify({'error': 'end_time must be ISO-8601 formatted'}), 400

    shift.site = payload.get('site', shift.site)
    shift.ratio_min = payload.get('ratio_min', shift.ratio_min)
    shift.leads_required = payload.get('leads_required', shift.leads_required)
    shift.is_special = bool(payload.get('is_special', shift.is_special))
    shift.difficulty = payload.get('difficulty', shift.difficulty)
    previous_open = shift.open_shift
    shift.open_shift = bool(payload.get('openShift', shift.open_shift))
    db.session.commit()
    broadcast_event('shift_update', shift_payload(shift))
    if shift.open_shift and not previous_open:
        staff_emails = [member.email for member in shift.account_group.staff if member.status == 'active']
        broadcast_open_shift(shift.id, staff_emails)
    for assignment in shift.assignments:
        if assignment.staff:
            notify_shift_change(assignment.staff.email, shift.id)
    return jsonify({'message': 'Shift updated'})


@shifts_bp.route('/shifts/<shift_id>', methods=['DELETE'])
def delete_shift(shift_id):
    shift = Shift.query.get_or_404(shift_id)
    db.session.delete(shift)
    db.session.commit()
    broadcast_event('shift_delete', {'shift_id': shift_id})
    return jsonify({'message': 'Shift removed'})


@shifts_bp.route('/shifts/<shift_id>/request-staff', methods=['POST'])
@require_auth
@require_role('Owner_admin', 'Admin')
def request_staff(shift_id, *, current_staff):
    payload = request.json or {}
    shift = Shift.query.options(joinedload(Shift.account_group).joinedload(AccountGroup.staff)).get_or_404(shift_id)
    connected_ids = {str(value) for value in payload.get('connected_account_ids') or []}
    recipients: set[str] = {
        member.email for member in shift.account_group.staff if member.status == 'active' and member.email
    }
    if connected_ids:
        extra_accounts = AccountGroup.query.filter(AccountGroup.id.in_(connected_ids)).all()
        for account in extra_accounts:
            recipients.update({member.email for member in account.staff if member.status == 'active' and member.email})
    recipients.discard(current_staff.email)
    if not recipients:
        return jsonify({'error': 'No eligible recipients'}), 400

    start_time = shift.start_time.strftime('%b %d, %I:%M %p')
    end_time = shift.end_time.strftime('%I:%M %p')
    account_name = shift.account_group.name if shift.account_group else 'your workspace'
    message = payload.get('message') or f'Admin {current_staff.full_name} needs coverage for this shift.'
    text = (
        f'Hi there,\n\n{current_staff.full_name} is requesting help for {shift.site} ({account_name}) '
        f'on {start_time} – {end_time}.\n\n{message}\n\n'
        f'View it in StaffMonitr: {current_app.config.get("FRONTEND_URL", "http://localhost:3000")}/calendar\n\n'
        'Reply if you are available.'
    )
    subject = f'Coverage request · {shift.site} · {start_time}'
    send_mailgun_message(list(recipients), subject, text)
    broadcast_event(
        'shift_request_broadcast',
        {
            'shift_id': shift.id,
            'account_id': shift.account_group_id,
            'requested_by': current_staff.full_name,
            'recipients': list(recipients),
        },
    )
    return jsonify({'message': 'Coverage request sent', 'recipient_count': len(recipients)})

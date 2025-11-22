from flask import Blueprint, jsonify, request
from sqlalchemy.orm import joinedload

from ..database import db
from ..models import Assignment, Kid, OpenShiftRequest, Shift, StaffMember
from ..services.event_bus import broadcast_event
from ..services.notifications import broadcast_open_shift, notify_assignment_change
from ..services.geofence import is_within_geofence
from ..utils.auth_helpers import require_auth, require_role
from ..utils.serializers import shift_payload

assignments_bp = Blueprint('assignments', __name__)


def _serialize_open_shift_request(request_model: OpenShiftRequest) -> dict:
    shift_data = shift_payload(request_model.shift) if request_model.shift else None
    staff_member = request_model.staff
    return {
        'id': request_model.id,
        'shift_id': request_model.shift_id,
        'staff_id': request_model.staff_id,
        'status': request_model.status,
        'requested_at': request_model.requested_at.isoformat(),
        'shift': shift_data,
        'staff': {
            'id': staff_member.id,
            'full_name': staff_member.full_name,
            'email': staff_member.email,
            'role': staff_member.role,
        }
        if staff_member
        else None,
    }


@assignments_bp.route('/assignments/open', methods=['GET'])
def open_shifts():
    query = (
        Shift.query.filter_by(open_shift=True)
        .options(
            joinedload(Shift.assignments).joinedload(Assignment.staff),
            joinedload(Shift.assignments).joinedload(Assignment.kids),
        )
        .order_by(Shift.start_time)
    )
    payload = []
    for shift in query.all():
        shift_data = shift_payload(shift)
        payload.append(
            {
                'id': shift.id,
                'site': shift.site,
                'ratio_min': shift.ratio_min,
                'start_time': shift.start_time.isoformat(),
                'end_time': shift.end_time.isoformat(),
                'role': shift_data['role'],
                'assignments': shift_data['assignments'],
                'pendingAssignmentId': shift_data['pendingAssignmentId'],
                'openShift': shift.open_shift,
                'difficulty': shift_data['difficulty'],
            }
        )
    return jsonify(payload)


@assignments_bp.route('/assignments', methods=['POST'])
def create_assignment():
    data = request.json or {}
    shift = Shift.query.get_or_404(data['shift_id'])
    assignment = Assignment(
        shift_id=data['shift_id'],
        staff_id=data.get('staff_id'),
        title=data.get('title', 'Kid assignment'),
        difficulty_rating=data.get('difficulty_rating', 2),
        instructions=data.get('instructions'),
        requires_one_on_one=data.get('requires_one_on_one', False),
    )
    db.session.add(assignment)
    db.session.flush()
    kids_payload = data.get('kids', [])
    for kid in kids_payload:
        kid_model = Kid(
            full_name=kid['name'],
            ratio=kid.get('ratio', '1:1'),
            special_instructions=kid.get('instructions'),
            banned_staff=kid.get('banned_staff', []),
            account_group_id=kid.get('account_group_id', shift.account_group_id),
            shift_id=data['shift_id'],
            assignment_id=assignment.id,
        )
        db.session.add(kid_model)
    db.session.commit()
    broadcast_event('assignment_update', {'assignment_id': assignment.id, 'shift_id': assignment.shift_id})
    if assignment.staff:
        notify_assignment_change(assignment.staff.email, assignment.id)
    return jsonify({'id': assignment.id}), 201


@assignments_bp.route('/assignments/<assignment_id>/request', methods=['POST'])
def request_open_shift(assignment_id):
    assignment = (
        Assignment.query.options(joinedload(Assignment.shift).joinedload(Shift.account_group)).get_or_404(assignment_id)
    )
    if assignment.staff_id:
        return jsonify({'error': 'Assignment already filled'}), 409
    staff_id = request.json.get('staff_id')
    staff = StaffMember.query.get_or_404(staff_id)
    shift = assignment.shift
    if not shift:
        return jsonify({'error': 'Shift not found'}), 404

    existing = OpenShiftRequest.query.filter_by(shift_id=shift.id, staff_id=staff.id, status='pending').first()
    if existing:
        return jsonify({'message': 'Request already pending', 'request_id': existing.id}), 200

    open_request = OpenShiftRequest(shift_id=shift.id, staff_id=staff.id, status='pending')
    shift.open_shift = True
    db.session.add(open_request)
    db.session.commit()

    account_staff = shift.account_group.staff if shift.account_group else []
    admins = [member.email for member in account_staff if member.role in ['Owner_admin', 'Admin']]
    if admins:
        broadcast_open_shift(shift.id, admins)
    broadcast_event('open_shift_request', {'request_id': open_request.id, 'shift_id': shift.id})
    return jsonify({'message': 'Request received', 'assignment_id': assignment.id, 'request_id': open_request.id})


@assignments_bp.route('/open-shift-requests', methods=['GET'])
def list_open_shift_requests():
    staff_id = request.args.get('staff_id')
    account_id = request.args.get('account_id')
    status_filter = request.args.get('status')

    query = OpenShiftRequest.query.options(joinedload(OpenShiftRequest.shift).joinedload(Shift.assignments))
    if staff_id:
        query = query.filter_by(staff_id=staff_id)
    if account_id:
        query = query.join(Shift).filter(Shift.account_group_id == account_id)
    if status_filter:
        query = query.filter_by(status=status_filter)

    query = query.order_by(OpenShiftRequest.requested_at.desc())
    return jsonify([_serialize_open_shift_request(req) for req in query.all()])


@assignments_bp.route('/open-shift-requests/<request_id>/respond', methods=['POST'])
@require_auth
@require_role('Owner_admin', 'Admin')
def respond_open_shift_request(request_id, *, current_staff):
    payload = request.json or {}
    action = (payload.get('action') or '').lower()
    open_request = OpenShiftRequest.query.options(joinedload(OpenShiftRequest.shift).joinedload(Shift.assignments)).get_or_404(
        request_id
    )
    shift = open_request.shift
    if not shift:
        return jsonify({'error': 'Associated shift not found'}), 404

    if action == 'approve':
        pending_assignment = next((assignment for assignment in shift.assignments if not assignment.staff_id), None)
        if not pending_assignment:
            return jsonify({'error': 'No open assignment available'}), 409
        pending_assignment.staff_id = open_request.staff_id
        open_request.status = 'approved'
        shift.open_shift = any(assignment.staff_id is None for assignment in shift.assignments)
        db.session.commit()
        staff = open_request.staff
        if staff:
            notify_assignment_change(staff.email, pending_assignment.id)
        broadcast_event(
            'open_shift_request_response',
            {'request_id': open_request.id, 'status': open_request.status, 'responded_by': current_staff.full_name},
        )
        broadcast_event('assignment_update', {'assignment_id': pending_assignment.id, 'shift_id': shift.id})
        return jsonify({'message': 'Staff assigned', 'assignment_id': pending_assignment.id})

    if action == 'decline':
        open_request.status = 'declined'
        db.session.commit()
        broadcast_event(
            'open_shift_request_response',
            {'request_id': open_request.id, 'status': open_request.status, 'responded_by': current_staff.full_name},
        )
        return jsonify({'message': 'Request declined'})

    return jsonify({'error': 'Invalid action'}), 400


@assignments_bp.route('/assignments/<assignment_id>', methods=['PATCH'])
def update_assignment(assignment_id):
    assignment = Assignment.query.options(joinedload(Assignment.shift), joinedload(Assignment.staff)).get_or_404(assignment_id)
    data = request.json or {}
    if 'staff_id' in data:
        assignment.staff_id = data['staff_id']
    if 'title' in data:
        assignment.title = data['title']
    if 'difficulty_rating' in data:
        assignment.difficulty_rating = data['difficulty_rating']
    if 'instructions' in data:
        assignment.instructions = data['instructions']
    if 'requires_one_on_one' in data:
        assignment.requires_one_on_one = data['requires_one_on_one']
    db.session.commit()
    broadcast_event('assignment_update', {'assignment_id': assignment.id, 'shift_id': assignment.shift_id})
    if assignment.staff:
        notify_assignment_change(assignment.staff.email, assignment.id)
    return jsonify({'message': 'Assignment updated'})


@assignments_bp.route('/assignments/<assignment_id>', methods=['DELETE'])
def delete_assignment(assignment_id):
    assignment = Assignment.query.get_or_404(assignment_id)
    db.session.delete(assignment)
    db.session.commit()
    broadcast_event('assignment_deleted', {'assignment_id': assignment_id, 'shift_id': assignment.shift_id})
    return jsonify({'message': 'Assignment removed'})


@assignments_bp.route('/assignments/<assignment_id>/validate-geofence', methods=['GET'])
def assignment_geofence(assignment_id):
    assignment = Assignment.query.get_or_404(assignment_id)
    lat = float(request.args.get('lat', 0))
    lon = float(request.args.get('lon', 0))
    shift = Shift.query.get(assignment.shift_id)
    account = shift.account_group
    allowed = is_within_geofence(lat, lon, account.geofence_lat, account.geofence_lon, account.geofence_radius)
    return jsonify({'allowed': allowed})

import logging
from datetime import datetime

from flask import current_app

from .event_bus import broadcast_event
from .mailgun import send_mailgun_message

LOG = logging.getLogger('staffmonitr.notifications')

EMAIL_SUBJECTS = {
    'shift_update': 'Shift update alert',
    'assignment_change': 'Assignment change',
    'open_shift': 'Open shift offered',
}


def send_email(recipient: str, subject_key: str, payload: dict, body: str | None = None) -> None:
    subject = EMAIL_SUBJECTS.get(subject_key, 'Staffmonitr notification')
    text = body or f"{subject}\n\nDetails:\n{payload}"
    if not send_mailgun_message([recipient], subject, text):
        LOG.info('Fallback log for %s | %s | %s', recipient, subject, payload)


def notify_shift_change(staff_email: str, shift_id: str) -> None:
    send_email(
        staff_email,
        'shift_update',
        {'shift_id': shift_id, 'timestamp': datetime.utcnow().isoformat()},
    )
    broadcast_event('assignment_update', {'shift_id': shift_id})


def notify_assignment_change(staff_email: str, assignment_id: str) -> None:
    send_email(
        staff_email,
        'assignment_change',
        {'assignment_id': assignment_id, 'timestamp': datetime.utcnow().isoformat()},
    )
    broadcast_event('assignment_update', {'assignment_id': assignment_id})


def broadcast_open_shift(open_shift_id: str, audience: list[str]) -> None:
    broadcast_event('open_shift_broadcast', {'shift_id': open_shift_id, 'audience': audience})
    for recipient in audience:
        send_email(recipient, 'open_shift', {'shift_id': open_shift_id})

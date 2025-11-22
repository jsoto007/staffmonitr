import base64
import logging
from typing import Sequence
from urllib import error, parse, request

from flask import current_app

LOG = logging.getLogger('staffmonitr.mailgun')


def _encode_basic_auth(api_key: str) -> str:
    token = base64.b64encode(f'api:{api_key}'.encode('utf-8')).decode('utf-8')
    return f'Basic {token}'


def send_mailgun_message(
    recipients: Sequence[str],
    subject: str,
    text: str,
    html: str | None = None,
) -> bool:
    api_key = current_app.config.get('MAILGUN_API_KEY')
    domain = current_app.config.get('MAILGUN_DOMAIN')
    if not (api_key and domain):
        LOG.debug('Mailgun credentials missing, skipping email "%s"', subject)
        return False

    sender = current_app.config.get('MAIL_SENDER') or f'staffmonitr@{domain}'
    base_url = current_app.config.get('MAILGUN_BASE_URL', 'https://api.mailgun.net/v3')
    payload = {
        'from': sender,
        'to': ','.join(recipients),
        'subject': subject,
        'text': text,
    }
    if html:
        payload['html'] = html

    encoded_payload = parse.urlencode(payload).encode('utf-8')
    req = request.Request(f'{base_url}/{domain}/messages', data=encoded_payload)
    req.add_header('Authorization', _encode_basic_auth(api_key))
    req.add_header('Content-Type', 'application/x-www-form-urlencoded')

    try:
        with request.urlopen(req, timeout=10) as resp:
            resp.read()
        return True
    except (error.HTTPError, error.URLError) as exc:
        LOG.warning('Mailgun request failed: %s', exc, exc_info=True)
        return False

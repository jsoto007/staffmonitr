import json
from queue import Empty

from flask import Blueprint, Response, stream_with_context

from ..services.event_bus import register_event_listener, unregister_event_listener

events_bp = Blueprint('events', __name__)


@events_bp.route('/events/stream', methods=['GET'])
def stream_events():
    def generate():
        listener = register_event_listener()
        try:
            while True:
                try:
                    payload = listener.get(timeout=25)
                except Empty:
                    yield ':\n\n'
                    continue
                yield f"event: {payload['type']}\ndata: {json.dumps(payload['payload'])}\n\n"
        finally:
            unregister_event_listener(listener)

    return Response(stream_with_context(generate()), mimetype='text/event-stream')

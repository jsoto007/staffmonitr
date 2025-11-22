from __future__ import annotations

from queue import Empty, Queue
from threading import Lock

LISTENERS: list[Queue] = []
LISTENERS_LOCK = Lock()


def register_event_listener() -> Queue:
    listener = Queue()
    with LISTENERS_LOCK:
        LISTENERS.append(listener)
    return listener


def unregister_event_listener(listener: Queue) -> None:
    with LISTENERS_LOCK:
        if listener in LISTENERS:
            LISTENERS.remove(listener)


def broadcast_event(event_type: str, payload: dict) -> None:
    with LISTENERS_LOCK:
        for listener in LISTENERS[:]:
            listener.put({'type': event_type, 'payload': payload})

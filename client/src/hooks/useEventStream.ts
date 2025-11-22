import { useEffect } from 'react';

const API_BASE = (import.meta.env.VITE_API_URL ?? 'http://127.0.0.1:5000/api').replace(/\/$/, '');

export const useEventStream = (onEvent: (event: { type: string; payload: unknown }) => void) => {
  useEffect(() => {
    const eventSource = new EventSource(`${API_BASE}/events/stream`);

    const handleEvent = (event: MessageEvent) => {
      if (!event.data) {
        return;
      }
      try {
        const payload = JSON.parse(event.data);
        onEvent({ type: event.type, payload });
      } catch (error) {
        console.warn('Unable to parse SSE payload', error);
      }
    };

    eventSource.onmessage = handleEvent;
    eventSource.addEventListener('shift_update', handleEvent);
    eventSource.addEventListener('assignment_update', handleEvent);
    eventSource.addEventListener('open_shift_request', handleEvent);
    eventSource.addEventListener('open_shift_request_response', handleEvent);
    eventSource.addEventListener('shift_request_broadcast', handleEvent);

    return () => {
      eventSource.close();
    };
  }, [onEvent]);
};

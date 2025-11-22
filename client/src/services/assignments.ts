import api from '../utils/api';

export const requestAssignment = (assignmentId: string, staffId?: string) =>
  api.post(`/assignments/${assignmentId}/request`, staffId ? { staff_id: staffId } : {});

export const fetchOpenShiftRequests = (params: Record<string, string>) =>
  api.get('/open-shift-requests', { params }).then((response) => response.data);

export const respondToOpenShiftRequest = (requestId: string, action: 'approve' | 'decline') =>
  api.post(`/open-shift-requests/${requestId}/respond`, { action });

export const updateAssignment = (assignmentId: string, payload: Record<string, unknown>) =>
  api.patch(`/assignments/${assignmentId}`, payload);

export const deleteAssignment = (assignmentId: string) => api.delete(`/assignments/${assignmentId}`);

export const fetchOpenShifts = () => api.get('/assignments/open').then((response) => response.data);

export const createAssignment = (payload: Record<string, unknown>) => api.post('/assignments', payload);

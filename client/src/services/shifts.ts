import api from '../utils/api';
import type { ShiftEvent } from '../types';

export const fetchShifts = (accountId: string) =>
  api
    .get<ShiftEvent[]>('/shifts', {
      params: { account_id: accountId, expand: 'assignments,kids' },
    })
    .then((response) => response.data);

export const createShift = (payload: {
  account_group_id: string;
  site: string;
  start_time: string;
  end_time: string;
  ratio_min?: number;
  leads_required?: number;
  difficulty?: string;
  is_special?: boolean;
  openShift?: boolean;
}) => api.post('/shifts', payload);

export const updateShift = (shiftId: string, payload: Record<string, unknown>) =>
  api.patch(`/shifts/${shiftId}`, payload);

export const deleteShift = (shiftId: string) => api.delete(`/shifts/${shiftId}`);

export const requestShiftCoverage = (
  shiftId: string,
  data: { message?: string; connected_account_ids?: string[] },
) => api.post(`/shifts/${shiftId}/request-staff`, data);

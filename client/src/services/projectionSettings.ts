import api from '../utils/api';
import type { ShiftWindow } from '../types';

export interface ShiftWindowPayload {
  id?: string;
  name?: string;
  start_minute: number;
  end_minute: number;
  order: number;
}

export const fetchShiftWindows = (accountId: string) =>
  api
    .get<ShiftWindow[]>('/shift-windows', {
      params: { account_id: accountId },
    })
    .then((response) => response.data);

export const replaceShiftWindows = (payload: {
  account_group_id: string;
  windows: ShiftWindowPayload[];
}) => api.put('/shift-windows', payload);

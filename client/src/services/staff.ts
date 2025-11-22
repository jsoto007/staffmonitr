import api from '../utils/api';

export const fetchAccountStaff = (accountId: string) =>
  api.get(`/accounts/${accountId}/staff`).then((response) => response.data.staff);

export const updateAccountStaff = (accountId: string, staffId: string, payload: Record<string, unknown>) =>
  api.patch(`/accounts/${accountId}/staff/${staffId}`, payload);

export const removeAccountStaff = (accountId: string, staffId: string) =>
  api.delete(`/accounts/${accountId}/staff/${staffId}`);

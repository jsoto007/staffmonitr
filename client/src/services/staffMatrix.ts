import api from '../utils/api';

const basePath = (accountId: string) => `/accounts/${accountId}/staff-matrix`;

export const fetchStaffMatrix = (accountId: string) =>
  api.get(basePath(accountId)).then((response) => response.data);

export const createStaffMatrixTemplate = (accountId: string, payload: Record<string, unknown>) =>
  api.post(`${basePath(accountId)}/templates`, payload).then((response) => response.data);

export const updateStaffMatrixTemplate = (
  accountId: string,
  templateId: string,
  payload: Record<string, unknown>,
) => api.patch(`${basePath(accountId)}/templates/${templateId}`, payload).then((response) => response.data);

export const deleteStaffMatrixTemplate = (accountId: string, templateId: string) =>
  api.delete(`${basePath(accountId)}/templates/${templateId}`);

export const assignStaffToTemplate = (
  accountId: string,
  templateId: string,
  payload: Record<string, unknown>,
) => api.post(`${basePath(accountId)}/templates/${templateId}/assignments`, payload).then((response) => response.data);

export const unassignStaffFromTemplate = (accountId: string, assignmentId: string) =>
  api.delete(`${basePath(accountId)}/assignments/${assignmentId}`);

export const addScheduleOverride = (accountId: string, payload: Record<string, unknown>) =>
  api.post(`${basePath(accountId)}/overrides`, payload).then((response) => response.data);

export const removeScheduleOverride = (accountId: string, overrideId: string) =>
  api.delete(`${basePath(accountId)}/overrides/${overrideId}`);

export const addSupplementalShift = (accountId: string, payload: Record<string, unknown>) =>
  api.post(`${basePath(accountId)}/additional-shifts`, payload).then((response) => response.data);

export const removeSupplementalShift = (accountId: string, shiftId: string) =>
  api.delete(`${basePath(accountId)}/additional-shifts/${shiftId}`);

import api from '../utils/api';
import type { StaffMatrixCalendarPayload, StaffMatrixPayload, StaffMatrixRole } from '../types';

const basePath = (accountId: string) => `/accounts/${accountId}/staff-matrix`;

export const fetchStaffMatrix = (accountId: string): Promise<StaffMatrixPayload> =>
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

export const fetchStaffMatrixCalendar = (
  accountId: string,
  startDate: string,
  endDate: string,
) =>
  api
    .get<StaffMatrixCalendarPayload>(`/accounts/${accountId}/staff-matrix/calendar`, {
      params: { start_date: startDate, end_date: endDate },
    })
    .then((response) => response.data);

export const fetchStaffMatrixRoles = (accountId: string): Promise<StaffMatrixRole[]> =>
  api.get(`${basePath(accountId)}/roles`).then((response) => response.data);

export const createStaffMatrixRole = (accountId: string, payload: Partial<StaffMatrixRole>) =>
  api.post(`${basePath(accountId)}/roles`, payload).then((response) => response.data);

export const updateStaffMatrixRole = (accountId: string, roleId: string, payload: Partial<StaffMatrixRole>) =>
  api.patch(`${basePath(accountId)}/roles/${roleId}`, payload).then((response) => response.data);

export const deleteStaffMatrixRole = (accountId: string, roleId: string) =>
  api.delete(`${basePath(accountId)}/roles/${roleId}`);

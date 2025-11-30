import api from '../utils/api';
import type { AccessRole, MePermissionsPayload, Permission, ShiftScope } from '../types';

export interface RolePayload {
  name: string;
  description?: string;
  level: number;
  permissionCodes: string[];
  shiftIds?: string[];
}

export const fetchRoles = (): Promise<AccessRole[]> => api.get('/roles').then((response) => response.data);

export const fetchPermissions = (): Promise<Permission[]> =>
  api.get('/roles/permissions').then((response) => response.data);

export const fetchRoleShifts = (accountId?: string): Promise<ShiftScope[]> =>
  api
    .get('/roles/shifts', { params: accountId ? { account_id: accountId } : undefined })
    .then((response) => response.data);

export const createRole = (payload: RolePayload): Promise<AccessRole> =>
  api.post('/roles', payload).then((response) => response.data);

export const updateRole = (roleId: string, payload: Partial<RolePayload>): Promise<AccessRole> =>
  api.put(`/roles/${roleId}`, payload).then((response) => response.data);

export const deleteRole = (roleId: string) => api.delete(`/roles/${roleId}`);

export const fetchMePermissions = (): Promise<MePermissionsPayload> =>
  api.get('/me/permissions').then((response) => response.data);

import api from '../utils/api';
import type { CoverageMode, ProjectionSettings } from '../types';

export interface ShiftTemplatePayload {
  id?: string;
  label: string;
  start_time: string;
  end_time: string;
  color?: string | null;
  order: number;
  category?: 'coverage' | 'role';
  role?: string | null;
  days?: string[];
}

export interface ProjectionSettingsPayload {
  coverage_mode: CoverageMode;
  shifts: ShiftTemplatePayload[];
}

export const fetchProjectionSettings = (accountId: string) =>
  api
    .get<ProjectionSettings>(`/accounts/${accountId}/projection-settings`)
    .then((response) => response.data);

export const updateProjectionSettings = (accountId: string, payload: ProjectionSettingsPayload) =>
  api
    .put<ProjectionSettings>(`/accounts/${accountId}/projection-settings`, payload)
    .then((response) => response.data);

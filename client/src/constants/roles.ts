import type { Role } from '../types';

export const ROLE_OPTIONS: Role[] = [
  'Owner_admin',
  'Admin',
  'Staff',
  'Driver',
  'Lead',
  'Trainer',
  'Assistant Lead',
  'Assistant Program Director',
  'Residence Manager',
  'Director',
];

export const ADMIN_ROLE_SET = new Set<Role>(['Owner_admin', 'Admin']);

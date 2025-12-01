import type { Role } from '../types';

// Legacy fallback list; new features must consume roles from the Staff Matrix source of truth.
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

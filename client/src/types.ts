export type Role =
  | 'Owner_admin'
  | 'Admin'
  | 'Staff'
  | 'Driver'
  | 'Trainer'
  | 'Assistant Lead'
  | 'Lead'
  | 'Residence Manager'
  | 'Assistant Program Director'
  | 'Director';

export interface AccountGroup {
  id: string;
  name: string;
  branding: {
    primaryColor: string;
    logoUrl?: string;
  };
  geofence: {
    lat: number;
    lon: number;
    radiusMeters: number;
  };
}

export interface StaffMember {
  id: string;
  full_name: string;
  role: Role;
  email: string;
  status: string;
  assigned_account_ids: string[];
  invite_expires_at?: string | null;
}

export interface ShiftWindow {
  id: string;
  account_group_id: string;
  name: string;
  start_minute: number;
  end_minute: number;
  order: number;
}

export interface ShiftEvent {
  id: string;
  account_group_id: string;
  start_time: string;
  end_time: string;
  ratio_min?: number;
  role: Role;
  difficulty?: 'easy' | 'medium' | 'hard';
  site: string;
  is_special?: boolean;
  leadsRequired: number;
  assignments: Assignment[];
  openShift?: boolean;
  kids?: KidDetails[];
  pendingAssignmentId?: string;
  durationHours?: number;
}

export interface Assignment {
  id: string;
  staff_id: string;
  site: string;
  title: string;
  difficulty: 1 | 2 | 3 | 4 | 5;
  kids: KidDetails[];
  instructions?: string;
  requiresOneOnOne?: boolean;
  kidsCount?: number;
  staffRole?: Role | null;
}

export interface KidDetails {
  id: string;
  name: string;
  ratio: string;
  requiresOneOnOne: boolean;
  bans?: string[];
  specialInstructions?: string;
  assignmentId?: string;
  shiftId?: string;
  accountGroupId?: string;
}

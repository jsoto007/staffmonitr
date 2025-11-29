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
  phone_number?: string;
  photo_url?: string;
  status: string;
  assigned_account_ids: string[];
  invite_expires_at?: string | null;
}

export type CoverageMode = 'full_24h' | 'partial_coverage';

export interface ShiftTemplate {
  id: string;
  label: string;
  start_time: string;
  end_time: string;
  color?: string | null;
  order: number;
  category?: 'coverage' | 'role';
  role?: string | null;
  days?: string[];
  ratio_staff?: number;
  ratio_kids?: number;
  notes?: string | null;
}

export interface ProjectionSettings {
  coverage_mode: CoverageMode;
  shifts: ShiftTemplate[];
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

export interface StaffMatrixAssignment {
  id: string;
  template_id: string;
  staff_id: string;
  staff_name: string;
  staff_role: Role;
  start_date?: string | null;
  end_date?: string | null;
}

export interface StaffMatrixOverride {
  id: string;
  staff_id: string;
  staff_name: string;
  date: string;
  type: string;
  reason?: string | null;
}

export interface StaffSupplementalShift {
  id: string;
  staff_id: string;
  staff_name: string;
  date: string;
  label: string;
  start_time: string;
  end_time: string;
  is_overtime: boolean;
  notes?: string | null;
}

export type StaffMatrixDay = 'sun' | 'mon' | 'tue' | 'wed' | 'thu' | 'fri' | 'sat';

export interface WeeklyPatternEntry {
  start_time: string;
  end_time: string;
}

export type WeeklyPattern = Record<StaffMatrixDay, WeeklyPatternEntry[]>;

export interface StaffMatrixTemplate {
  id: string;
  label: string;
  role: string;
  color?: string | null;
  notes?: string | null;
  weekly_pattern: WeeklyPattern;
  shift_type?: 'Morning' | 'Evening' | 'Night' | null;
}

export interface StaffMatrixPayload {
  templates: StaffMatrixTemplate[];
  assignments: StaffMatrixAssignment[];
  overrides: StaffMatrixOverride[];
  additional_shifts: StaffSupplementalShift[];
}

export interface StaffMatrixCalendarEntry {
  id: string;
  template_id: string;
  template_label: string;
  template_role?: string | null;
  template_color?: string | null;
  template_notes?: string | null;
  date: string;
  start_time: string;
  end_time: string;
  start_minute: number;
  end_minute: number;
  shift_type?: 'Morning' | 'Evening' | 'Night' | null;
  assignment_id?: string | null;
  staff_id?: string | null;
  staff_name?: string | null;
  staff_role?: string | null;
  is_open: boolean;
}

export interface StaffMatrixCalendarPayload {
  start_date: string;
  end_date: string;
  entries: StaffMatrixCalendarEntry[];
}

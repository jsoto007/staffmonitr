import type { ShiftEvent, ShiftTemplate, StaffMember } from '../../types';
import { CalendarDay } from './CalendarDay';

interface DayViewProps {
  date: Date;
  shifts: ShiftEvent[];
  shiftTemplates: ShiftTemplate[];
  staffMembers: StaffMember[];
  isAdmin: boolean;
  onRequestCoverage: (shift: ShiftEvent) => void;
  onAssignStaff?: (shift: ShiftEvent) => void;
  onAssignTemplate?: (template: ShiftTemplate, date: Date) => void;
}

export const DayView = ({
  date,
  shifts,
  shiftTemplates,
  staffMembers,
  isAdmin,
  onRequestCoverage,
  onAssignStaff,
  onAssignTemplate,
}: DayViewProps) => (
    <CalendarDay
      date={date}
      shifts={shifts}
      shiftTemplates={shiftTemplates}
      staffMembers={staffMembers}
      isAdmin={isAdmin}
      onRequestCoverage={onRequestCoverage}
      onAssignStaff={onAssignStaff}
      onAssignTemplate={onAssignTemplate}
    />
  );

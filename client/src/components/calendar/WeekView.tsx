import type { ShiftEvent, ShiftTemplate, StaffMember } from '../../types';
import { CalendarDay } from './CalendarDay';

interface WeekViewProps {
  weekStart: Date;
  shifts: ShiftEvent[];
  shiftTemplates: ShiftTemplate[];
  staffMembers: StaffMember[];
  isAdmin: boolean;
  onRequestCoverage: (shift: ShiftEvent) => void;
  onAssignStaff?: (shift: ShiftEvent) => void;
  onAssignTemplate?: (template: ShiftTemplate, date: Date) => void;
}

const formatDayLabel = (date: Date) => date.toLocaleDateString([], { weekday: 'short', day: 'numeric' });

export const WeekView = ({
  weekStart,
  shifts,
  shiftTemplates,
  staffMembers,
  isAdmin,
  onRequestCoverage,
  onAssignStaff,
  onAssignTemplate,
}: WeekViewProps) => {
  const weekDays = Array.from({ length: 7 }).map((_, index) => {
    const date = new Date(weekStart);
    date.setDate(weekStart.getDate() + index);
    return date;
  });

  const shiftsByDay = weekDays.map((day) =>
    shifts.filter((shift) => new Date(shift.start_time).toDateString() === day.toDateString()),
  );

  return (
    <div className="space-y-5">
      {weekDays.map((day, index) => (
        <CalendarDay
          key={day.toISOString()}
          date={day}
          shifts={shiftsByDay[index]}
          shiftTemplates={shiftTemplates}
          staffMembers={staffMembers}
          isAdmin={isAdmin}
          onRequestCoverage={onRequestCoverage}
          onAssignStaff={onAssignStaff}
          onAssignTemplate={onAssignTemplate}
        />
      ))}
    </div>
  );
};

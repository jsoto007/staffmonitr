import type { StaffMatrixCalendarEntry } from '../../types';
import { CalendarDay } from './CalendarDay';

const toIsoDate = (value: Date) => value.toISOString().split('T')[0];

interface WeekViewProps {
  weekStart: Date;
  weekDays: Date[];
  entriesByDate: Map<string, StaffMatrixCalendarEntry[]>;
  isAdmin: boolean;
  onAssignEntry: (entry: StaffMatrixCalendarEntry) => void;
  onRemoveAssignment?: (entry: StaffMatrixCalendarEntry) => void;
}

export const WeekView = ({
  weekStart: _weekStart,
  weekDays,
  entriesByDate,
  isAdmin,
  onAssignEntry,
  onRemoveAssignment,
}: WeekViewProps) => (
  <div className="space-y-5">
    {weekDays.map((day) => (
      <CalendarDay
        key={day.toISOString()}
        date={day}
        entries={entriesByDate.get(toIsoDate(day)) ?? []}
        isAdmin={isAdmin}
        onAssignEntry={onAssignEntry}
        onRemoveAssignment={onRemoveAssignment}
      />
    ))}
  </div>
);

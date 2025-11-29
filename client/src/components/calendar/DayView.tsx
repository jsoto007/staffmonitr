import type { StaffMatrixCalendarEntry } from '../../types';
import { CalendarDay } from './CalendarDay';

interface DayViewProps {
  date: Date;
  entries: StaffMatrixCalendarEntry[];
  isAdmin: boolean;
  onAssignEntry: (entry: StaffMatrixCalendarEntry) => void;
  onRemoveAssignment?: (entry: StaffMatrixCalendarEntry) => void;
}

export const DayView = ({
  date,
  entries,
  isAdmin,
  onAssignEntry,
  onRemoveAssignment,
}: DayViewProps) => (
  <CalendarDay
    date={date}
    entries={entries}
    isAdmin={isAdmin}
    onAssignEntry={onAssignEntry}
    onRemoveAssignment={onRemoveAssignment}
  />
);

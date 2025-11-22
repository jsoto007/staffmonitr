import { ShiftCard } from './ShiftCard';
import type { ShiftEvent } from '../../types';

interface WeekViewProps {
  weekStart: Date;
  shifts: ShiftEvent[];
  isAdmin: boolean;
  onRequestCoverage: (shift: ShiftEvent) => void;
}

const formatDayLabel = (date: Date) => date.toLocaleDateString([], { weekday: 'short', day: 'numeric' });

export const WeekView = ({ weekStart, shifts, isAdmin, onRequestCoverage }: WeekViewProps) => {
  const weekDays = Array.from({ length: 7 }).map((_, index) => {
    const date = new Date(weekStart);
    date.setDate(weekStart.getDate() + index);
    return date;
  });

  const shiftsByDay = weekDays.map((day) =>
    shifts.filter((shift) => {
      const shiftDate = new Date(shift.start_time);
      return shiftDate.toDateString() === day.toDateString();
    }),
  );

  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
      {weekDays.map((day, index) => (
        <div key={day.toISOString()} className="space-y-3 rounded-2xl border border-white/10 bg-slate-950/50 p-4">
          <div className="text-xs uppercase tracking-[0.4em] text-slate-400">{formatDayLabel(day)}</div>
          {shiftsByDay[index].length === 0 && (
            <p className="text-sm text-slate-500">No shifts</p>
          )}
          <div className="space-y-3">
            {shiftsByDay[index]
              .sort((a, b) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime())
              .map((shift) => (
                <ShiftCard
                  key={shift.id}
                  shift={shift}
                  isAdmin={isAdmin}
                  onRequestCoverage={onRequestCoverage}
                />
              ))}
          </div>
        </div>
      ))}
    </div>
  );
};

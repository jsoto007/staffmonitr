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
    <div className="space-y-5">
      {weekDays.map((day, index) => (
        <section key={day.toISOString()} className="space-y-4 rounded-2xl border border-white/10 bg-slate-950/50 p-4 shadow-inner shadow-black/40">
          <header className="flex items-center justify-between text-xs uppercase tracking-[0.4em] text-slate-400">
            <span>{formatDayLabel(day)}</span>
            <span>{day.toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' })}</span>
          </header>
          {shiftsByDay[index].length === 0 ? (
            <p className="text-sm text-slate-500">No shifts</p>
          ) : (
            <div className="space-y-4">
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
          )}
        </section>
      ))}
    </div>
  );
};

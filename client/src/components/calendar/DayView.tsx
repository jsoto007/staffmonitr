import { ShiftCard } from './ShiftCard';
import type { ShiftEvent } from '../../types';

interface DayViewProps {
  date: Date;
  shifts: ShiftEvent[];
  isAdmin: boolean;
  onRequestCoverage: (shift: ShiftEvent) => void;
  requestDisabled?: boolean;
}

export const DayView = ({ date, shifts, isAdmin, onRequestCoverage, requestDisabled }: DayViewProps) => (
  <div className="space-y-4">
    <div className="flex items-center justify-between">
      <h2 className="text-lg font-semibold text-white">{date.toDateString()}</h2>
      <p className="text-xs uppercase tracking-[0.4em] text-slate-400">{shifts.length} shift{shifts.length === 1 ? '' : 's'}</p>
    </div>
    <div className="space-y-3">
      {shifts.length === 0 && (
        <div className="rounded-2xl border border-dashed border-slate-800/40 p-6 text-sm text-slate-400">
          No shifts scheduled for this day.
        </div>
      )}
      {shifts
        .slice()
        .sort((a, b) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime())
        .map((shift) => (
          <ShiftCard
            key={shift.id}
            shift={shift}
            isAdmin={isAdmin}
            onRequestCoverage={onRequestCoverage}
            disabled={Boolean(requestDisabled && shift.pendingAssignmentId)}
          />
        ))}
    </div>
  </div>
);

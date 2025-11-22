import { StatusChip } from '../StatusChip';
import type { ShiftEvent } from '../../types';

interface ShiftCardProps {
  shift: ShiftEvent;
  isAdmin: boolean;
  onRequestCoverage?: (shift: ShiftEvent) => void;
  disabled?: boolean;
}

export const ShiftCard = ({ shift, isAdmin, onRequestCoverage, disabled }: ShiftCardProps) => {
  const start = new Date(shift.start_time);
  const end = new Date(shift.end_time);
  const duration = ((new Date(shift.end_time).getTime() - start.getTime()) / 36_0000).toFixed(1);
  const formattedTime = `${start.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })} – ${end.toLocaleTimeString(
    [],
    { hour: 'numeric', minute: '2-digit' },
  )}`;

  return (
    <article className="rounded-2xl border border-slate-700 bg-gradient-to-br from-slate-950/40 to-slate-900 p-4 shadow-inner shadow-black/40">
      <div className="flex items-center justify-between gap-2 text-xs uppercase tracking-[0.4em] text-slate-400">
        <span>{shift.site}</span>
        <span className="text-emerald-300">Ratio {shift.ratio_min ?? 1}</span>
        {shift.openShift && <StatusChip label="Open" color="#f97316" />}
      </div>
      <div className="mt-2 flex items-center justify-between gap-3">
        <div>
          <p className="text-sm text-slate-400">Role · {shift.role}</p>
          <p className="text-lg font-semibold text-white">{formattedTime}</p>
        </div>
        <p className="text-xs text-slate-400">{duration}h</p>
      </div>
      {shift.assignments.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-2 text-xs text-slate-300">
          {shift.assignments.map((assignment) => (
            <span key={assignment.id} className="flex items-center gap-1 rounded-full border border-white/10 bg-white/5 px-3 py-1">
              {assignment.title} · Diff {assignment.difficulty}
            </span>
          ))}
        </div>
      )}
      {isAdmin && onRequestCoverage && (
        <div className="mt-4 flex items-center justify-between gap-3 text-xs uppercase tracking-[0.4em]">
          <button
            onClick={() => onRequestCoverage(shift)}
            disabled={disabled}
            className="flex-1 rounded-2xl border border-transparent bg-gradient-to-r from-brand-500 to-brand-700 px-4 py-2 text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
          >
            Request coverage
          </button>
        </div>
      )}
    </article>
  );
};

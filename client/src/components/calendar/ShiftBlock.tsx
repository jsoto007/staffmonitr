import { StatusChip } from '../StatusChip';
import { StaffList } from './StaffList';
import type { ShiftEvent, StaffMember } from '../../types';

interface ShiftBlockProps {
  shift: ShiftEvent;
  staffById: Record<string, StaffMember>;
  isAdmin: boolean;
  onRequestCoverage?: (shift: ShiftEvent) => void;
  onAssignStaff?: (shift: ShiftEvent) => void;
}

export const ShiftBlock = ({
  shift,
  staffById,
  isAdmin,
  onRequestCoverage,
  onAssignStaff,
}: ShiftBlockProps) => {
  const start = new Date(shift.start_time);
  const end = new Date(shift.end_time);
  const duration = ((end.getTime() - start.getTime()) / 36_0000).toFixed(1);
  const formattedTime = `${start.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })} – ${end.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}`;

  const assigned = shift.assignments ?? [];

  return (
    <article className="rounded-2xl border border-white/5 bg-gradient-to-br from-slate-950/40 to-slate-900/60 p-4">
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
      <StaffList assignments={assigned} staffById={staffById} fallbackRole={shift.role} />
      {isAdmin && (
        <div className="mt-4 flex flex-wrap items-center justify-end gap-2">
          {onAssignStaff && (
            <button
              type="button"
              onClick={() => onAssignStaff(shift)}
              className="rounded-2xl border border-white/10 bg-white/5 px-3 py-2 text-xs font-semibold uppercase tracking-[0.4em] text-white transition hover:border-white/40"
            >
              Assign staff
            </button>
          )}
          {onRequestCoverage && (
            <button
              type="button"
              onClick={() => onRequestCoverage(shift)}
              className="rounded-2xl border border-transparent bg-gradient-to-r from-brand-500 to-brand-700 px-3 py-2 text-xs font-semibold uppercase tracking-[0.4em] text-white transition hover:opacity-90"
            >
              Request coverage
            </button>
          )}
        </div>
      )}
    </article>
  );
};

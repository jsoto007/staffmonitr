import { StatusChip } from '../StatusChip';
import { StaffList } from './StaffList';
import type { ShiftEvent, StaffMember } from '../../types';

interface ShiftBlockProps {
  shift: ShiftEvent;
  staffById: Record<string, StaffMember>;
  isAdmin: boolean;
  onRequestCoverage?: (shift: ShiftEvent) => void;
  onAssignStaff?: (shift: ShiftEvent) => void;
  onRemoveAssignment?: (assignmentId: string) => void;
  ratioLabel?: string;
  targetStaff?: number;
  assignedCountOverride?: number;
  statusDotColor?: 'red' | 'yellow' | 'green';
  displayLabel?: string;
}

export const ShiftBlock = ({
  shift,
  staffById,
  isAdmin,
  onRequestCoverage,
  onAssignStaff,
  onRemoveAssignment,
  ratioLabel,
  targetStaff,
  assignedCountOverride,
  statusDotColor,
  displayLabel,
}: ShiftBlockProps) => {
  const summarizeStatus = (assigned: number, target: number) => {
    const diff = assigned - target;
    if (diff < 0) return 'bg-rose-500';
    if (diff === 0) return 'bg-amber-400';
    return 'bg-emerald-400';
  };
  const start = new Date(shift.start_time);
  const end = new Date(shift.end_time);
  const durationHours = Math.max((end.getTime() - start.getTime()) / 3_600_000, 0);
  const duration = durationHours.toFixed(1);
  const formattedTime = `${start.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })} – ${end.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}`;

  const assigned = shift.assignments ?? [];
  const assignedCount = assignedCountOverride ?? assigned.length;
  const computedTarget = typeof targetStaff === 'number' ? targetStaff : shift.ratio_min ?? 1;
  const statusColorClass =
    statusDotColor === 'red'
      ? 'bg-rose-500'
      : statusDotColor === 'green'
      ? 'bg-emerald-400'
      : statusDotColor === 'yellow'
      ? 'bg-amber-400'
      : summarizeStatus(assignedCount, computedTarget);

  return (
    <article className="rounded-2xl border border-white/5 bg-gradient-to-br from-slate-950/40 to-slate-900/60 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2 text-xs uppercase tracking-[0.4em] text-slate-400">
        <div className="flex items-center gap-2">
          <span className={`h-2.5 w-2.5 rounded-full ${statusColorClass}`} aria-hidden />
          <span>{shift.site}</span>
        </div>
        <div className="flex items-center gap-2">
          {ratioLabel && <span className="text-emerald-300">Ratio {ratioLabel}</span>}
          {!ratioLabel && <span className="text-emerald-300">Ratio {shift.ratio_min ?? 1}</span>}
          {typeof targetStaff === 'number' && (
            <span className="text-[11px] text-slate-300">
              {assignedCount}/{targetStaff} filled
            </span>
          )}
          {shift.openShift && <StatusChip label="Open" color="#f97316" />}
        </div>
      </div>
      <div className="mt-2 flex items-center justify-between gap-3">
        <div>
          <p className="text-sm text-slate-400">{displayLabel ?? shift.site}</p>
          <p className="text-lg font-semibold text-white">{formattedTime}</p>
        </div>
        <p className="text-xs text-slate-400">{duration}h</p>
      </div>
      <StaffList
        assignments={assigned}
        staffById={staffById}
        fallbackRole={shift.role}
        allowRemove={isAdmin && Boolean(onRemoveAssignment)}
        onRemoveAssignment={onRemoveAssignment}
      />
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

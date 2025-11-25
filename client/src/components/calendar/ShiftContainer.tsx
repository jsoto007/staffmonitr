import clsx from 'clsx';
import { useMemo } from 'react';

import { ShiftBlock } from './ShiftBlock';
import type { ShiftEvent, ShiftTemplate, StaffMember } from '../../types';
import { SHIFT_WINDOW_COLOR_SCHEMES } from '../../constants/shiftWindows';
import { computeStaffNeeded } from '../../utils/shiftTemplates';

type DayStatus = 'red' | 'yellow' | 'green';

const STATUS_CLASSES: Record<DayStatus, string> = {
  red: 'bg-rose-500',
  yellow: 'bg-amber-400',
  green: 'bg-emerald-400',
};

const summarizeStatus = (assigned: number, target: number): DayStatus => {
  const diff = assigned - target;
  if (diff < 0) {
    return 'red';
  }
  if (diff === 0) {
    return 'yellow';
  }
  return 'green';
};

interface ShiftContainerProps {
  template: ShiftTemplate;
  shifts: ShiftEvent[];
  staffById: Record<string, StaffMember>;
  isAdmin: boolean;
  onRequestCoverage: (shift: ShiftEvent) => void;
  onAssignStaff?: (shift: ShiftEvent) => void;
  onAssignTemplate?: (template: ShiftTemplate) => void;
  onRemoveAssignment?: (assignmentId: string) => void;
}

export const ShiftContainer = ({
  template,
  shifts,
  staffById,
  isAdmin,
  onRequestCoverage,
  onAssignStaff,
  onAssignTemplate,
  onRemoveAssignment,
}: ShiftContainerProps) => {
  const accentColor = template.color ?? SHIFT_WINDOW_COLOR_SCHEMES[template.order % SHIFT_WINDOW_COLOR_SCHEMES.length].accent;
  const sortedShifts = useMemo(
    () =>
      shifts
        .slice()
        .sort((a, b) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime()),
    [shifts],
  );
  const assignmentCount = sortedShifts.reduce((total, shift) => total + (shift.assignments?.length ?? 0), 0);
  const defaultTarget = template.ratio_staff && template.ratio_staff > 0 ? template.ratio_staff : 1;
  const totalTarget = sortedShifts.length
    ? sortedShifts.reduce((total, shift) => {
        const { target } = computeStaffNeeded(shift, template);
        return total + target;
      }, 0)
    : defaultTarget;
  const status = summarizeStatus(assignmentCount, totalTarget);

  return (
    <section
      className={clsx(
        'rounded-3xl border border-white/10 bg-slate-900/60 p-4 shadow-inner shadow-black/40',
      )}
    >
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-[0.3em] text-slate-400">{template.label || `Shift ${template.order + 1}`}</p>
          <p className="text-lg font-semibold text-white">
            {template.start_time} – {template.end_time}
          </p>
          <p className="text-xs text-slate-400">
            Ratio {template.ratio_staff ?? 1}:{template.ratio_kids ?? 4}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span
            className={clsx('h-3 w-3 rounded-full border border-white/20', STATUS_CLASSES[status])}
            aria-label={status}
          />
          <span
            className="h-3 w-3 rounded-full border border-white/20"
            aria-hidden
            style={{ backgroundColor: accentColor }}
          />
          <span className="text-[11px] text-slate-400">{assignmentCount} assigned</span>
          {totalTarget > 0 && (
            <span className="text-[11px] text-slate-400">Target {totalTarget}</span>
          )}
        </div>
      </div>
      <div className="mt-3 space-y-3">
        {sortedShifts.length === 0 ? (
          <div
            role="button"
            tabIndex={0}
            onClick={() => onAssignTemplate?.(template)}
            onKeyDown={(event) => {
              if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault();
                onAssignTemplate?.(template);
              }
            }}
            className="flex flex-col gap-3 rounded-3xl border border-dashed border-white/10 bg-slate-900/60 px-4 py-5 text-sm text-slate-400 transition hover:border-white/30 hover:bg-slate-900/70 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500 focus-visible:ring-1 focus-visible:ring-brand-500"
          >
            <div className="flex items-center justify-between gap-2">
              <p className="font-semibold uppercase tracking-[0.3em] text-[10px] text-slate-400">No shifts yet</p>
              <span className="text-xs font-semibold uppercase tracking-[0.3em] text-white">Add staff</span>
            </div>
            <div className="rounded-2xl border border-white/5 bg-slate-950/40 px-4 py-3 text-sm text-slate-400">
              Click to open the staff cart and assign coverage for this segment.
            </div>
          </div>
        ) : (
          sortedShifts.map((shift) => (
            <ShiftBlock
              key={shift.id}
              shift={shift}
              staffById={staffById}
              isAdmin={isAdmin}
              onRequestCoverage={onRequestCoverage}
              onAssignStaff={onAssignStaff}
              onRemoveAssignment={onRemoveAssignment}
              accentColor={accentColor}
              {...(() => {
                const { target, ratioLabel } = computeStaffNeeded(shift, template);
                const assignedCount = shift.assignments?.length ?? 0;
                return {
                  ratioLabel,
                  targetStaff: target,
                  assignedCountOverride: assignedCount,
                  statusDotColor: summarizeStatus(assignedCount, target),
                  displayLabel: template.label || shift.site,
                };
              })()}
            />
          ))
        )}
      </div>
    </section>
  );
};

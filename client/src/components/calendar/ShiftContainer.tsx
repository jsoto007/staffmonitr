import clsx from 'clsx';
import { useMemo } from 'react';

import { ShiftBlock } from './ShiftBlock';
import type { ShiftEvent, ShiftTemplate, StaffMember } from '../../types';
import { SHIFT_WINDOW_COLOR_SCHEMES } from '../../constants/shiftWindows';

interface ShiftContainerProps {
  template: ShiftTemplate;
  shifts: ShiftEvent[];
  staffById: Record<string, StaffMember>;
  isAdmin: boolean;
  onRequestCoverage: (shift: ShiftEvent) => void;
}

export const ShiftContainer = ({ template, shifts, staffById, isAdmin, onRequestCoverage }: ShiftContainerProps) => {
  const accentColor = template.color ?? SHIFT_WINDOW_COLOR_SCHEMES[template.order % SHIFT_WINDOW_COLOR_SCHEMES.length].accent;
  const sortedShifts = useMemo(
    () =>
      shifts
        .slice()
        .sort((a, b) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime()),
    [shifts],
  );
  const assignmentCount = sortedShifts.reduce((total, shift) => total + (shift.assignments?.length ?? 0), 0);

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
        </div>
        <div className="flex items-center gap-2">
          <span
            className="h-3 w-3 rounded-full border border-white/20"
            aria-hidden
            style={{ backgroundColor: accentColor }}
          />
          <span className="text-[11px] text-slate-400">{assignmentCount} assigned</span>
        </div>
      </div>
      <div className="mt-3 space-y-3">
        {sortedShifts.length === 0 ? (
          <p className="rounded-2xl border border-white/5 bg-white/5 px-4 py-5 text-sm text-slate-400">
            No shifts scheduled for this segment yet.
          </p>
        ) : (
          sortedShifts.map((shift) => (
            <ShiftBlock
              key={shift.id}
              shift={shift}
              staffById={staffById}
              isAdmin={isAdmin}
              onRequestCoverage={onRequestCoverage}
            />
          ))
        )}
      </div>
    </section>
  );
};

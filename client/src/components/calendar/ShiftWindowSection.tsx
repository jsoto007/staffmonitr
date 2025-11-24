import clsx from 'clsx';
import type { ShiftEvent, ShiftWindow } from '../../types';
import { ShiftCard } from './ShiftCard';
import { StatusChip } from '../StatusChip';
import { formatMinutesLabel } from '../../utils/time';
import { SHIFT_WINDOW_COLOR_SCHEMES } from '../../constants/shiftWindows';

interface ShiftWindowSectionProps {
  window: ShiftWindow;
  shifts: ShiftEvent[];
  isAdmin: boolean;
  onRequestCoverage?: (shift: ShiftEvent) => void;
  index: number;
  requestDisabled?: boolean;
}

export const ShiftWindowSection = ({
  window,
  shifts,
  isAdmin,
  onRequestCoverage,
  index,
}: ShiftWindowSectionProps) => {
  const colorScheme = SHIFT_WINDOW_COLOR_SCHEMES[index % SHIFT_WINDOW_COLOR_SCHEMES.length];
  const sectionId = `shift-window-${window.id}`;
  const durationLabel = `${formatMinutesLabel(window.start_minute)} – ${formatMinutesLabel(window.end_minute)}`;
  const totalAssignments = shifts.reduce((count, shift) => count + (shift.assignments?.length ?? 0), 0);

  return (
    <section
      id={sectionId}
      aria-labelledby={`${sectionId}-heading`}
      className={clsx(
        'rounded-3xl border bg-slate-950/60 p-4 ring-1 ring-white/5 shadow-inner shadow-black/25',
        'transition duration-300 hover:-translate-y-0.5 hover:ring-white/30',
        colorScheme.ring,
      )}
    >
      <div
        className={clsx(
          'flex flex-wrap items-center justify-between gap-2 rounded-2xl bg-gradient-to-r px-4 py-3 text-xs font-semibold uppercase tracking-[0.3em] text-white',
          colorScheme.gradient,
        )}
      >
        <div>
          <p id={`${sectionId}-heading`}>{window.name || `Shift ${index + 1}`}</p>
          <p className="text-[11px] text-slate-100/80">{durationLabel}</p>
        </div>
        <StatusChip label={`${totalAssignments} assignment${totalAssignments === 1 ? '' : 's'}`} color={colorScheme.accent} />
      </div>
      <div className="mt-4 space-y-4">
        {shifts.length === 0 ? (
          <p className="rounded-2xl border border-white/5 bg-white/5 px-4 py-5 text-sm text-slate-400">
            No shifts scheduled for this segment yet.
          </p>
        ) : (
          shifts
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
            ))
        )}
      </div>
    </section>
  );
};

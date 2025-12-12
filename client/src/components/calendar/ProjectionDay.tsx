import clsx from 'clsx';
import type { StaffMatrixCalendarEntry } from '../../types';

export interface ProjectionShiftGroup {
  key: string;
  label: string;
  subtitle?: string;
  timeRange: string;
  entries: StaffMatrixCalendarEntry[];
  isYouthCare: boolean;
  shiftType?: string | null;
}

interface ProjectionDayProps {
  date: Date;
  shiftGroups: ProjectionShiftGroup[];
  isAdmin: boolean;
  onAssignEntry: (entry: StaffMatrixCalendarEntry) => void;
  onRemoveAssignment?: (entry: StaffMatrixCalendarEntry) => void;
}

interface ShiftRowProps {
  entry: StaffMatrixCalendarEntry;
  isAdmin: boolean;
  onAssignEntry: (entry: StaffMatrixCalendarEntry) => void;
  onRemoveAssignment?: (entry: StaffMatrixCalendarEntry) => void;
}

const ShiftRow = ({ entry, isAdmin, onAssignEntry, onRemoveAssignment }: ShiftRowProps) => {
  const statusClasses = clsx(
    'rounded-full px-2 py-0.5 text-[10px] font-semibold',
    entry.is_open
      ? 'bg-rose-50 text-rose-700 dark:bg-rose-900/40 dark:text-rose-200'
      : 'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300',
  );

  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-white/5 bg-slate-950/60 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <p className="text-sm font-semibold text-white">{entry.staff_name ?? 'Vacant slot'}</p>
        <p className="text-xs text-slate-400">
          {entry.staff_role ?? entry.template_role ?? 'Staff'}
          {entry.template_label ? ` · ${entry.template_label}` : ''}
        </p>
      </div>
      <div className="flex flex-col items-start gap-2 text-xs uppercase tracking-[0.3em] sm:flex-row sm:items-center">
        <span className={statusClasses}>{entry.is_open ? 'Open' : 'Assigned'}</span>
        <span className="text-[11px] text-slate-400">
          {entry.start_time} – {entry.end_time}
        </span>
        {isAdmin && (
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => onAssignEntry(entry)}
              className="rounded-2xl border border-white/10 bg-white/5 px-3 py-1 text-[11px] font-semibold tracking-[0.4em] text-white transition hover:border-white/40"
            >
              Assign to shift
            </button>
            {!entry.is_open && entry.assignment_id && onRemoveAssignment && (
              <button
                type="button"
                onClick={() => onRemoveAssignment(entry)}
                className="rounded-2xl border border-white/10 px-3 py-1 text-[11px] font-semibold tracking-[0.4em] text-slate-400 transition hover:border-rose-400 hover:text-white"
              >
                Remove from shift
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

const ShiftSection = ({
  group,
  isAdmin,
  onAssignEntry,
  onRemoveAssignment,
}: {
  group: ProjectionShiftGroup;
  isAdmin: boolean;
  onAssignEntry: (entry: StaffMatrixCalendarEntry) => void;
  onRemoveAssignment?: (entry: StaffMatrixCalendarEntry) => void;
}) => {
  const hasAssignments = group.entries.some((entry) => !entry.is_open);
  const assignedCount = group.entries.filter((entry) => !entry.is_open).length;
  const openCount = group.entries.length - assignedCount;

  return (
    <article className="space-y-4 rounded-2xl border border-white/5 bg-slate-900/50 p-5">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-[11px] uppercase tracking-[0.5em] text-slate-500">{group.subtitle ?? 'Shift'}</p>
          <h3 className="text-lg font-semibold text-white">{group.label}</h3>
          <p className="text-xs text-slate-400">{group.timeRange}</p>
        </div>
        <div className="text-right text-[11px] uppercase tracking-[0.4em] text-slate-400">
          <p>{assignedCount} assigned</p>
          <p>{openCount} open</p>
        </div>
      </header>
      <div className="space-y-3">
        {!hasAssignments && (
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-400">No staff assigned</p>
        )}
        {group.entries.map((entry) => (
          <ShiftRow
            key={entry.id}
            entry={entry}
            isAdmin={isAdmin}
            onAssignEntry={onAssignEntry}
            onRemoveAssignment={onRemoveAssignment}
          />
        ))}
      </div>
    </article>
  );
};

export const ProjectionDay = ({ date, shiftGroups, isAdmin, onAssignEntry, onRemoveAssignment }: ProjectionDayProps) => {
  const totalPositions = shiftGroups.reduce((total, group) => total + group.entries.length, 0);

  return (
    <section className="space-y-6 rounded-3xl border border-white/10 bg-slate-950/50 p-6 shadow-inner shadow-black/40">
      <header className="flex flex-wrap items-baseline justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-[0.4em] text-slate-500">{date.toLocaleDateString([], { weekday: 'short' })}</p>
          <h2 className="text-2xl font-semibold text-white">{date.toLocaleDateString([], { month: 'long', day: 'numeric', year: 'numeric' })}</h2>
          <p className="text-sm text-slate-400">
            {shiftGroups.length} shift{shiftGroups.length === 1 ? '' : 'es'} · {totalPositions} position
            {totalPositions === 1 ? '' : 's'}
          </p>
        </div>
        <div className="text-xs uppercase tracking-[0.4em] text-slate-500">
          {totalPositions === 0 ? 'No coverage' : 'Staff matrix'}
        </div>
      </header>
      <div className="space-y-4">
        {shiftGroups.map((group) => (
          <ShiftSection
            key={group.key}
            group={group}
            isAdmin={isAdmin}
            onAssignEntry={onAssignEntry}
            onRemoveAssignment={onRemoveAssignment}
          />
        ))}
        {shiftGroups.length === 0 && (
          <p className="rounded-2xl border border-white/5 bg-white/5 px-4 py-5 text-sm text-slate-400">
            No shifts generated for this day.
          </p>
        )}
      </div>
    </section>
  );
};

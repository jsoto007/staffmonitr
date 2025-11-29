import clsx from 'clsx';
import type { StaffMatrixCalendarEntry } from '../../types';

interface CalendarDayProps {
  date: Date;
  entries: StaffMatrixCalendarEntry[];
  isAdmin: boolean;
  onAssignEntry: (entry: StaffMatrixCalendarEntry) => void;
  onRemoveAssignment?: (entry: StaffMatrixCalendarEntry) => void;
  showHeader?: boolean;
  className?: string;
}

const ENTRY_STATUS_LABEL = {
  open: 'Open',
  assigned: 'Filled',
} as const;

const formatEntryTime = (entry: StaffMatrixCalendarEntry) => `${entry.start_time} – ${entry.end_time}`;

export const CalendarDay = ({
  date,
  entries,
  isAdmin,
  onAssignEntry,
  onRemoveAssignment,
  showHeader = true,
  className,
}: CalendarDayProps) => {
  const sortedEntries = [...entries].sort((a, b) => a.start_minute - b.start_minute);

  return (
    <section className={clsx('space-y-4 rounded-3xl border border-white/10 bg-slate-950/50 p-4 shadow-inner shadow-black/40', className)}>
      {showHeader && (
        <header className="flex items-center justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.4em] text-slate-400">{date.toLocaleDateString([], { weekday: 'short' })}</p>
            <h2 className="text-lg font-semibold text-white">{date.toLocaleDateString([], { month: 'long', day: 'numeric', year: 'numeric' })}</h2>
          </div>
          <span className="text-xs text-slate-400">{sortedEntries.length} position{sortedEntries.length === 1 ? '' : 's'}</span>
        </header>
      )}

      {sortedEntries.length === 0 ? (
        <p className="rounded-2xl border border-white/5 bg-white/5 px-4 py-5 text-sm text-slate-400">No positions scheduled for this day.</p>
      ) : (
        <div className="space-y-3">
          {sortedEntries.map((entry) => (
            <article key={entry.id} className="rounded-2xl border border-white/10 bg-slate-900/60 p-4">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-xs uppercase tracking-[0.4em] text-slate-400">{entry.template_label}</p>
                  <p className="text-lg font-semibold text-white">{formatEntryTime(entry)}</p>
                  <p className="text-xs text-slate-500">
                    {entry.shift_type ?? entry.template_role ?? 'Staff'}
                    {entry.template_notes ? ` · ${entry.template_notes}` : ''}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <span
                    className={clsx(
                      'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold',
                      entry.is_open ? 'bg-rose-50 text-rose-700 dark:bg-rose-900/40 dark:text-rose-200' : 'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300',
                    )}
                  >
                    {entry.is_open ? 'Open' : 'Assigned'}
                  </span>
                  <p className="text-xs text-slate-400">{ENTRY_STATUS_LABEL[entry.is_open ? 'open' : 'assigned']}</p>
                </div>
              </div>
              <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
                <p className="text-sm text-slate-300">
                  {entry.staff_name ?? 'Vacant'}
                  {entry.staff_role ? ` · ${entry.staff_role}` : ''}
                </p>
                {isAdmin && (
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={() => onAssignEntry(entry)}
                      className="rounded-2xl border border-white/10 bg-white/5 px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.4em] text-white transition hover:border-white/40"
                    >
                      Assign staff
                    </button>
                    {!entry.is_open && entry.assignment_id && onRemoveAssignment && (
                      <button
                        type="button"
                        onClick={() => onRemoveAssignment(entry)}
                        className="rounded-2xl border border-white/10 px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.4em] text-slate-400 transition hover:border-rose-400 hover:text-white"
                      >
                        Unassign
                      </button>
                    )}
                  </div>
                )}
              </div>
            </article>
          ))}
        </div>
      )}
    </section>
  );
};

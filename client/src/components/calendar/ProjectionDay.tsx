import { ClockIcon, UserIcon } from '@heroicons/react/24/outline';
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

interface ShiftEntryProps {
  entry: StaffMatrixCalendarEntry;
  isAdmin: boolean;
  onAssignEntry: (entry: StaffMatrixCalendarEntry) => void;
  onRemoveAssignment?: (entry: StaffMatrixCalendarEntry) => void;
}

type ShiftStyleKey = 'Night' | 'Morning' | 'Evening';

const SHIFT_THEME: Record<ShiftStyleKey | 'default', { row: string; icon: string }> = {
  Night: { row: 'bg-indigo-50', icon: 'text-indigo-600' },
  Morning: { row: 'bg-amber-50', icon: 'text-amber-500' },
  Evening: { row: 'bg-purple-50', icon: 'text-purple-600' },
  default: { row: 'bg-slate-50', icon: 'text-slate-500' },
};

const SHIFT_STYLE_KEYS: ShiftStyleKey[] = ['Night', 'Morning', 'Evening'];

const getShiftTheme = (value?: string | null) => {
  if (!value) {
    return SHIFT_THEME.default;
  }
  const normalized = value.trim().toLowerCase();
  const matchedKey = SHIFT_STYLE_KEYS.find((key) => normalized.includes(key.toLowerCase()));
  return SHIFT_THEME[matchedKey ?? 'default'];
};

const ShiftEntry = ({ entry, isAdmin, onAssignEntry, onRemoveAssignment }: ShiftEntryProps) => {
  const roleLabel = entry.staff_role ?? entry.template_role ?? 'Staff';
  const statusLabel = entry.is_open ? 'Open slot' : 'Assigned';
  const statusClass = entry.is_open ? 'text-rose-500' : 'text-emerald-500';

  return (
    <div className="flex flex-col gap-2 rounded-2xl border border-slate-100 bg-white/80 px-3 py-2 text-slate-900">
      <div className="flex items-center gap-2">
        <UserIcon className="h-4 w-4 text-slate-400" />
        <div>
          <p className="text-sm font-semibold">{entry.staff_name ?? 'Vacant slot'}</p>
          <p className="text-[11px] uppercase tracking-[0.3em] text-slate-500">{roleLabel}</p>
        </div>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] uppercase tracking-[0.3em]">
        <span className={statusClass}>{statusLabel}</span>
        {isAdmin &&
          (entry.is_open ? (
            <button
              type="button"
              onClick={() => onAssignEntry(entry)}
              className="rounded-full border border-slate-300 px-3 py-1 text-[11px] font-semibold tracking-[0.5em] text-slate-700 transition hover:border-slate-400 hover:text-slate-900"
            >
              Assign
            </button>
          ) : (
            entry.assignment_id &&
            onRemoveAssignment && (
              <button
                type="button"
                onClick={() => onRemoveAssignment(entry)}
                className="rounded-full border border-rose-200 px-3 py-1 text-[11px] font-semibold tracking-[0.5em] text-rose-500 transition hover:border-rose-400 hover:text-rose-600"
              >
                Remove
              </button>
            )
          ))}
      </div>
    </div>
  );
};

export const ProjectionDay = ({
  date,
  shiftGroups,
  isAdmin,
  onAssignEntry,
  onRemoveAssignment,
}: ProjectionDayProps) => {
  const totalPositions = shiftGroups.reduce((total, group) => total + group.entries.length, 0);
  const assignedCount = shiftGroups.reduce(
    (total, group) => total + group.entries.filter((entry) => !entry.is_open).length,
    0,
  );
  const openCount = totalPositions - assignedCount;

  return (
    <section className="flex-shrink-0 w-96 rounded-3xl border border-slate-200 bg-white shadow-lg shadow-black/10 text-slate-900">
      <div className="bg-gradient-to-r from-slate-700 to-slate-600 px-6 py-5">
        <p className="text-[11px] uppercase tracking-[0.5em] text-slate-200">
          {date.toLocaleDateString([], { weekday: 'short' })}
        </p>
        <h2 className="text-2xl font-semibold text-white">
          {date.toLocaleDateString([], { month: 'long', day: 'numeric', year: 'numeric' })}
        </h2>
        <p className="text-sm text-slate-100">
          {shiftGroups.length} shift{shiftGroups.length === 1 ? '' : 's'} · {totalPositions} position
          {totalPositions === 1 ? '' : 's'}
        </p>
        <p className="text-[11px] uppercase tracking-[0.3em] text-slate-300">
          {assignedCount} assigned · {openCount} open
        </p>
      </div>
      <div className="p-5">
        <div className="overflow-x-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-slate-200">
                <th className="text-left py-3 px-4 text-[11px] font-semibold uppercase tracking-[0.4em] text-slate-500">
                  Shift
                </th>
                <th className="text-left py-3 px-4 text-[11px] font-semibold uppercase tracking-[0.4em] text-slate-500">
                  Staff Assigned
                </th>
              </tr>
            </thead>
            <tbody>
              {shiftGroups.length === 0 ? (
                <tr>
                  <td colSpan={2} className="py-4 px-4 text-sm text-slate-500">
                    No shifts generated for this day.
                  </td>
                </tr>
              ) : (
                shiftGroups.map((group) => {
                  const shiftIdentifier = group.shiftType ?? group.label;
                  const theme = getShiftTheme(shiftIdentifier);
                  return (
                    <tr key={group.key} className={`border-b border-slate-100 ${theme.row}`}>
                      <td className="py-4 px-4 align-top">
                        <div className="flex items-start gap-2">
                          <ClockIcon className={`h-5 w-5 ${theme.icon}`} />
                          <div>
                            <div className="text-sm font-semibold text-slate-800">{group.label}</div>
                            <p className="text-[11px] text-slate-500">{group.timeRange}</p>
                            {group.subtitle && (
                              <p className="text-[10px] uppercase tracking-[0.4em] text-slate-400">
                                {group.subtitle}
                              </p>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="py-4 px-4">
                        <div className="space-y-2">
                          {group.entries.map((entry) => (
                            <ShiftEntry
                              key={entry.id}
                              entry={entry}
                              isAdmin={isAdmin}
                              onAssignEntry={onAssignEntry}
                              onRemoveAssignment={onRemoveAssignment}
                            />
                          ))}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
};

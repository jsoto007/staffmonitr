import { useMemo, useState } from 'react';
import type { ShiftEvent, StaffMember } from '../../types';

type DayStatus = 'red' | 'yellow' | 'green';

const STATUS_CLASSES: Record<DayStatus, string> = {
  red: 'bg-rose-500',
  yellow: 'bg-amber-400',
  green: 'bg-emerald-400',
};

const STATUS_LEGEND: { label: string; description: string; status: DayStatus }[] = [
  { label: 'Below target', description: 'More staffing needed to meet the ratio.', status: 'red' },
  { label: 'At target', description: 'Staffing exactly meets the target ratio.', status: 'yellow' },
  { label: 'Above target', description: 'At least one extra staff member is scheduled.', status: 'green' },
];

const buildMonthGrid = (focus: Date) => {
  const year = focus.getFullYear();
  const month = focus.getMonth();
  const firstOfMonth = new Date(year, month, 1);
  const lastOfMonth = new Date(year, month + 1, 0);
  const gridStart = new Date(firstOfMonth);
  gridStart.setDate(gridStart.getDate() - gridStart.getDay());

  const weeks = Math.ceil((firstOfMonth.getDay() + lastOfMonth.getDate()) / 7);
  const totalDays = weeks * 7;

  return Array.from({ length: totalDays }).map((_, index) => {
    const date = new Date(gridStart);
    date.setDate(gridStart.getDate() + index);
    return date;
  });
};

const summarizeDayStatus = (dayShifts: ShiftEvent[]): DayStatus => {
  if (!dayShifts.length) {
    return 'yellow';
  }
  const totalTarget = dayShifts.reduce((sum, shift) => sum + (shift.ratio_min ?? 1), 0);
  const totalAssigned = dayShifts.reduce((sum, shift) => sum + (shift.assignments?.length ?? 0), 0);
  const diff = totalAssigned - totalTarget;
  if (diff < 0) {
    return 'red';
  }
  if (diff === 0) {
    return 'yellow';
  }
  return 'green';
};

const formatShiftTime = (shift: ShiftEvent) => {
  const start = new Date(shift.start_time);
  const end = new Date(shift.end_time);
  return `${start.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })} – ${end.toLocaleTimeString([], {
    hour: 'numeric',
    minute: '2-digit',
  })}`;
};

interface MonthViewProps {
  monthDate: Date;
  shifts: ShiftEvent[];
  staffMembers: StaffMember[];
  isAdmin: boolean;
  onRequestCoverage: (shift: ShiftEvent) => void;
}

export const MonthView = ({ monthDate, shifts, staffMembers, isAdmin, onRequestCoverage }: MonthViewProps) => {
  const [activeDate, setActiveDate] = useState<Date | null>(null);

  const gridDates = useMemo(() => buildMonthGrid(monthDate), [monthDate]);

  const staffById = useMemo(() => {
    const lookup: Record<string, StaffMember> = {};
    staffMembers.forEach((member) => {
      lookup[member.id] = member;
    });
    return lookup;
  }, [staffMembers]);

  const { shiftsByDate, dayStatusByDate } = useMemo(() => {
    const shiftsMap = new Map<string, ShiftEvent[]>();
    shifts.forEach((shift) => {
      const key = new Date(shift.start_time).toDateString();
      const bucket = shiftsMap.get(key) ?? [];
      bucket.push(shift);
      shiftsMap.set(key, bucket);
    });
    const statusMap = new Map<string, DayStatus>();
    shiftsMap.forEach((dayShifts, key) => {
      statusMap.set(key, summarizeDayStatus(dayShifts));
    });
    return { shiftsByDate: shiftsMap, dayStatusByDate: statusMap };
  }, [shifts]);

  const selectedKey = activeDate?.toDateString() ?? '';
  const selectedShifts = selectedKey ? shiftsByDate.get(selectedKey) ?? [] : [];
  const selectedStatus = selectedKey ? dayStatusByDate.get(selectedKey) ?? 'yellow' : 'yellow';
  const sortedShifts = useMemo(
    () =>
      [...selectedShifts].sort(
        (a, b) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime(),
      ),
    [selectedShifts],
  );

  const handleDayClick = (date: Date) => {
    setActiveDate(date);
  };

  const closeModal = () => setActiveDate(null);

  return (
    <>
      <div className="grid grid-cols-7 gap-2 text-xs uppercase tracking-[0.4em] text-slate-400">
        {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((label) => (
          <div key={label} className="text-center text-[11px] font-semibold">
            {label}
          </div>
        ))}
        {gridDates.map((date) => {
          const dateKey = date.toDateString();
          const status = dayStatusByDate.get(dateKey) ?? 'yellow';
          const isCurrentMonth = date.getMonth() === monthDate.getMonth();
          return (
            <button
              key={date.toISOString()}
              type="button"
              onClick={() => handleDayClick(date)}
              className={`relative flex h-24 w-full flex-col justify-between rounded-2xl border p-3 text-left transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500 ${
                isCurrentMonth
                  ? 'border-white/10 bg-slate-900/60'
                  : 'border-white/5 bg-slate-950/40 opacity-60'
              }`}
              aria-label={`${date.toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' })} · ${
                (shiftsByDate.get(dateKey) ?? []).length
              } shifts`}
            >
              <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                <span className="text-sm font-semibold leading-none text-white">{date.getDate()}</span>
                <span
                  className={`h-3 w-3 rounded-full border border-white/30 ${STATUS_CLASSES[status]}`}
                  aria-hidden="true"
                />
              </div>
            </button>
          );
        })}
      </div>

      {activeDate && (
        <div
          className="fixed inset-0 z-40 overflow-y-auto bg-black/60 px-4 py-10 sm:px-6"
          role="dialog"
          aria-modal="true"
          aria-label={`Shifts for ${activeDate.toLocaleDateString([], { month: 'long', day: 'numeric', year: 'numeric' })}`}
          onClick={closeModal}
        >
          <div
            className="mx-auto max-w-4xl overflow-hidden rounded-3xl border border-white/10 bg-slate-950/95 shadow-2xl shadow-black/60"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex flex-col gap-2 border-b border-white/5 px-6 py-5 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-xs uppercase tracking-[0.4em] text-slate-400">Daily projection</p>
                <h2 className="text-xl font-semibold text-white">
                  {activeDate.toLocaleDateString([], { month: 'long', day: 'numeric', year: 'numeric' })}
                </h2>
              </div>
              <div className="flex items-center gap-2">
                <span className={`h-3 w-3 rounded-full ${STATUS_CLASSES[selectedStatus]}`} />
                <p className="text-sm text-slate-300">{STATUS_LEGEND.find((item) => item.status === selectedStatus)?.label}</p>
                <button
                  type="button"
                  onClick={closeModal}
                  className="rounded-2xl border border-white/20 px-3 py-1 text-xs font-semibold uppercase tracking-[0.4em] text-slate-300 transition hover:border-white/50 hover:text-white sm:px-4 sm:py-2"
                >
                  Close
                </button>
              </div>
            </div>

            <div className="max-h-[70vh] space-y-6 overflow-y-auto px-6 py-5">
              {sortedShifts.length === 0 ? (
                <p className="text-sm text-slate-400">No shifts scheduled for this day.</p>
              ) : (
                sortedShifts.map((shift) => (
                    <div
                      key={shift.id}
                      className="space-y-3 rounded-2xl border border-white/10 bg-slate-900/60 p-4 shadow-inner shadow-black/50"
                    >
                      <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                        <div>
                          <p className="text-xs uppercase tracking-[0.4em] text-slate-400">{shift.site}</p>
                          <h3 className="text-lg font-semibold text-white">{formatShiftTime(shift)}</h3>
                        </div>
                        <div className="flex items-center gap-2 text-xs text-slate-400">
                          <span>Ratio {shift.ratio_min ?? 1}</span>
                          <span>Role · {shift.role}</span>
                          {isAdmin && (
                            <button
                              type="button"
                              onClick={() => onRequestCoverage(shift)}
                              className="rounded-full border border-white/20 bg-white/5 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.3em] text-white transition hover:border-white/60"
                            >
                              Request coverage
                            </button>
                          )}
                        </div>
                      </div>

                      <div className="space-y-2">
                        {shift.assignments.length === 0 ? (
                          <p className="text-sm text-slate-400">No staff assigned yet.</p>
                        ) : (
                          shift.assignments.map((assignment) => {
                            const staffName =
                              assignment.staff_id && staffById[assignment.staff_id]
                                ? staffById[assignment.staff_id].full_name
                                : assignment.staff_id
                                ? assignment.staff_id
                                : 'Unassigned slot';
                            return (
                              <div
                                key={assignment.id}
                                className="flex flex-col gap-1 rounded-2xl border border-white/5 bg-white/5 p-3 text-sm text-slate-200 sm:flex-row sm:items-center sm:justify-between"
                              >
                                <div>
                                  <p className="text-sm font-semibold text-white">{staffName}</p>
                                  <p className="text-xs text-slate-400">
                                    {assignment.title} · Difficulty {assignment.difficulty}
                                  </p>
                                </div>
                                <span className="text-[11px] uppercase tracking-[0.4em] text-slate-500">
                                  {assignment.staffRole ?? shift.role}
                                </span>
                              </div>
                            );
                          })
                        )}
                      </div>
                    </div>
                  ))
              )}

              <div className="space-y-4">
                <h3 className="text-sm font-semibold uppercase tracking-[0.4em] text-slate-400">Status legend</h3>
                <div className="grid gap-3 sm:grid-cols-3">
                  {STATUS_LEGEND.map((item) => (
                    <div key={item.status} className="flex items-start gap-2 rounded-2xl border border-white/5 bg-slate-900/50 p-3">
                      <span className={`mt-1 h-3 w-3 rounded-full ${STATUS_CLASSES[item.status]}`} />
                      <div>
                        <p className="text-sm font-semibold text-white">{item.label}</p>
                        <p className="text-xs text-slate-400">{item.description}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

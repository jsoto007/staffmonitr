import { useMemo, useState } from 'react';
import type { ShiftEvent, ShiftTemplate, StaffMember } from '../../types';

import { CalendarDay } from './CalendarDay';
import { computeStaffNeeded, shiftMatchesTemplate } from '../../utils/shiftTemplates';

type DayStatus = 'red' | 'yellow' | 'green';
type ShiftIndicator = { id: string; color: string; status: 'met' | 'partial' | 'missing'; target: number; assigned: number };

const STATUS_CLASSES: Record<DayStatus, string> = {
  red: 'bg-rose-500',
  yellow: 'bg-amber-400',
  green: 'bg-emerald-400',
};

const DOT_FALLBACK_COLOR = '#94a3b8';
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

const summarizeDayStatus = (
  dayShifts: ShiftEvent[],
  shiftTemplates: ShiftTemplate[],
  date: Date,
  startOfToday: Date,
): DayStatus => {
  const considerTemplates = date >= startOfToday;
  const matchedShiftIds = new Set<string>();
  let totalTarget = 0;
  let totalAssigned = 0;

  if (considerTemplates && shiftTemplates.length > 0) {
    const orderedTemplates = [...shiftTemplates].sort((a, b) => a.order - b.order);
    orderedTemplates.forEach((template) => {
      const matchingShifts = dayShifts.filter((shift) => shiftMatchesTemplate(shift, template));
      if (matchingShifts.length === 0) {
        totalTarget += template.ratio_staff && template.ratio_staff > 0 ? template.ratio_staff : 1;
        return;
      }
      matchingShifts.forEach((shift) => {
        matchedShiftIds.add(shift.id);
        const { target } = computeStaffNeeded(shift, template);
        totalTarget += target;
        totalAssigned += shift.assignments?.length ?? 0;
      });
    });
  }

  dayShifts.forEach((shift) => {
    if (matchedShiftIds.has(shift.id)) {
      return;
    }
    totalTarget += shift.ratio_min ?? 1;
    totalAssigned += shift.assignments?.length ?? 0;
  });

  if (totalTarget === 0) {
    return 'yellow';
  }
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
  shiftTemplates: ShiftTemplate[];
  staffMembers: StaffMember[];
  isAdmin: boolean;
  onRequestCoverage: (shift: ShiftEvent) => void;
  onAssignStaff?: (shift: ShiftEvent) => void;
  onAssignTemplate?: (template: ShiftTemplate, date: Date) => void;
  onRemoveAssignment?: (assignmentId: string) => void;
}

export const MonthView = ({
  monthDate,
  shifts,
  shiftTemplates,
  staffMembers,
  isAdmin,
  onRequestCoverage,
  onAssignStaff,
  onAssignTemplate,
  onRemoveAssignment,
}: MonthViewProps) => {
  const [activeDate, setActiveDate] = useState<Date | null>(null);
  const gridDates = useMemo(() => buildMonthGrid(monthDate), [monthDate]);
  const orderedTemplates = useMemo(
    () => [...shiftTemplates].sort((a, b) => a.order - b.order),
    [shiftTemplates],
  );

  const shiftsByDate = useMemo(() => {
    const map = new Map<string, ShiftEvent[]>();
    shifts.forEach((shift) => {
      const key = new Date(shift.start_time).toDateString();
      const bucket = map.get(key) ?? [];
      bucket.push(shift);
      map.set(key, bucket);
    });
    return map;
  }, [shifts]);

  const dayStatusByDate = useMemo(() => {
    const statusMap = new Map<string, DayStatus>();
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    gridDates.forEach((date) => {
      const key = date.toDateString();
      const dayShifts = shiftsByDate.get(key) ?? [];
      statusMap.set(key, summarizeDayStatus(dayShifts, shiftTemplates, date, today));
    });
    return statusMap;
  }, [gridDates, shiftTemplates, shiftsByDate]);

  const shiftDotsByDate = useMemo(() => {
    const map = new Map<string, ShiftIndicator[]>();
    shiftsByDate.forEach((dayShifts, key) => {
      const sortedShifts = [...dayShifts].sort(
        (a, b) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime(),
      );
      const dots = sortedShifts.map((shift) => {
        const matchedTemplate = orderedTemplates.find((template) => shiftMatchesTemplate(shift, template));
        const { target } = computeStaffNeeded(shift, matchedTemplate ?? null);
        const assigned = shift.assignments?.length ?? 0;
        let status: ShiftIndicator['status'] = 'missing';
        let color = matchedTemplate?.color || DOT_FALLBACK_COLOR;
        if (target > 0) {
          if (assigned >= target) {
            status = 'met';
            color = '#22c55e';
          } else if (assigned > 0) {
            status = 'partial';
            color = '#fbbf24';
          } else {
            status = 'missing';
            color = '#f87171';
          }
        }
        return { id: shift.id, color, status, target, assigned };
      });
      map.set(key, dots);
    });
    return map;
  }, [orderedTemplates, shiftsByDate]);

  const staffById = useMemo(() => {
    const lookup: Record<string, StaffMember> = {};
    staffMembers.forEach((staff) => {
      lookup[staff.id] = staff;
    });
    return lookup;
  }, [staffMembers]);

  const selectedDateKey = activeDate?.toDateString() ?? '';
  const selectedShifts = selectedDateKey ? shiftsByDate.get(selectedDateKey) ?? [] : [];
  const selectedStatus = selectedDateKey ? dayStatusByDate.get(selectedDateKey) ?? 'yellow' : 'yellow';

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
          const shiftDots = shiftDotsByDate.get(dateKey) ?? [];
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
                <span className={`h-3 w-3 rounded-full border border-white/30 ${STATUS_CLASSES[status]}`} aria-hidden />
              </div>
              {shiftDots.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {shiftDots.map((dot) => (
                    <span
                      key={dot.id}
                      className="h-1.5 w-1.5 rounded-full ring-1 ring-white/10"
                      style={{ backgroundColor: dot.color }}
                      title={
                        dot.target > 0
                          ? `${dot.assigned}/${dot.target} assigned`
                          : 'Shift'
                      }
                      aria-label={
                        dot.target > 0
                          ? `Shift ${dot.status === 'met' ? 'meets' : 'needs'} ratio ${dot.assigned}/${dot.target}`
                          : 'Shift'
                      }
                    />
                  ))}
                  <span className="sr-only">{`${shiftDots.length} shifts`}</span>
                </div>
              )}
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

            <div className="px-6 py-5">
              <CalendarDay
                date={activeDate}
                shifts={selectedShifts}
                shiftTemplates={shiftTemplates}
                staffMembers={staffMembers}
                isAdmin={isAdmin}
                onRequestCoverage={onRequestCoverage}
                onAssignStaff={onAssignStaff}
                onAssignTemplate={onAssignTemplate}
                onRemoveAssignment={onRemoveAssignment}
                showHeader={false}
              />
            </div>

            <div className="space-y-4 border-t border-white/5 px-6 py-5">
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
      )}
    </>
  );
};

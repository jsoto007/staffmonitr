import { useMemo, useState } from 'react';
import type { StaffMatrixCalendarEntry } from '../../types';

import { CalendarDay } from './CalendarDay';

type DayStatus = 'red' | 'yellow' | 'green';

const STATUS_CLASSES: Record<DayStatus, string> = {
  red: 'bg-rose-500',
  yellow: 'bg-amber-400',
  green: 'bg-emerald-400',
};

const STATUS_LEGEND: { label: string; description: string; status: DayStatus }[] = [
  { label: 'Below target', description: 'More staffing needed to meet the program position.', status: 'red' },
  { label: 'At target', description: 'All scheduled positions are filled.', status: 'green' },
  { label: 'No coverage', description: 'No positions scheduled for this day.', status: 'yellow' },
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

const dateKey = (date: Date) => date.toISOString().split('T')[0];

interface MonthViewProps {
  monthDate: Date;
  entries: StaffMatrixCalendarEntry[];
  entriesByDate: Map<string, StaffMatrixCalendarEntry[]>;
  isAdmin: boolean;
  onAssignEntry: (entry: StaffMatrixCalendarEntry) => void;
  onRemoveAssignment?: (entry: StaffMatrixCalendarEntry) => void;
}

export const MonthView = ({
  monthDate,
  entriesByDate,
  isAdmin,
  onAssignEntry,
  onRemoveAssignment,
}: MonthViewProps) => {
  const [activeDate, setActiveDate] = useState<Date | null>(null);
  const gridDates = useMemo(() => buildMonthGrid(monthDate), [monthDate]);

  const dayStatusByDate = useMemo(() => {
    const statusMap = new Map<string, DayStatus>();
    gridDates.forEach((date) => {
      const key = dateKey(date);
      const entries = entriesByDate.get(key) ?? [];
      let status: DayStatus = 'yellow';
      if (!entries.length) {
        status = 'yellow';
      } else if (entries.some((entry) => entry.is_open)) {
        status = 'red';
      } else {
        status = 'green';
      }
      statusMap.set(key, status);
    });
    return statusMap;
  }, [entriesByDate, gridDates]);

  const dotsByDate = useMemo(() => {
    const map = new Map<string, { id: string; color: string; status: 'filled' | 'open' }[]>();
    entries.forEach((entry) => {
      const key = entry.date;
      const bucket = map.get(key) ?? [];
      bucket.push({
        id: entry.id,
        color: entry.is_open ? '#f87171' : '#22c55e',
        status: entry.is_open ? 'open' : 'filled',
      });
      map.set(key, bucket);
    });
    return map;
  }, [entries]);

  const selectedEntries = activeDate ? entriesByDate.get(dateKey(activeDate)) ?? [] : [];
  const selectedStatus = activeDate
    ? dayStatusByDate.get(dateKey(activeDate)) ?? 'yellow'
    : 'yellow';

  return (
    <>
      <div className="grid grid-cols-7 gap-2 text-xs uppercase tracking-[0.4em] text-slate-400">
        {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((label) => (
          <div key={label} className="text-center text-[11px] font-semibold">
            {label}
          </div>
        ))}
        {gridDates.map((date) => {
          const key = dateKey(date);
          const status = dayStatusByDate.get(key) ?? 'yellow';
          const dots = dotsByDate.get(key) ?? [];
          const isCurrentMonth = date.getMonth() === monthDate.getMonth();
          return (
            <button
              key={date.toISOString()}
              type="button"
              onClick={() => setActiveDate(date)}
              className={`relative flex h-24 w-full flex-col justify-between rounded-2xl border p-3 text-left transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500 ${
                isCurrentMonth
                  ? 'border-white/10 bg-slate-900/60'
                  : 'border-white/5 bg-slate-950/40 opacity-60'
              }`}
              aria-label={`${date.toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' })} · ${dots.length} positions`}
            >
              <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                <span className="text-sm font-semibold leading-none text-white">{date.getDate()}</span>
                <span className={`h-3 w-3 rounded-full border border-white/30 ${STATUS_CLASSES[status]}`} aria-hidden />
              </div>
              {dots.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-1">
                  {dots.map((dot) => (
                    <span
                      key={dot.id}
                      className="h-1.5 w-1.5 rounded-full ring-1 ring-white/10"
                      style={{ backgroundColor: dot.color }}
                      aria-label={dot.status === 'open' ? 'Open position' : 'Filled position'}
                    />
                  ))}
                  <span className="sr-only">{dots.length} positions</span>
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
          aria-label={`Positions for ${activeDate.toLocaleDateString([], { month: 'long', day: 'numeric', year: 'numeric' })}`}
          onClick={() => setActiveDate(null)}
        >
          <div
            className="mx-auto max-w-4xl overflow-hidden rounded-3xl border border-white/10 bg-slate-950/95 shadow-2xl shadow-black/60"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex flex-col gap-2 border-b border-white/5 px-6 py-5 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-xs uppercase tracking-[0.4em] text-slate-400">Staff matrix</p>
                <h2 className="text-xl font-semibold text-white">
                  {activeDate.toLocaleDateString([], { month: 'long', day: 'numeric', year: 'numeric' })}
                </h2>
              </div>
              <div className="flex items-center gap-2">
                <span className={`h-3 w-3 rounded-full ${STATUS_CLASSES[selectedStatus]}`} aria-hidden />
                <p className="text-sm text-slate-300">{STATUS_LEGEND.find((item) => item.status === selectedStatus)?.label}</p>
                <button
                  type="button"
                  onClick={() => setActiveDate(null)}
                  className="rounded-2xl border border-white/20 px-3 py-1 text-xs font-semibold uppercase tracking-[0.4em] text-slate-300 transition hover:border-white/50 hover:text-white sm:px-4 sm:py-2"
                >
                  Close
                </button>
              </div>
            </div>

            <div className="px-6 py-5">
              <CalendarDay
                date={activeDate}
                entries={selectedEntries}
                isAdmin={isAdmin}
                onAssignEntry={onAssignEntry}
                onRemoveAssignment={onRemoveAssignment}
                showHeader={false}
              />
            </div>

            <div className="space-y-4 border-t border-white/5 px-6 py-5">
              <h3 className="text-sm font-semibold uppercase tracking-[0.4em] text-slate-400">Status legend</h3>
              <div className="grid gap-3 sm:grid-cols-3">
                {STATUS_LEGEND.map((item) => (
                  <div
                    key={item.status}
                    className="flex items-start gap-2 rounded-2xl border border-white/5 bg-slate-900/50 p-3"
                  >
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

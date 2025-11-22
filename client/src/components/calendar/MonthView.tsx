import type { ShiftEvent } from '../../types';

interface MonthViewProps {
  monthDate: Date;
  shifts: ShiftEvent[];
  isAdmin: boolean;
  onRequestCoverage: (shift: ShiftEvent) => void;
}

const buildGridDates = (focus: Date) => {
  const year = focus.getFullYear();
  const month = focus.getMonth();
  const firstOfMonth = new Date(year, month, 1);
  const startDay = new Date(firstOfMonth);
  startDay.setDate(firstOfMonth.getDate() - firstOfMonth.getDay());

  return Array.from({ length: 42 }).map((_, index) => {
    const date = new Date(startDay);
    date.setDate(startDay.getDate() + index);
    return date;
  });
};

export const MonthView = ({ monthDate, shifts, isAdmin, onRequestCoverage }: MonthViewProps) => {
  const gridDates = buildGridDates(monthDate);

  const shiftsByDate = gridDates.map((date) =>
    shifts.filter((shift) => new Date(shift.start_time).toDateString() === date.toDateString()),
  );

  return (
    <div className="grid grid-cols-7 gap-2 text-xs uppercase tracking-[0.4em] text-slate-400">
      {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((label) => (
        <div key={label} className="text-center text-[11px] font-semibold">
          {label}
        </div>
      ))}
      {gridDates.map((date, index) => {
        const isCurrentMonth = date.getMonth() === monthDate.getMonth();
        return (
          <div
            key={date.toISOString()}
            className={`flex flex-col gap-2 rounded-2xl border p-3 text-[11px] ${isCurrentMonth ? 'border-white/10 bg-slate-900/60' : 'border-white/5 bg-slate-950/40 opacity-70'}`}
          >
            <div className="flex items-center justify-between">
              <span className="text-[12px] font-semibold text-white">{date.getDate()}</span>
              <span className="text-emerald-300">{shiftsByDate[index].length}</span>
            </div>
            <div className="space-y-1">
              {shiftsByDate[index]
                .slice(0, 2)
                .map((shift) =>
                  isAdmin ? (
                    <button
                      key={shift.id}
                      onClick={() => onRequestCoverage(shift)}
                      className="w-full rounded-xl border border-white/10 bg-white/5 px-2 py-1 text-left text-[11px] text-slate-200 transition hover:border-white/30"
                    >
                      {new Date(shift.start_time).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}
                      {' · '}
                      {shift.site}
                    </button>
                  ) : (
                    <div key={shift.id} className="w-full rounded-xl border border-white/10 bg-white/5 px-2 py-1 text-[11px] text-slate-300">
                      <span>
                        {new Date(shift.start_time).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}
                        {' · '}
                        {shift.site}
                      </span>
                    </div>
                  ),
                )}
            </div>
            {shiftsByDate[index].length > 2 && (
              <p className="text-[10px] text-slate-400">+{shiftsByDate[index].length - 2} more</p>
            )}
          </div>
        );
      })}
    </div>
  );
};

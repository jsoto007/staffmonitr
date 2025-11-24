import clsx from 'clsx';
import { useMemo } from 'react';

import { ShiftContainer } from './ShiftContainer';
import { ShiftBlock } from './ShiftBlock';
import type { ShiftEvent, ShiftTemplate, StaffMember } from '../../types';
import { minutesOfDay, timeInputToMinutes } from '../../utils/time';

interface CalendarDayProps {
  date: Date;
  shifts: ShiftEvent[];
  shiftTemplates: ShiftTemplate[];
  staffMembers: StaffMember[];
  isAdmin: boolean;
  onRequestCoverage: (shift: ShiftEvent) => void;
  showHeader?: boolean;
  className?: string;
}

const shiftMatchesTemplate = (shift: ShiftEvent, template: ShiftTemplate) => {
  const shiftStart = minutesOfDay(new Date(shift.start_time));
  const templateStart = timeInputToMinutes(template.start_time);
  const templateEnd = timeInputToMinutes(template.end_time);
  if (templateStart === templateEnd) {
    return true;
  }
  if (templateStart < templateEnd) {
    return shiftStart >= templateStart && shiftStart < templateEnd;
  }
  return shiftStart >= templateStart || shiftStart < templateEnd;
};

export const CalendarDay = ({
  className,
  date,
  shifts,
  shiftTemplates,
  staffMembers,
  isAdmin,
  onRequestCoverage,
  showHeader = true,
}: CalendarDayProps) => {
  const staffLookup = useMemo(() => {
    const lookup: Record<string, StaffMember> = {};
    staffMembers.forEach((staff) => {
      lookup[staff.id] = staff;
    });
    return lookup;
  }, [staffMembers]);

  const grouped = useMemo(() => {
    const orderedTemplates = [...shiftTemplates].sort((a, b) => a.order - b.order);
    const templateMap = orderedTemplates.map((template) => ({ template, shifts: [] as ShiftEvent[] }));
    const unassigned: ShiftEvent[] = [];
    shifts.forEach((shift) => {
      const matched = orderedTemplates.find((template) => shiftMatchesTemplate(shift, template));
      if (matched) {
        const entry = templateMap.find((group) => group.template.id === matched.id);
        entry?.shifts.push(shift);
      } else {
        unassigned.push(shift);
      }
    });
    return { templateGroups: templateMap, unassigned };
  }, [shiftTemplates, shifts]);

  return (
    <section className={clsx('space-y-4 rounded-3xl border border-white/10 bg-slate-950/50 p-4 shadow-inner shadow-black/40', className)}>
      {showHeader && (
        <header className="flex items-center justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.4em] text-slate-400">{date.toLocaleDateString([], { weekday: 'short' })}</p>
            <h2 className="text-lg font-semibold text-white">
              {date.toLocaleDateString([], { month: 'long', day: 'numeric', year: 'numeric' })}
            </h2>
          </div>
          <span className="text-xs text-slate-400">{shifts.length} shift{shifts.length === 1 ? '' : 's'}</span>
        </header>
      )}

      {shiftTemplates.length > 0 ? (
        <div className="space-y-4">
          {grouped.templateGroups.map(({ template, shifts: segmentShifts }) => (
            <ShiftContainer
              key={template.id}
              template={template}
              shifts={segmentShifts}
              staffById={staffLookup}
              isAdmin={isAdmin}
              onRequestCoverage={onRequestCoverage}
            />
          ))}
          {grouped.unassigned.length > 0 && (
            <div className="rounded-3xl border border-dashed border-white/10 bg-slate-900/60 p-4">
              <p className="text-sm font-semibold text-white">Unassigned shifts</p>
              <p className="text-sm text-slate-400">These shifts do not match any defined segment.</p>
              <div className="mt-3 space-y-3">
                {grouped.unassigned
                  .slice()
                  .sort((a, b) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime())
                  .map((shift) => (
                    <ShiftBlock
                      key={shift.id}
                      shift={shift}
                      staffById={staffLookup}
                      isAdmin={isAdmin}
                      onRequestCoverage={onRequestCoverage}
                    />
                  ))}
              </div>
            </div>
          )}
        </div>
      ) : shifts.length === 0 ? (
        <p className="rounded-2xl border border-white/5 bg-white/5 px-4 py-5 text-sm text-slate-400">
          No shifts scheduled for this day.
        </p>
      ) : (
        <div className="space-y-3">
          {shifts
            .slice()
            .sort((a, b) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime())
            .map((shift) => (
              <ShiftBlock
                key={shift.id}
                shift={shift}
                staffById={staffLookup}
                isAdmin={isAdmin}
                onRequestCoverage={onRequestCoverage}
              />
            ))}
        </div>
      )}
    </section>
  );
};

import { useMemo } from 'react';
import { ClockIcon } from '@heroicons/react/24/outline';
import type { StaffMatrixCalendarEntry } from '../../types';
import { formatTo12Hour } from '../../utils/time';

export interface CoverageShiftDefinition {
  id: string;
  label: string;
  start_time: string;
  end_time: string;
  color?: string | null;
  order: number;
  category?: string;
  startMinute: number;
  endMinute: number;
}

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
  entries: StaffMatrixCalendarEntry[];
  coverageSegments: CoverageShiftDefinition[];
  isAdmin: boolean;
  onAssignEntry: (entry: StaffMatrixCalendarEntry) => void;
  onRemoveAssignment?: (entry: StaffMatrixCalendarEntry) => void;
}

interface ShiftEntryProps {
  entry: StaffMatrixCalendarEntry;
  isAdmin: boolean;
  onRemoveAssignment?: (entry: StaffMatrixCalendarEntry) => void;
}

const SHIFT_TYPE_ORDER = ['Morning', 'Evening', 'Night'];
const YOUTH_CARE_WORKER_LABEL = 'YCW';
const YOUTH_CARE_WORKER_SUBTITLE = 'YCW';

const isYouthCareWorkerRole = (role?: string | null) =>
  (role ?? '').trim().toLowerCase() === 'youth care worker';

const getShiftOrder = (shiftType?: string | null) => {
  if (!shiftType) {
    return Number.MAX_SAFE_INTEGER;
  }
  const index = SHIFT_TYPE_ORDER.indexOf(shiftType);
  return index === -1 ? Number.MAX_SAFE_INTEGER : index;
};

const createShiftGroups = (entries: StaffMatrixCalendarEntry[]): ProjectionShiftGroup[] => {
  const groups = new Map<string, ProjectionShiftGroup>();
  entries.forEach((entry) => {
    const isYouth = isYouthCareWorkerRole(entry.template_role);
    const baseLabel = isYouth
      ? entry.shift_type ?? entry.template_label ?? YOUTH_CARE_WORKER_LABEL
      : entry.template_label ?? entry.template_role ?? 'Shift';
    const timeRange = `${formatTo12Hour(entry.start_time)} – ${formatTo12Hour(entry.end_time)}`;
    const identifier = isYouth ? entry.shift_type ?? baseLabel : baseLabel;
    const key = `${identifier}::${entry.start_time}::${entry.end_time}`;
    const existing = groups.get(key);
    if (existing) {
      existing.entries.push(entry);
      return;
    }
    groups.set(key, {
      key,
      label: baseLabel,
      subtitle: isYouth ? YOUTH_CARE_WORKER_SUBTITLE : entry.template_role ?? undefined,
      timeRange,
      entries: [entry],
      isYouthCare: isYouth,
      shiftType: entry.shift_type ?? null,
    });
  });
  return Array.from(groups.values()).sort((a, b) => {
    if (a.isYouthCare || b.isYouthCare) {
      if (a.isYouthCare && b.isYouthCare) {
        const orderA = getShiftOrder(a.shiftType);
        const orderB = getShiftOrder(b.shiftType);
        if (orderA !== orderB) {
          return orderA - orderB;
        }
        return a.label.localeCompare(b.label);
      }
      return a.isYouthCare ? -1 : 1;
    }
    const minuteA = a.entries[0]?.start_minute ?? 0;
    const minuteB = b.entries[0]?.start_minute ?? 0;
    return minuteA - minuteB;
  });
};

const abbreviateRole = (value?: string | null) => {
  if (!value) {
    return '';
  }
  return value
    .split(/[\s/-]+/)
    .filter(Boolean)
    .map((segment) => segment[0])
    .join('')
    .toUpperCase();
};

const ShiftEntry = ({ entry, isAdmin, onRemoveAssignment }: ShiftEntryProps) => {
  const roleLabel = entry.staff_role ?? entry.template_role ?? 'Staff';
  const roleInitials = abbreviateRole(roleLabel);
  const statusClass = entry.is_open ? 'text-rose-500' : 'text-emerald-500';
  const statusLabel = entry.is_open ? 'Open' : 'Assigned';
  const occupantLabel = entry.staff_name ?? `${roleInitials} Vacant Slot`;
  const startLabel = formatTo12Hour(entry.start_time);
  const endLabel = formatTo12Hour(entry.end_time);

  return (
    <div className="flex items-center justify-between rounded-2xl border border-slate-200 bg-white/70 px-3 py-2 text-xs text-slate-700 shadow-sm shadow-slate-200/80">
      <div className="flex flex-col gap-1">
        <p className="text-sm font-semibold text-slate-900">{occupantLabel}</p>
        {entry.staff_name && roleInitials && (
          <p className="text-[10px] uppercase tracking-[0.3em] text-slate-500">{roleInitials}</p>
        )}
        <p className="text-[10px] text-slate-500">
          {startLabel} – {endLabel}
        </p>
      </div>
      <div className="flex flex-col items-end gap-1 text-[10px] uppercase tracking-[0.4em]">
        <span className={statusClass}>{statusLabel}</span>
        {!entry.is_open && isAdmin && entry.assignment_id && onRemoveAssignment && (
          <button
            type="button"
            onClick={() => onRemoveAssignment(entry)}
            className="rounded-full border border-rose-200 px-2 py-0.5 text-[10px] font-semibold text-rose-500 transition hover:border-rose-400 hover:text-rose-600"
          >
            Remove
          </button>
        )}
      </div>
    </div>
  );
};

const renderShiftGroups = (
  groups: ProjectionShiftGroup[],
  isAdmin: boolean,
  onAssignEntry: (entry: StaffMatrixCalendarEntry) => void,
  onRemoveAssignment?: (entry: StaffMatrixCalendarEntry) => void,
) =>
  groups.map((group) => {
    const openEntry = group.entries.find((entry) => entry.is_open);
    const assignEntry = openEntry ?? group.entries[0];
    const subtitle = group.subtitle ? abbreviateRole(group.subtitle) : 'Shift';

    return (
      <div
        key={group.key}
        className="rounded-2xl border border-slate-200 bg-slate-50/90 p-3 shadow-inner shadow-white/40"
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-[10px] uppercase tracking-[0.4em] text-slate-500">{subtitle}</p>
            <div className="flex items-center gap-1">
              <ClockIcon className="h-4 w-4 text-slate-500" />
              <span className="text-sm font-semibold text-slate-900">{group.label}</span>
            </div>
            <p className="text-[10px] text-slate-500">{group.timeRange}</p>
          </div>
          <button
            type="button"
            onClick={() => assignEntry && onAssignEntry(assignEntry)}
            disabled={!openEntry}
            className="rounded-2xl border border-slate-300 bg-white px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.4em] text-slate-600 transition enabled:hover:border-slate-400 enabled:hover:text-slate-900 disabled:cursor-not-allowed disabled:border-slate-200 disabled:text-slate-400"
          >
            + Staff
          </button>
        </div>
        <div className="mt-3 space-y-2">
          {group.entries.map((entry) => (
            <ShiftEntry
              key={entry.id}
              entry={entry}
              isAdmin={isAdmin}
              onRemoveAssignment={onRemoveAssignment}
            />
          ))}
        </div>
      </div>
    );
  });

interface CoverageSectionProps {
  segment: CoverageShiftDefinition;
  entries: StaffMatrixCalendarEntry[];
  isAdmin: boolean;
  onAssignEntry: (entry: StaffMatrixCalendarEntry) => void;
  onRemoveAssignment?: (entry: StaffMatrixCalendarEntry) => void;
}

interface CoverageSectionRecord {
  segment: CoverageShiftDefinition;
  entries: StaffMatrixCalendarEntry[];
}

interface CoverageData {
  sections: CoverageSectionRecord[];
  remainder: StaffMatrixCalendarEntry[];
}

const CoverageSection = ({
  segment,
  entries,
  isAdmin,
  onAssignEntry,
  onRemoveAssignment,
}: CoverageSectionProps) => {
  const timeRange = `${formatTo12Hour(segment.start_time)} – ${formatTo12Hour(segment.end_time)}`;
  const openEntry = entries.find((entry) => entry.is_open);
  const assignEntry = openEntry ?? entries[0];

  return (
    <div className="rounded-2xl border border-slate-200 bg-slate-50/90 p-3 shadow-inner shadow-white/40">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <span
              className="h-2 w-2 rounded-full border border-slate-200"
              style={segment.color ? { backgroundColor: segment.color } : undefined}
            />
            <p className="text-[10px] uppercase tracking-[0.4em] text-slate-500">{segment.label}</p>
          </div>
          <div className="flex items-center gap-1">
            <ClockIcon className="h-4 w-4 text-slate-500" />
            <span className="text-sm font-semibold text-slate-900">{timeRange}</span>
          </div>
        </div>
        {assignEntry && (
          <button
            type="button"
            onClick={() => assignEntry && onAssignEntry(assignEntry)}
            disabled={!openEntry}
            className="rounded-2xl border border-slate-300 bg-white px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.4em] text-slate-600 transition enabled:hover:border-slate-400 enabled:hover:text-slate-900 disabled:cursor-not-allowed disabled:border-slate-200 disabled:text-slate-400"
          >
            + Staff
          </button>
        )}
      </div>
      <div className="mt-3 space-y-2">
        {entries.length === 0 ? (
          <p className="text-xs text-slate-500">No staff secured for this shift.</p>
        ) : (
          entries.map((entry) => (
            <ShiftEntry
              key={entry.id}
              entry={entry}
              isAdmin={isAdmin}
              onRemoveAssignment={onRemoveAssignment}
            />
          ))
        )}
      </div>
    </div>
  );
};

export const ProjectionDay = ({
  date,
  entries,
  coverageSegments,
  isAdmin,
  onAssignEntry,
  onRemoveAssignment,
}: ProjectionDayProps) => {
  const totalPositions = entries.length;
  const assignedCount = entries.filter((entry) => !entry.is_open).length;
  const openCount = totalPositions - assignedCount;

  const coverageData = useMemo<CoverageData>(() => {
    if (!coverageSegments.length) {
      return { sections: [], remainder: entries };
    }
    const matchedIds = new Set<string>();
    const sections = coverageSegments.map((segment) => {
      const segmentEntries = entries.filter((entry) => {
        const matches =
          entry.start_minute === segment.startMinute && entry.end_minute === segment.endMinute;
        if (matches) {
          matchedIds.add(entry.id);
        }
        return matches;
      });
      return { segment, entries: segmentEntries };
    });
    const remainder = entries.filter((entry) => !matchedIds.has(entry.id));
    return { sections, remainder };
  }, [coverageSegments, entries]);

  const coverageSections = coverageData.sections;

  const remainderGroups = useMemo(() => {
    if (!coverageSegments.length) {
      return [];
    }
    return createShiftGroups(coverageData.remainder);
  }, [coverageSegments.length, coverageData.remainder]);

  const fallbackGroups = useMemo(() => createShiftGroups(entries), [entries]);

  return (
    <section className="w-72 min-w-[18rem] rounded-2xl border border-slate-200 bg-white/70 shadow-lg shadow-black/5">
      <div className="px-4 py-3">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-[10px] uppercase tracking-[0.4em] text-slate-500">
              {date.toLocaleDateString([], { weekday: 'short' })}
            </p>
            <h2 className="text-xl font-semibold text-slate-900">
              {date.toLocaleDateString([], { month: 'short', day: 'numeric' })}
            </h2>
          </div>
          <div className="text-right text-[10px] uppercase tracking-[0.3em] text-slate-500">
            <p>{assignedCount} assigned</p>
            <p>{openCount} open</p>
          </div>
        </div>
      </div>
      <div className="space-y-3 border-t border-slate-200 px-4 py-4">
        {coverageSegments.length > 0 ? (
          <>
            {coverageSections.map((section) => (
              <CoverageSection
                key={section.segment.id}
                segment={section.segment}
                entries={section.entries}
                isAdmin={isAdmin}
                onAssignEntry={onAssignEntry}
                onRemoveAssignment={onRemoveAssignment}
              />
            ))}
            {remainderGroups.length > 0 && (
              <div className="space-y-3">
                <p className="text-[10px] uppercase tracking-[0.4em] text-slate-500">Other shifts</p>
                {renderShiftGroups(remainderGroups, isAdmin, onAssignEntry, onRemoveAssignment)}
              </div>
            )}
          </>
        ) : fallbackGroups.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-slate-300 px-3 py-6 text-center text-[12px] text-slate-500">
            No shifts for this day.
          </p>
        ) : (
          renderShiftGroups(fallbackGroups, isAdmin, onAssignEntry, onRemoveAssignment)
        )}
      </div>
    </section>
  );
};

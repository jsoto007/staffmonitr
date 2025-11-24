import clsx from 'clsx';
import { useCallback, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { useAccountContext } from '../context/AccountContext';
import { useAuth } from '../context/AuthContext';
import { ProjectionSettingsProvider, useProjectionSettingsContext, DEFAULT_COVERAGE_MODE } from '../context/ProjectionSettingsContext';
import { fetchProjectionSettings, updateProjectionSettings } from '../services/projectionSettings';
import { fetchAccountStaff, updateAccountStaff } from '../services/staff';
import { ADMIN_ROLE_SET, ROLE_OPTIONS } from '../constants/roles';
import { SHIFT_WINDOW_COLOR_SCHEMES } from '../constants/shiftWindows';
import { StatusChip } from '../components/StatusChip';
import { minutesToTimeInput, timeInputToMinutes } from '../utils/time';
import type { CoverageMode, ShiftTemplate, StaffMember } from '../types';

const DEFAULT_SEGMENT_DURATION = 480;

type ShiftCreationOptions = {
  label?: string;
  start?: string;
  end?: string;
  color?: string;
  category?: 'coverage' | 'role';
  role?: string;
  days?: string[];
};

type ShiftPreset = ShiftCreationOptions & {
  id: string;
  description: string;
};

const SHIFT_PRESETS: ShiftPreset[] = [
  {
    id: 'overnight',
    label: 'Night · 12a–8a',
    description: 'Quiet coverage before sunrise.',
    start: '00:00',
    end: '08:00',
    color: '#6366f1',
  },
  {
    id: 'day',
    label: 'Day · 8a–4p',
    description: 'Core hours with full daytime energy.',
    start: '08:00',
    end: '16:00',
    color: '#10b981',
  },
  {
    id: 'swing',
    label: 'Swing · 4p–12a',
    description: 'Afternoon and evening handoff.',
    start: '16:00',
    end: '00:00',
    color: '#f97316',
  },
];

const COVERAGE_OPTIONS: { value: CoverageMode; label: string; description: string }[] = [
  { value: 'partial_coverage', label: 'Partial coverage', description: 'Keep the day segmented and focused.' },
  { value: 'full_24h', label: 'Full 24-hour', description: 'Wrap the last segment back to midnight.' },
];

const SHIFT_COLOR_FALLBACK = SHIFT_WINDOW_COLOR_SCHEMES[0].accent;

const WEEK_DAY_ORDER = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];
const DAY_OPTIONS = [
  { key: 'sun', label: 'Su' },
  { key: 'mon', label: 'Mo' },
  { key: 'tue', label: 'Tu' },
  { key: 'wed', label: 'We' },
  { key: 'thu', label: 'Th' },
  { key: 'fri', label: 'Fr' },
  { key: 'sat', label: 'Sa' },
];
const DEFAULT_ROLE_DAYS = ['mon', 'tue', 'wed', 'thu', 'fri'];

const randomId = () =>
  typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : `temp-${Date.now()}`;

const computeDuration = (start: number, end: number) => (end >= start ? end - start : end + 1440 - start);

const validateCoverageSegments = (segments: ShiftTemplate[]) => {
  if (!segments.length) {
    return 'Define at least one coverage shift segment to build coverage.';
  }
  const ordered = segments.slice().sort((a, b) => a.order - b.order);
  for (let index = 0; index < ordered.length; index += 1) {
    const shift = ordered[index];
    const start = timeInputToMinutes(shift.start_time);
    const end = timeInputToMinutes(shift.end_time);
    if (start === end) {
      return 'Each coverage segment must span at least one minute.';
    }
    if (computeDuration(start, end) <= 0) {
      return 'Shift end time must be after the start time (wraparound supported).';
    }
    if (index > 0) {
      const prev = ordered[index - 1];
      const prevEnd = timeInputToMinutes(prev.end_time);
      if (start !== prevEnd) {
        return 'Coverage segments must connect directly—no gaps or overlaps.';
      }
    }
  }
  return null;
};

const validateRoleSegments = (segments: ShiftTemplate[]) => {
  for (const shift of segments) {
    const start = timeInputToMinutes(shift.start_time);
    const end = timeInputToMinutes(shift.end_time);
    if (start === end) {
      return 'Role-specific shifts must span at least one minute.';
    }
    if (computeDuration(start, end) <= 0) {
      return 'Role-specific shift end time must be after the start time (wraparound supported).';
    }
    if (!shift.role) {
      return 'Assign a role to every role-specific shift.';
    }
    if (!shift.days || !shift.days.length) {
      return 'Select at least one day for role-specific shifts.';
    }
  }
  return null;
};

const validateShifts = (shifts: ShiftTemplate[]) => {
  const coverageSegments = shifts.filter((shift) => shift.category !== 'role');
  const roleSegments = shifts.filter((shift) => shift.category === 'role');
  return validateCoverageSegments(coverageSegments) ?? validateRoleSegments(roleSegments);
};

const getCoverageLabel = (mode: CoverageMode) =>
  mode === 'full_24h' ? 'Full 24-hour coverage' : 'Partial coverage';

const getCoverageColor = (mode: CoverageMode) => (mode === 'full_24h' ? '#34d399' : '#facc15');

const formatDayList = (days: string[] = []) => {
  if (!days.length) {
    return 'Daily';
  }
  return days
    .map((day) => DAY_OPTIONS.find((entry) => entry.key === day)?.label ?? day.slice(0, 2).toUpperCase())
    .join(' · ');
};

export const ProjectionSettingsPage = () => {
  const { selectedAccount } = useAccountContext();
  const { currentStaff, loading: authLoading, isAuthenticated } = useAuth();
  const accountId = selectedAccount?.id;
  const isAdmin = currentStaff ? ADMIN_ROLE_SET.has(currentStaff.role) : false;
  const queriesEnabled = Boolean(!authLoading && isAuthenticated && accountId && isAdmin);

  const { data: projectionSettings, isLoading: settingsLoading } = useQuery(
    ['projectionSettings', accountId],
    () => fetchProjectionSettings(accountId as string),
    {
      enabled: queriesEnabled,
      refetchOnWindowFocus: false,
    },
  );

  const {
    data: staffList = [],
    isFetching: staffLoading,
  } = useQuery(['accountStaff', accountId], () => fetchAccountStaff(accountId as string), {
    enabled: queriesEnabled,
    refetchOnWindowFocus: false,
  });

  if (!selectedAccount) {
    return (
      <section className="rounded-2xl border border-white/10 bg-slate-900/60 p-6 text-sm text-slate-400">
        Unable to load account context.
      </section>
    );
  }

  if (!isAdmin) {
    return (
      <section className="rounded-2xl border border-white/10 bg-slate-900/60 p-6 text-sm text-slate-400">
        Only admins can configure projection settings.
      </section>
    );
  }

  const resolvedAccountId = selectedAccount.id;
  return (
    <ProjectionSettingsProvider
      initialShifts={projectionSettings?.shifts ?? []}
      initialCoverageMode={projectionSettings?.coverage_mode ?? DEFAULT_COVERAGE_MODE}
      initialStaff={staffList}
    >
      <ProjectionSettingsForm
        accountId={resolvedAccountId}
        settingsLoading={settingsLoading}
        staffLoading={staffLoading}
        hasProjectionSettings={Boolean(projectionSettings)}
      />
    </ProjectionSettingsProvider>
  );
};

interface ProjectionSettingsFormProps {
  accountId: string;
  settingsLoading: boolean;
  staffLoading: boolean;
  hasProjectionSettings: boolean;
}

const ProjectionSettingsForm = ({ accountId, settingsLoading, staffLoading, hasProjectionSettings }: ProjectionSettingsFormProps) => {
  const {
    shifts,
    staff,
    coverageMode,
    runShiftAction,
    runStaffAction,
    updateCoverageMode,
    replaceShiftsFromServer,
    rollbackShifts,
  } = useProjectionSettingsContext();
  const queryClient = useQueryClient();

  const [scheduleFeedback, setScheduleFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [staffFeedback, setStaffFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [roleDraft, setRoleDraft] = useState({
    role: ROLE_OPTIONS[0],
    label: '',
    start: '10:00',
    end: '18:00',
    color: SHIFT_COLOR_FALLBACK,
    days: DEFAULT_ROLE_DAYS,
  });

  const validationError = useMemo(() => validateShifts(shifts), [shifts]);
  const coverageSummary = useMemo(() => getCoverageLabel(coverageMode), [coverageMode]);
  const coverageChipLabel = coverageSummary;
  const coverageChipColor = getCoverageColor(coverageMode);
  const coverageSegments = useMemo(() => shifts.filter((shift) => shift.category !== 'role'), [shifts]);
  const roleSegments = useMemo(() => shifts.filter((shift) => shift.category === 'role'), [shifts]);

  const timelineSegments = useMemo(() => {
    const ordered = [...coverageSegments].sort((a, b) => a.order - b.order);
    return ordered.map((shift, index) => {
      const startMinutes = timeInputToMinutes(shift.start_time);
      const endMinutes = timeInputToMinutes(shift.end_time);
      return {
        id: shift.id,
        label: shift.label || `Shift ${index + 1}`,
        startMinutes,
        duration: computeDuration(startMinutes, endMinutes),
        color: shift.color ?? SHIFT_COLOR_FALLBACK,
        timeRange: `${shift.start_time}–${shift.end_time}`,
      };
    });
  }, [coverageSegments]);

  const saveMutation = useMutation(
    (payload: { coverage_mode: CoverageMode; shifts: ShiftTemplate[] }) => updateProjectionSettings(accountId, payload),
    {
      onSuccess(data) {
        setScheduleFeedback({ type: 'success', message: 'Projection saved.' });
        replaceShiftsFromServer({ shifts: data.shifts, coverageMode: data.coverage_mode });
        queryClient.invalidateQueries(['projectionSettings', accountId]);
      },
      onError() {
        setScheduleFeedback({ type: 'error', message: 'Unable to persist projection settings.' });
        rollbackShifts();
      },
    },
  );

  const staffMutation = useMutation(
    ({ staffId, payload }: { staffId: string; payload: Partial<Pick<StaffMember, 'role' | 'status'>> }) =>
      updateAccountStaff(accountId, staffId, payload),
    {
      onSuccess() {
        setStaffFeedback({ type: 'success', message: 'Staff change queued.' });
        queryClient.invalidateQueries(['accountStaff', accountId]);
      },
      onError() {
        setStaffFeedback({ type: 'error', message: 'Unable to update staff.' });
        queryClient.invalidateQueries(['accountStaff', accountId]);
      },
    },
  );

  const handleCoverageChange = useCallback(
    (mode: CoverageMode) => {
      if (mode === coverageMode) {
        return;
      }
      updateCoverageMode(mode);
      setScheduleFeedback(null);
    },
    [coverageMode, updateCoverageMode],
  );

  const handleAddShift = (options: ShiftCreationOptions = {}) => {
    const category = options.category === 'role' ? 'role' : 'coverage';
    const lastCoverage = coverageSegments[coverageSegments.length - 1];
    const lastEnd = lastCoverage ? timeInputToMinutes(lastCoverage.end_time) : 0;
    const startMinutes =
      options.start != null
        ? timeInputToMinutes(options.start)
        : category === 'coverage'
        ? lastEnd % 1440
        : 0;
    const endMinutes =
      options.end != null
        ? timeInputToMinutes(options.end)
        : (startMinutes + DEFAULT_SEGMENT_DURATION) % 1440;
    const baseDays = options.days ?? (category === 'role' ? DEFAULT_ROLE_DAYS : WEEK_DAY_ORDER);
    const newShift: ShiftTemplate = {
      id: randomId(),
      label:
        options.label ||
        (category === 'role'
        ? `${options.role || 'Role'} • ${roleSegments.length + 1}`
        : `Shift ${coverageSegments.length + 1}`),
      start_time: minutesToTimeInput(startMinutes),
      end_time: minutesToTimeInput(endMinutes),
      color: options.color || SHIFT_COLOR_FALLBACK,
      order: shifts.length,
      category,
      role: options.role,
      days: baseDays,
    };
    runShiftAction({ type: 'add', shift: newShift });
    setScheduleFeedback(null);
  };

  const handleShiftFieldChange = (
    id: string,
    field: keyof Pick<ShiftTemplate, 'label' | 'start_time' | 'end_time' | 'color'>,
    value: string,
  ) => {
    runShiftAction({ type: 'update', id, updates: { [field]: value } });
    setScheduleFeedback(null);
  };

  const handleRoleShiftRoleChange = (id: string, role: string) => {
    runShiftAction({ type: 'update', id, updates: { role } });
    setScheduleFeedback(null);
  };

  const handleRoleShiftDaysToggle = (id: string, day: string) => {
    const shift = shifts.find((entry) => entry.id === id);
    if (!shift) {
      return;
    }
    const currentDays = shift.days ?? [];
    const hasDay = currentDays.includes(day);
    const updatedDays = hasDay ? currentDays.filter((entry) => entry !== day) : [...currentDays, day];
    runShiftAction({ type: 'update', id, updates: { days: updatedDays } });
    setScheduleFeedback(null);
  };

  const handleRoleDraftChange = (updates: Partial<typeof roleDraft>) => {
    setRoleDraft((prev) => ({ ...prev, ...updates }));
  };

  const handleAddRoleShift = () => {
    if (!roleDraft.days.length) {
      setScheduleFeedback({ type: 'error', message: 'Select at least one day for role shifts.' });
      return;
    }
    handleAddShift({
      category: 'role',
      role: roleDraft.role,
      label: roleDraft.label || `${roleDraft.role} shift`,
      start: roleDraft.start,
      end: roleDraft.end,
      color: roleDraft.color,
      days: roleDraft.days,
    });
    handleRoleDraftChange({ label: '' });
  };

  const handleMoveShift = (id: string, direction: 'up' | 'down') => {
    const currentIndex = coverageSegments.findIndex((shift) => shift.id === id);
    if (currentIndex === -1) {
      return;
    }
    const targetIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1;
    if (targetIndex < 0 || targetIndex >= coverageSegments.length) {
      return;
    }
    const fromId = coverageSegments[currentIndex].id;
    const toId = coverageSegments[targetIndex].id;
    const fromIndex = shifts.findIndex((shift) => shift.id === fromId);
    const toIndex = shifts.findIndex((shift) => shift.id === toId);
    if (fromIndex === -1 || toIndex === -1) {
      return;
    }
    runShiftAction({ type: 'swap', fromIndex, toIndex });
    setScheduleFeedback(null);
  };

  const handleRemoveShift = (id: string) => {
    runShiftAction({ type: 'remove', id });
    setScheduleFeedback(null);
  };

  const handleSave = () => {
    if (validationError) {
      setScheduleFeedback({ type: 'error', message: validationError });
      return;
    }
    const coverageOrder = new Map<string, number>();
    coverageSegments.forEach((shift, index) => coverageOrder.set(shift.id, index));
    roleSegments.forEach((shift, index) => coverageOrder.set(shift.id, coverageSegments.length + index));
    const payload = {
      coverage_mode: coverageMode,
      shifts: shifts.map((shift) => ({
        id: shift.id,
        label: shift.label,
        start_time: shift.start_time,
        end_time: shift.end_time,
        color: shift.color,
        order: coverageOrder.get(shift.id) ?? 0,
        category: shift.category ?? 'coverage',
        role: shift.role,
        days: shift.days,
      })),
    };
    saveMutation.mutate(payload);
  };

  const handleStaffUpdate = (staffId: string, updates: Partial<Pick<StaffMember, 'role' | 'status'>>) => {
    runStaffAction({ type: 'update', id: staffId, updates });
    staffMutation.mutate({ staffId, payload: updates });
  };

  return (
    <section className="space-y-8">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-[0.4em] text-slate-400">Projection</p>
          <h1 className="text-3xl font-semibold text-white">Projection settings</h1>
          <p className="max-w-2xl text-sm text-slate-400">
            Configure the daily shift timeline, keep segments aligned, and ensure visibility on what coverage looks like at a glance.
          </p>
        </div>
        <div className="flex flex-wrap gap-3">
          <StatusChip
            label={`${coverageSegments.length} coverage segment${coverageSegments.length === 1 ? '' : 's'}`}
            color="#a855f7"
          />
          <StatusChip label={coverageChipLabel} color={coverageChipColor} />
          <StatusChip
            label={`${roleSegments.length} role template${roleSegments.length === 1 ? '' : 's'}`}
            color="#38bdf8"
          />
        </div>
      </header>

      <div className="grid gap-6 lg:grid-cols-2">
        <article className="space-y-6 rounded-3xl border border-white/10 bg-slate-950/70 p-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-xs uppercase tracking-[0.4em] text-slate-400">Shift timeline</p>
              <h2 className="text-lg font-semibold text-white">Daily coverage segments</h2>
            </div>
            <p className="text-xs text-slate-400">Optimistic edits stay local until saved.</p>
          </div>
          <div className="space-y-4">
            {COVERAGE_OPTIONS.map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() => handleCoverageChange(option.value)}
                aria-pressed={coverageMode === option.value}
                className={clsx(
                  'w-full rounded-2xl border px-4 py-3 text-left text-sm transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500',
                  coverageMode === option.value
                    ? 'border-brand-500 bg-gradient-to-r from-slate-900/70 to-slate-900/90 text-white'
                    : 'border-white/10 bg-slate-900/40 text-slate-200 hover:border-white/30 hover:bg-slate-900/60',
                )}
              >
                <div className="flex flex-col gap-1">
                  <span className="font-semibold">{option.label}</span>
                  <span className="text-[11px] text-slate-400">{option.description}</span>
                </div>
              </button>
            ))}
          </div>

          <div className="space-y-4 rounded-3xl border border-white/5 bg-slate-900/40 p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <p className="text-xs uppercase tracking-[0.3em] text-slate-400">Shift preferences</p>
                <p className="text-sm text-slate-400">Define the templates that anchor every day.</p>
              </div>
              <span className="text-xs font-semibold uppercase tracking-[0.3em] text-white">{coverageSummary}</span>
            </div>

            <div className="space-y-2">
              <div className="flex h-3 overflow-hidden rounded-full bg-white/5">
                {timelineSegments.length === 0 ? (
                  <span className="flex-1 rounded-full bg-white/10" />
                ) : (
                  timelineSegments.map((segment) => (
                    <span
                      key={segment.id}
                      title={`${segment.label} · ${segment.timeRange}`}
                      className="h-full"
                      style={{
                        width: `${(segment.duration / 1440) * 100}%`,
                        backgroundColor: segment.color,
                      }}
                    />
                  ))
                )}
              </div>
              {timelineSegments.length === 0 ? (
                <p className="text-xs text-slate-400">Add segments to preview how the day is covered.</p>
              ) : (
                <div className="flex flex-wrap gap-2 text-[11px] text-slate-400">
                  {timelineSegments.map((segment) => (
                    <span key={`${segment.id}-tag`} className="rounded-full border border-white/10 px-2 py-1">
                      {segment.label}
                    </span>
                  ))}
                </div>
              )}
            </div>

            <div className="grid gap-3 sm:grid-cols-3">
              {SHIFT_PRESETS.map((preset) => (
                <button
                  type="button"
                  key={preset.id}
                  onClick={() => handleAddShift(preset)}
                  className="flex flex-col gap-1 rounded-2xl border border-white/10 bg-slate-950/40 px-4 py-3 text-left text-sm text-white transition hover:border-white/30"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span aria-hidden className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: preset.color }} />
                      <span className="text-sm font-semibold">{preset.label}</span>
                    </div>
                    <span className="text-[11px] text-slate-400">{preset.start}–{preset.end}</span>
                  </div>
                  <p className="text-[11px] text-slate-400">{preset.description}</p>
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-4">
            {settingsLoading && !hasProjectionSettings ? (
              <p className="text-sm text-slate-400">Loading shift templates…</p>
            ) : coverageSegments.length === 0 ? (
              <p className="text-sm text-slate-400">No coverage segments yet. Add one to start defining coverage.</p>
            ) : (
              coverageSegments.map((shift, index) => {
                const startMinutes = timeInputToMinutes(shift.start_time);
                const endMinutes = timeInputToMinutes(shift.end_time);
                const duration = computeDuration(startMinutes, endMinutes);
                const accentColor = shift.color ?? SHIFT_COLOR_FALLBACK;
                return (
                  <div
                    key={shift.id}
                    className="space-y-3 rounded-3xl border border-white/10 bg-slate-900/50 p-4 shadow-inner shadow-black/40"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <span
                          className="h-3 w-3 rounded-full ring-1 ring-white/20"
                          style={{ backgroundColor: accentColor }}
                          aria-hidden
                        />
                        <div>
                          <p className="text-sm font-semibold text-white">{shift.label || `Shift ${index + 1}`}</p>
                          <p className="text-[11px] uppercase tracking-[0.3em] text-slate-400">Segment {index + 1}</p>
                        </div>
                      </div>
                      <div className="flex flex-wrap items-center gap-2 text-[11px] uppercase tracking-[0.3em] text-slate-400">
                        <button
                          type="button"
                          onClick={() => handleMoveShift(shift.id, 'up')}
                          disabled={index === 0}
                          className={clsx(
                            'rounded-2xl border px-3 py-2 text-[11px] transition',
                            index === 0
                              ? 'border-white/10 text-slate-500'
                              : 'border-white/20 text-white hover:border-white/40',
                          )}
                        >
                          Move up
                        </button>
                        <button
                          type="button"
                          onClick={() => handleMoveShift(shift.id, 'down')}
                          disabled={index === coverageSegments.length - 1}
                          className={clsx(
                            'rounded-2xl border px-3 py-2 text-[11px] transition',
                            index === coverageSegments.length - 1
                              ? 'border-white/10 text-slate-500'
                              : 'border-white/20 text-white hover:border-white/40',
                          )}
                        >
                          Move down
                        </button>
                        <button
                          type="button"
                          onClick={() => handleRemoveShift(shift.id)}
                          className="rounded-2xl border border-rose-500/70 px-3 py-2 text-[11px] text-rose-300 transition hover:border-rose-400"
                        >
                          Delete
                        </button>
                      </div>
                    </div>

                    <div className="grid gap-3 sm:grid-cols-3">
                      <label className="text-xs uppercase tracking-[0.3em] text-slate-400">
                        Label
                        <input
                          type="text"
                          value={shift.label}
                          onChange={(event) => handleShiftFieldChange(shift.id, 'label', event.target.value)}
                          className="mt-1 w-full rounded-2xl border border-white/10 bg-slate-950/40 px-3 py-2 text-sm text-white focus:border-white focus:outline-none"
                        />
                      </label>
                      <label className="text-xs uppercase tracking-[0.3em] text-slate-400">
                        Start
                        <input
                          type="time"
                          value={shift.start_time}
                          onChange={(event) => handleShiftFieldChange(shift.id, 'start_time', event.target.value)}
                          className="mt-1 w-full rounded-2xl border border-white/10 bg-slate-950/40 px-3 py-2 text-sm text-white focus:border-white focus:outline-none"
                        />
                      </label>
                      <label className="text-xs uppercase tracking-[0.3em] text-slate-400">
                        End
                        <input
                          type="time"
                          value={shift.end_time}
                          onChange={(event) => handleShiftFieldChange(shift.id, 'end_time', event.target.value)}
                          className="mt-1 w-full rounded-2xl border border-white/10 bg-slate-950/40 px-3 py-2 text-sm text-white focus:border-white focus:outline-none"
                        />
                      </label>
                    </div>

                    <label className="text-xs uppercase tracking-[0.3em] text-slate-400">
                      Color
                      <input
                        type="color"
                        value={shift.color ?? SHIFT_COLOR_FALLBACK}
                        onChange={(event) => handleShiftFieldChange(shift.id, 'color', event.target.value)}
                        className="mt-1 h-10 w-16 rounded-2xl border border-white/10 p-0"
                      />
                    </label>

                    <div className="flex items-center justify-between text-[11px] text-slate-400">
                      <span>
                        {shift.start_time}–{shift.end_time}
                      </span>
                      <span>
                        {Math.floor(duration / 60)}h {duration % 60}m segment
                      </span>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          <div className="space-y-6 border-t border-white/5 pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs uppercase tracking-[0.3em] text-slate-400">Role-specific needs</p>
                <p className="text-sm text-slate-400">Track roles such as cooks, drivers, and clinicians independently.</p>
              </div>
              <span className="text-xs font-semibold uppercase tracking-[0.3em] text-white">{roleSegments.length} template{roleSegments.length === 1 ? '' : 's'}</span>
            </div>

            <div className="rounded-3xl border border-white/10 bg-slate-900/60 p-4">
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="text-xs uppercase tracking-[0.3em] text-slate-400">
                  Role
                  <select
                    value={roleDraft.role}
                    onChange={(event) => handleRoleDraftChange({ role: event.target.value })}
                    className="mt-1 w-full rounded-2xl border border-white/10 bg-slate-950/40 px-3 py-2 text-sm text-white focus:border-white focus:outline-none"
                  >
                    {ROLE_OPTIONS.map((option) => (
                      <option key={option} value={option} className="bg-slate-900 text-white">
                        {option}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="text-xs uppercase tracking-[0.3em] text-slate-400">
                  Label
                  <input
                    type="text"
                    value={roleDraft.label}
                    onChange={(event) => handleRoleDraftChange({ label: event.target.value })}
                    placeholder="Optional helper text"
                    className="mt-1 w-full rounded-2xl border border-white/10 bg-slate-950/40 px-3 py-2 text-sm text-white focus:border-white focus:outline-none"
                  />
                </label>
                <label className="text-xs uppercase tracking-[0.3em] text-slate-400">
                  Start
                  <input
                    type="time"
                    value={roleDraft.start}
                    onChange={(event) => handleRoleDraftChange({ start: event.target.value })}
                    className="mt-1 w-full rounded-2xl border border-white/10 bg-slate-950/40 px-3 py-2 text-sm text-white focus:border-white focus:outline-none"
                  />
                </label>
                <label className="text-xs uppercase tracking-[0.3em] text-slate-400">
                  End
                  <input
                    type="time"
                    value={roleDraft.end}
                    onChange={(event) => handleRoleDraftChange({ end: event.target.value })}
                    className="mt-1 w-full rounded-2xl border border-white/10 bg-slate-950/40 px-3 py-2 text-sm text-white focus:border-white focus:outline-none"
                  />
                </label>
              </div>
              <div>
                <p className="text-[11px] uppercase tracking-[0.3em] text-slate-400">Days</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {DAY_OPTIONS.map((day) => {
                    const isSelected = roleDraft.days.includes(day.key);
                    return (
                      <button
                        key={day.key}
                        type="button"
                        onClick={() => {
                          const nextDays = roleDraft.days.includes(day.key)
                            ? roleDraft.days.filter((entry) => entry !== day.key)
                            : [...roleDraft.days, day.key];
                          handleRoleDraftChange({ days: nextDays });
                        }}
                        className={clsx(
                          'rounded-full border px-3 py-1 text-[11px] transition',
                          isSelected
                            ? 'border-brand-500 bg-brand-500/10 text-white'
                            : 'border-white/10 text-slate-400 hover:border-white/30',
                        )}
                        aria-pressed={isSelected}
                      >
                        {day.label}
                      </button>
                    );
                  })}
                </div>
              </div>
              <div className="mt-3 flex items-center justify-between">
                <label className="flex items-center gap-2 text-xs uppercase tracking-[0.3em] text-slate-400">
                  Color
                  <input
                    type="color"
                    value={roleDraft.color}
                    onChange={(event) => handleRoleDraftChange({ color: event.target.value })}
                    className="h-10 w-10 rounded-2xl border border-white/10 p-0"
                  />
                </label>
                <button
                  type="button"
                  onClick={handleAddRoleShift}
                  className="rounded-2xl border border-white/20 bg-gradient-to-r from-slate-800/60 to-slate-900/70 px-4 py-2 text-sm font-semibold text-white transition hover:border-white/40"
                >
                  Add role shift
                </button>
              </div>
            </div>

            <div className="space-y-3">
              {roleSegments.length === 0 ? (
                <p className="text-sm text-slate-400">No role-specific templates yet.</p>
              ) : (
                roleSegments.map((shift, index) => {
                const startMinutes = timeInputToMinutes(shift.start_time);
                const endMinutes = timeInputToMinutes(shift.end_time);
                const duration = computeDuration(startMinutes, endMinutes);
                const accentColor = shift.color ?? SHIFT_COLOR_FALLBACK;
                  return (
                    <div
                      key={shift.id}
                      className="space-y-3 rounded-3xl border border-white/10 bg-slate-900/50 p-4 shadow-inner shadow-black/40"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div>
                          <p className="text-sm font-semibold text-white">
                            {shift.role ?? 'Role'} · {shift.label || `Template ${index + 1}`}
                          </p>
                          <p className="text-[11px] text-slate-400">{formatDayList(shift.days)}</p>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleRemoveShift(shift.id)}
                          className="rounded-2xl border border-rose-500/70 px-3 py-2 text-[11px] text-rose-300 transition hover:border-rose-400"
                        >
                          Delete
                        </button>
                      </div>
                      <div className="grid gap-3 sm:grid-cols-3">
                        <label className="text-xs uppercase tracking-[0.3em] text-slate-400">
                          Role
                          <select
                            value={shift.role ?? ROLE_OPTIONS[0]}
                            onChange={(event) => handleRoleShiftRoleChange(shift.id, event.target.value)}
                            className="mt-1 w-full rounded-2xl border border-white/10 bg-slate-950/40 px-3 py-2 text-sm text-white focus:border-white focus:outline-none"
                          >
                            {ROLE_OPTIONS.map((option) => (
                              <option key={option} value={option} className="bg-slate-900 text-white">
                                {option}
                              </option>
                            ))}
                          </select>
                        </label>
                        <label className="text-xs uppercase tracking-[0.3em] text-slate-400">
                          Start
                          <input
                            type="time"
                            value={shift.start_time}
                            onChange={(event) => handleShiftFieldChange(shift.id, 'start_time', event.target.value)}
                            className="mt-1 w-full rounded-2xl border border-white/10 bg-slate-950/40 px-3 py-2 text-sm text-white focus:border-white focus:outline-none"
                          />
                        </label>
                        <label className="text-xs uppercase tracking-[0.3em] text-slate-400">
                          End
                          <input
                            type="time"
                            value={shift.end_time}
                            onChange={(event) => handleShiftFieldChange(shift.id, 'end_time', event.target.value)}
                            className="mt-1 w-full rounded-2xl border border-white/10 bg-slate-950/40 px-3 py-2 text-sm text-white focus:border-white focus:outline-none"
                          />
                        </label>
                      </div>
                      <div>
                        <p className="text-[11px] uppercase tracking-[0.3em] text-slate-400">Days</p>
                        <div className="mt-2 flex flex-wrap gap-2">
                          {DAY_OPTIONS.map((day) => {
                            const isSelected = shift.days?.includes(day.key);
                            return (
                              <button
                                key={`${shift.id}-${day.key}`}
                                type="button"
                                onClick={() => handleRoleShiftDaysToggle(shift.id, day.key)}
                                className={clsx(
                                  'rounded-full border px-3 py-1 text-[11px] transition',
                                  isSelected
                                    ? 'border-brand-500 bg-brand-500/10 text-white'
                                    : 'border-white/10 text-slate-400 hover:border-white/30',
                                )}
                                aria-pressed={Boolean(isSelected)}
                              >
                                {day.label}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                      <div className="flex items-center justify-between text-[11px] text-slate-400">
                        <span>
                          {shift.start_time}–{shift.end_time}
                        </span>
                        <span>
                          {Math.floor(duration / 60)}h {duration % 60}m
                        </span>
                      </div>
                      <label className="text-xs uppercase tracking-[0.3em] text-slate-400">
                        Color
                        <input
                          type="color"
                          value={shift.color ?? SHIFT_COLOR_FALLBACK}
                          onChange={(event) => handleShiftFieldChange(shift.id, 'color', event.target.value)}
                          className="mt-1 h-10 w-16 rounded-2xl border border-white/10 p-0"
                        />
                      </label>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={() => handleAddShift()}
              className="rounded-2xl border border-white/20 bg-gradient-to-r from-slate-800/60 to-slate-900/70 px-4 py-2 text-sm font-semibold text-white transition hover:border-white/40"
            >
              Add segment
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={Boolean(validationError) || saveMutation.isLoading}
              className="rounded-2xl border border-transparent bg-gradient-to-r from-brand-500 to-brand-700 px-4 py-2 text-sm font-semibold text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {saveMutation.isLoading ? 'Saving…' : 'Save projection'}
            </button>
          </div>

          {validationError && <p className="text-sm text-rose-400">{validationError}</p>}
          {scheduleFeedback && (
            <p className={`text-sm ${scheduleFeedback.type === 'success' ? 'text-emerald-400' : 'text-rose-400'}`}>
              {scheduleFeedback.message}
            </p>
          )}
        </article>

        <article className="space-y-4 rounded-3xl border border-white/10 bg-slate-950/70 p-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs uppercase tracking-[0.4em] text-slate-400">Staff</p>
              <h2 className="text-lg font-semibold text-white">Quick role & status edits</h2>
            </div>
            <StatusChip label={staff.length ? `${staff.length} people` : 'Roster empty'} color="#fcd34d" />
          </div>
          {staffLoading ? (
            <p className="text-sm text-slate-500">Loading staff…</p>
          ) : (
            <div className="space-y-3">
              {staff.map((member) => (
                <div
                  key={member.id}
                  className="rounded-2xl border border-white/10 bg-slate-900/60 p-4"
                >
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <p className="text-base font-semibold text-white">{member.full_name}</p>
                      <p className="text-[11px] text-slate-400">{member.email}</p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <label className="flex flex-col items-start text-[10px] uppercase tracking-[0.3em] text-slate-400">
                        Role
                        <select
                          value={member.role}
                          onChange={(event) => handleStaffUpdate(member.id, { role: event.target.value as StaffMember['role'] })}
                          className="mt-1 rounded-2xl border border-white/10 bg-slate-950/40 px-3 py-2 text-sm text-white focus:border-white focus:outline-none"
                        >
                          {ROLE_OPTIONS.map((option) => (
                            <option key={option} value={option} className="bg-slate-900 text-white">
                              {option}
                            </option>
                          ))}
                        </select>
                      </label>
                      <label className="flex flex-col items-start text-[10px] uppercase tracking-[0.3em] text-slate-400">
                        Status
                        <select
                          value={member.status}
                          onChange={(event) => handleStaffUpdate(member.id, { status: event.target.value as StaffMember['status'] })}
                          className="mt-1 rounded-2xl border border-white/10 bg-slate-950/40 px-3 py-2 text-sm text-white focus:border-white focus:outline-none"
                        >
                          {['active', 'paused', 'inactive'].map((status) => (
                            <option key={status} value={status} className="bg-slate-900 text-white">
                              {status}
                            </option>
                          ))}
                        </select>
                      </label>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
          {staffFeedback && (
            <p className={`text-sm ${staffFeedback.type === 'success' ? 'text-emerald-400' : 'text-rose-400'}`}>
              {staffFeedback.message}
            </p>
          )}
        </article>
      </div>
    </section>
  );
};

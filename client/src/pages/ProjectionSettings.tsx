import clsx from 'clsx';
import { startTransition, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { useAccountContext } from '../context/AccountContext';
import { useAuth } from '../context/AuthContext';
import { fetchShiftWindows, replaceShiftWindows } from '../services/projectionSettings';
import { fetchAccountStaff, updateAccountStaff } from '../services/staff';
import { ADMIN_ROLE_SET, ROLE_OPTIONS } from '../constants/roles';
import { StatusChip } from '../components/StatusChip';
import { SHIFT_WINDOW_COLOR_SCHEMES } from '../constants/shiftWindows';
import { clampMinutes, formatMinutesLabel, minutesToTimeInput, timeInputToMinutes } from '../utils/time';
import type { ShiftWindow, StaffMember } from '../types';

const STATUS_OPTIONS = ['active', 'paused', 'inactive'] as const;
type StatusOption = (typeof STATUS_OPTIONS)[number];

function useOptimistic<T>(
  value: T,
  reducer: (state: T, action: any) => T
): [T, (action: any) => void] {
  const [state, setState] = useState<T>(value);

  const dispatch = useCallback(
    (action: any) => {
      setState((prev) => reducer(prev, action));
    },
    [reducer],
  );

  useEffect(() => {
    setState(value);
  }, [value]);

  return [state, dispatch];
}

type ShiftWindowAction =
  | { type: 'add'; window: ShiftWindow }
  | { type: 'update'; id: string; updates: Partial<ShiftWindow> }
  | { type: 'remove'; id: string }
  | { type: 'swap'; fromIndex: number; toIndex: number }
  | { type: 'replace'; windows: ShiftWindow[] };

type StaffAction = { type: 'update'; id: string; updates: Partial<Pick<StaffMember, 'status' | 'role'>> };

const shiftWindowReducer = (state: ShiftWindow[], action: ShiftWindowAction) => {
  switch (action.type) {
    case 'add':
      return [...state, action.window];
    case 'update':
      return state.map((window) => (window.id === action.id ? { ...window, ...action.updates } : window));
    case 'remove':
      return state.filter((window) => window.id !== action.id);
    case 'swap':
      if (
        action.fromIndex < 0 ||
        action.toIndex < 0 ||
        action.fromIndex >= state.length ||
        action.toIndex >= state.length
      ) {
        return state;
      }
      const updated = [...state];
      const [moved] = updated.splice(action.fromIndex, 1);
      updated.splice(action.toIndex, 0, moved);
      return updated;
    case 'replace':
      return action.windows;
    default:
      return state;
  }
};

const staffReducer = (state: StaffMember[], action: StaffAction) =>
  state.map((staff) => (staff.id === action.id ? { ...staff, ...action.updates } : staff));

const randomId = () =>
  typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : `temp-${Date.now()}`;

const validateWindows = (windows: ShiftWindow[]) => {
  if (!windows.length) {
    return 'Define at least one shift segment.';
  }
  let lastEnd: number | null = null;
  for (const window of windows) {
    if (window.start_minute < 0 || window.end_minute > 1440) {
      return 'Times must stay within a single day.';
    }
    if (window.start_minute >= window.end_minute) {
      return 'Each shift must start before it ends.';
    }
    if (lastEnd !== null && window.start_minute !== lastEnd) {
      return 'Segments must connect without gaps or overlaps.';
    }
    lastEnd = window.end_minute;
  }
  return null;
};

const coverageStatus = (windows: ShiftWindow[]) => {
  if (!windows.length) return { label: 'No coverage defined', color: '#f97316' };
  const fullDay = windows[0].start_minute === 0 && windows[windows.length - 1].end_minute === 1440;
  return fullDay
    ? { label: '24-hour coverage', color: '#34d399' }
    : { label: 'Partial coverage', color: '#facc15' };
};

export const ProjectionSettingsPage = () => {
  const { selectedAccount } = useAccountContext();
  const { currentStaff } = useAuth();
  const queryClient = useQueryClient();
  const accountId = selectedAccount?.id;
  const isAdmin = currentStaff ? ADMIN_ROLE_SET.has(currentStaff.role) : false;

  const { data: shiftWindows = [] } = useQuery(['shiftWindows', accountId], () => fetchShiftWindows(accountId as string), {
    enabled: Boolean(accountId),
    refetchOnWindowFocus: false,
  });

  const {
    data: staffList = [],
    isFetching: staffLoading,
  } = useQuery(['accountStaff', accountId], () => fetchAccountStaff(accountId as string), {
    enabled: Boolean(accountId && isAdmin),
  });

  const [optimisticWindows, dispatchWindows] = useOptimistic(shiftWindows ?? [], shiftWindowReducer);
  const [optimisticStaff, dispatchStaff] = useOptimistic(staffList ?? [], staffReducer);
  const [isDirty, setIsDirty] = useState(false);
  const lastServerKey = useRef('');
  const serverWindowsKey = useMemo(
    () =>
      shiftWindows
        .map(
          (window) =>
            `${window.id}-${window.start_minute}-${window.end_minute}-${window.order}-${window.name}`,
        )
        .join('|'),
    [shiftWindows],
  );
  const runWindowAction = useCallback(
    (action: ShiftWindowAction) => {
      startTransition(() => dispatchWindows(action));
    },
    [dispatchWindows],
  );
  const [scheduleFeedback, setScheduleFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [staffFeedback, setStaffFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const validationError = useMemo(() => validateWindows(optimisticWindows), [optimisticWindows]);
  const coverage = useMemo(() => coverageStatus(optimisticWindows), [optimisticWindows]);
  useEffect(() => {
    if (isDirty) {
      lastServerKey.current = serverWindowsKey;
      return;
    }
    if (serverWindowsKey === lastServerKey.current) {
      return;
    }
    runWindowAction({ type: 'replace', windows: shiftWindows });
    lastServerKey.current = serverWindowsKey;
  }, [isDirty, runWindowAction, serverWindowsKey, shiftWindows]);

  const saveMutation = useMutation(
    (payload: { account_group_id: string; windows: { id?: string; name?: string; start_minute: number; end_minute: number; order: number }[] }) =>
      replaceShiftWindows(payload),
    {
      onSuccess() {
        setIsDirty(false);
        if (accountId) {
          queryClient.invalidateQueries(['shiftWindows', accountId]);
        }
        setScheduleFeedback({ type: 'success', message: 'Shift windows saved.' });
      },
      onError() {
        setScheduleFeedback({ type: 'error', message: 'Unable to persist shift windows.' });
      },
    },
  );

  const staffMutation = useMutation(
    ({ staffId, payload }: { staffId: string; payload: Record<string, unknown> }) =>
      updateAccountStaff(accountId as string, staffId, payload),
    {
      onSuccess() {
        if (accountId) {
          queryClient.invalidateQueries(['accountStaff', accountId]);
        }
        setStaffFeedback({ type: 'success', message: 'Staff change queued.' });
      },
      onError() {
        if (accountId) {
          queryClient.invalidateQueries(['accountStaff', accountId]);
        }
        setStaffFeedback({ type: 'error', message: 'Unable to update staff.' });
      },
    },
  );

  const handleAddWindow = () => {
    const lastEnd = optimisticWindows.reduce((max, window) => Math.max(max, window.end_minute), 0);
    if (lastEnd >= 1440) {
      setScheduleFeedback({ type: 'error', message: 'Coverage already spans the full day.' });
      return;
    }
    const newStart = lastEnd;
    const newEnd = clampMinutes(newStart + 480);
    const newWindow: ShiftWindow = {
      id: randomId(),
      account_group_id: accountId ?? '',
      name: `Shift ${optimisticWindows.length + 1}`,
      start_minute: newStart,
      end_minute: newEnd || 1440,
      order: optimisticWindows.length,
    };
    runWindowAction({ type: 'add', window: newWindow });
    setIsDirty(true);
    setScheduleFeedback(null);
  };

  const handleWindowChange = (id: string, field: keyof Pick<ShiftWindow, 'name' | 'start_minute' | 'end_minute'>, value: string | number) => {
    const updates: Partial<ShiftWindow> =
      field === 'start_minute' || field === 'end_minute'
        ? { [field]: Number(value) }
        : { [field]: value };
    runWindowAction({ type: 'update', id, updates });
    setIsDirty(true);
  };

  const handleMoveWindow = (id: string, direction: 'up' | 'down') => {
    const index = optimisticWindows.findIndex((window) => window.id === id);
    if (index === -1) return;
    const target = direction === 'up' ? index - 1 : index + 1;
    runWindowAction({ type: 'swap', fromIndex: index, toIndex: target });
    setIsDirty(true);
  };

  const handleRemoveWindow = (id: string) => {
    runWindowAction({ type: 'remove', id });
    setIsDirty(true);
  };

  const handleSave = () => {
    if (!accountId) {
      setScheduleFeedback({ type: 'error', message: 'Account not selected.' });
      return;
    }
    if (validationError) {
      setScheduleFeedback({ type: 'error', message: validationError });
      return;
    }
    setScheduleFeedback(null);
    saveMutation.mutate({
      account_group_id: accountId,
      windows: optimisticWindows.map((window, index) => ({
        id: window.id,
        name: window.name,
        start_minute: window.start_minute,
        end_minute: window.end_minute,
        order: index,
      })),
    });
  };

  const handleStaffUpdate = (staffId: string, updates: Partial<Pick<StaffMember, 'status' | 'role'>>) => {
    dispatchStaff({ type: 'update', id: staffId, updates });
    if (!accountId) return;
    staffMutation.mutate({ staffId, payload: updates });
  };

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

  return (
    <section className="space-y-8">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-[0.4em] text-slate-400">Projection</p>
          <h1 className="text-3xl font-semibold text-white">Projection settings</h1>
          <p className="max-w-2xl text-sm text-slate-400">
            Outline the daily shift timeline and keep staff assignments anchored to those segments for every calendar view.
          </p>
        </div>
        <div className="flex flex-wrap gap-3">
          <StatusChip label={`${optimisticWindows.length} segment${optimisticWindows.length === 1 ? '' : 's'}`} color="#a855f7" />
          <StatusChip label={coverage.label} color={coverage.color} />
        </div>
      </header>

      <div className="grid gap-6 lg:grid-cols-2">
        <article className="space-y-5 rounded-3xl border border-white/10 bg-slate-950/70 p-5">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-xs uppercase tracking-[0.4em] text-slate-400">Shift timeline</p>
              <h2 className="text-lg font-semibold text-white">Segmented daily coverage</h2>
            </div>
            <div className="text-xs text-slate-400">Drag, reorder, and edit the windows below.</div>
          </div>
          <p className="text-sm text-slate-400">
            Each segment should start immediately after the previous one ends. The UI uses optimistic updates so edits feel immediate.
          </p>

          <div className="space-y-4">
            {optimisticWindows.map((window, index) => {
              const color = SHIFT_WINDOW_COLOR_SCHEMES[index % SHIFT_WINDOW_COLOR_SCHEMES.length];
              return (
                <div
                  key={window.id}
                  className="space-y-3 rounded-3xl border border-white/10 bg-slate-900/50 p-4 shadow-inner shadow-black/40"
                >
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <label className="w-full flex-1 text-sm font-semibold text-white">
                      <span className="text-xs uppercase tracking-[0.4em] text-slate-400">Segment label</span>
                      <input
                        type="text"
                        value={window.name ?? `Shift ${index + 1}`}
                        onChange={(event) => handleWindowChange(window.id, 'name', event.target.value)}
                        className="mt-1 w-full rounded-2xl border border-white/10 bg-slate-950/40 px-3 py-2 text-sm text-white placeholder:text-slate-500 focus:border-white focus:outline-none"
                        placeholder={`Shift ${index + 1}`}
                      />
                    </label>
                    <div className="flex items-center gap-2 text-xs uppercase tracking-[0.3em] text-slate-400">
                      <button
                        type="button"
                        onClick={() => handleMoveWindow(window.id, 'up')}
                        disabled={index === 0}
                        className={clsx(
                          'rounded-2xl border px-3 py-2 text-[11px] text-white transition',
                          index === 0 ? 'border-white/10 text-slate-500' : 'border-white/20 hover:border-white/40',
                        )}
                      >
                        Move up
                      </button>
                      <button
                        type="button"
                        onClick={() => handleMoveWindow(window.id, 'down')}
                        disabled={index === optimisticWindows.length - 1}
                        className={clsx(
                          'rounded-2xl border px-3 py-2 text-[11px] text-white transition',
                          index === optimisticWindows.length - 1
                            ? 'border-white/10 text-slate-500'
                            : 'border-white/20 hover:border-white/40',
                        )}
                      >
                        Move down
                      </button>
                      <button
                        type="button"
                        onClick={() => handleRemoveWindow(window.id)}
                        className="rounded-2xl border border-rose-500/70 px-3 py-2 text-[11px] text-rose-300 transition hover:border-rose-400"
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <label className="text-xs uppercase tracking-[0.3em] text-slate-400">
                      Start
                      <input
                        type="time"
                        value={minutesToTimeInput(window.start_minute ?? 0)}
                        onChange={(event) =>
                          handleWindowChange(window.id, 'start_minute', timeInputToMinutes(event.target.value))
                        }
                        className="mt-1 w-full rounded-2xl border border-white/10 bg-slate-950/40 px-3 py-2 text-sm text-white focus:border-white focus:outline-none"
                      />
                    </label>
                    <label className="text-xs uppercase tracking-[0.3em] text-slate-400">
                      End
                      <input
                        type="time"
                        value={minutesToTimeInput(window.end_minute ?? 0)}
                        onChange={(event) =>
                          handleWindowChange(window.id, 'end_minute', timeInputToMinutes(event.target.value))
                        }
                        className="mt-1 w-full rounded-2xl border border-white/10 bg-slate-950/40 px-3 py-2 text-sm text-white focus:border-white focus:outline-none"
                      />
                    </label>
                  </div>
                  <div className="flex items-center justify-between">
                    <p className="text-[11px] text-slate-400">
                      {formatMinutesLabel(window.start_minute)} – {formatMinutesLabel(window.end_minute)}
                    </p>
                    <span className="text-[11px] font-semibold" style={{ color: color.accent }}>
                      {window.start_minute === 0 && window.end_minute === 1440 ? 'Full day' : 'Segment focus'}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={handleAddWindow}
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
              {saveMutation.isLoading ? 'Saving…' : 'Save schedule'}
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
            <StatusChip label={staffList.length ? `${staffList.length} people` : 'Roster empty'} color="#fcd34d" />
          </div>
          {staffLoading ? (
            <p className="text-sm text-slate-500">Loading staff…</p>
          ) : (
            <div className="space-y-3">
              {optimisticStaff.map((staff) => (
                <div
                  key={staff.id}
                  className="rounded-2xl border border-white/10 bg-slate-900/60 p-4"
                >
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <p className="text-base font-semibold text-white">{staff.full_name}</p>
                      <p className="text-[11px] text-slate-400">{staff.email}</p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <label className="flex flex-col items-start text-[10px] uppercase tracking-[0.3em] text-slate-400">
                        Role
                        <select
                          value={staff.role}
                          onChange={(event) => handleStaffUpdate(staff.id, { role: event.target.value as StaffMember['role'] })}
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
                          value={staff.status as StatusOption}
                          onChange={(event) => handleStaffUpdate(staff.id, { status: event.target.value as StatusOption })}
                          className="mt-1 rounded-2xl border border-white/10 bg-slate-950/40 px-3 py-2 text-sm text-white focus:border-white focus:outline-none"
                        >
                          {STATUS_OPTIONS.map((status) => (
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

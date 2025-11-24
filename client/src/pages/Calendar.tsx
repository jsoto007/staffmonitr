import { useCallback, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { useAccountContext } from '../context/AccountContext';
import { useAuth } from '../context/AuthContext';
import { useScheduleStore } from '../stores/scheduleStore';
import { fetchShifts, requestShiftCoverage } from '../services/shifts';
import { fetchAccountStaff } from '../services/staff';
import { fetchProjectionSettings } from '../services/projectionSettings';
import { ViewSwitcher } from '../components/calendar/ViewSwitcher';
import { DayView } from '../components/calendar/DayView';
import { WeekView } from '../components/calendar/WeekView';
import { MonthView } from '../components/calendar/MonthView';
import { StatusChip } from '../components/StatusChip';
import { useEventStream } from '../hooks/useEventStream';
import { ADMIN_ROLE_SET } from '../constants/roles';
import type { ShiftEvent, StaffMember } from '../types';

type ViewMode = 'day' | 'week' | 'month';

const formatHeadline = (date: Date, mode: ViewMode) => {
  return mode === 'month'
    ? date.toLocaleDateString([], { month: 'long', year: 'numeric' })
    : date.toLocaleDateString([], { weekday: 'long', month: 'short', day: 'numeric' });
};

const calculateWeekStart = (source: Date) => {
  const target = new Date(source);
  target.setHours(0, 0, 0, 0);
  target.setDate(target.getDate() - target.getDay());
  return target;
};

const shiftIdFromEvent = (event: ShiftEvent | null) => event?.id ?? '';

export const CalendarPage = () => {
  const { selectedAccount } = useAccountContext();
  const { currentStaff } = useAuth();
  const { setShifts, setAssignments, setKids } = useScheduleStore();
  const queryClient = useQueryClient();
  const isAdmin = currentStaff ? ADMIN_ROLE_SET.has(currentStaff.role) : false;
  const accountId = selectedAccount?.id ?? '';

  const [viewMode, setViewMode] = useState<ViewMode>('week');
  const [focusDate, setFocusDate] = useState(() => new Date());
  const [activeShift, setActiveShift] = useState<ShiftEvent | null>(null);
  const [message, setMessage] = useState('');
  const [connectedIds, setConnectedIds] = useState('');
  const [feedback, setFeedback] = useState<string | null>(null);

  const { data: shifts = [], isLoading } = useQuery(
    ['shifts', accountId],
    () => fetchShifts(accountId),
    {
      enabled: Boolean(accountId),
      refetchOnWindowFocus: false,
      onSuccess(data) {
        setShifts(data);
        setAssignments(data.flatMap((shift) => shift.assignments ?? []));
        setKids(data.flatMap((shift) => shift.kids ?? []));
      },
    },
  );

  const { data: staffList = [] } = useQuery(['accountStaff', accountId], () => fetchAccountStaff(accountId), {
    enabled: Boolean(accountId),
  });

  const handleStreamEvent = useCallback(
    ({ type }: { type: string }) => {
      if (!accountId) {
        return;
      }
      if (
        type === 'shift_update' ||
        type === 'shift_create' ||
        type === 'shift_delete' ||
        type === 'assignment_update' ||
        type === 'open_shift_request' ||
        type === 'open_shift_request_response' ||
        type === 'shift_request_broadcast'
      ) {
        queryClient.invalidateQueries(['shifts', accountId]);
      }
    },
    [queryClient, accountId],
  );

  useEventStream(handleStreamEvent);

  const coverageMutation = useMutation<
    unknown,
    unknown,
    { shiftId: string; message: string; connectedAccountIds: string[] }
  >(
    ({ shiftId, message, connectedAccountIds }) =>
      requestShiftCoverage(shiftId, {
        message,
        connected_account_ids: connectedAccountIds,
      }),
    {
      onSuccess() {
        setFeedback('Coverage request queued.');
        setActiveShift(null);
        setMessage('');
        setConnectedIds('');
        if (accountId) {
          queryClient.invalidateQueries(['shifts', accountId]);
        }
      },
      onError() {
        setFeedback('Unable to send coverage request.');
      },
    },
  );

  const handleRequestCoverage = useCallback(
    (shift: ShiftEvent) => {
      setActiveShift(shift);
      setFeedback(null);
      setMessage(`Looking for help at ${shift.site} (${new Date(shift.start_time).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}).`);
    },
    [setActiveShift],
  );

  const moveFocus = (direction: -1 | 1) => {
    const updated = new Date(focusDate);
    if (viewMode === 'day') {
      updated.setDate(updated.getDate() + direction);
    } else if (viewMode === 'week') {
      updated.setDate(updated.getDate() + direction * 7);
    } else {
      updated.setMonth(updated.getMonth() + direction);
    }
    setFocusDate(updated);
  };

  const submitCoverageRequest = () => {
    if (!activeShift) {
      return;
    }
    const connectedAccountIds = connectedIds
      .split(',')
      .map((entry) => entry.trim())
      .filter(Boolean);
    coverageMutation.mutate({
      shiftId: activeShift.id,
      message: message.trim(),
      connectedAccountIds,
    });
  };

  const dayShifts = useMemo(
    () => shifts.filter((shift) => new Date(shift.start_time).toDateString() === focusDate.toDateString()),
    [focusDate, shifts],
  );
  const weekStart = useMemo(() => calculateWeekStart(focusDate), [focusDate]);

  const { data: projectionSettings } = useQuery(
    ['projectionSettings', accountId],
    () => fetchProjectionSettings(accountId),
    {
      enabled: Boolean(accountId),
      refetchOnWindowFocus: false,
    },
  );

  const shiftTemplates = projectionSettings?.shifts ?? [];

  const viewContent = useMemo(() => {
    if (viewMode === 'day') {
      return (
        <DayView
          date={focusDate}
          shifts={dayShifts}
          isAdmin={isAdmin}
          onRequestCoverage={handleRequestCoverage}
          shiftTemplates={shiftTemplates}
          staffMembers={staffList}
        />
      );
    }
    if (viewMode === 'week') {
      return (
        <WeekView
          weekStart={weekStart}
          shifts={shifts}
          isAdmin={isAdmin}
          onRequestCoverage={handleRequestCoverage}
          shiftTemplates={shiftTemplates}
          staffMembers={staffList}
        />
      );
    }
    return (
      <MonthView
        monthDate={focusDate}
        shifts={shifts}
        isAdmin={isAdmin}
        onRequestCoverage={handleRequestCoverage}
        staffMembers={staffList}
        shiftTemplates={shiftTemplates}
      />
    );
  }, [dayShifts, focusDate, handleRequestCoverage, isAdmin, shiftTemplates, viewMode, staffList, weekStart, shifts]);

  return (
    <section className="space-y-8">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-sm uppercase tracking-[0.4em] text-slate-500">{selectedAccount?.name}</p>
          <h1 className="text-3xl font-semibold text-white">Projection</h1>
          <p className="text-sm text-slate-400">Switch between day, week, and month views to preview upcoming staffing coverage.</p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={() => moveFocus(-1)}
            className="rounded-full border border-white/30 bg-white/10 px-3 py-2 text-xs font-semibold text-white transition hover:border-white"
          >
            Previous
          </button>
          <button
            type="button"
            onClick={() => moveFocus(1)}
            className="rounded-full border border-white/30 bg-white/10 px-3 py-2 text-xs font-semibold text-white transition hover:border-white"
          >
            Next
          </button>
          <ViewSwitcher value={viewMode} onChange={(mode) => setViewMode(mode)} />
        </div>
      </header>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <StatusChip label={viewMode} color={viewMode === 'month' ? '#38bdf8' : viewMode === 'week' ? '#a855f7' : '#f472b6'} />
        <p className="text-sm text-slate-400">{formatHeadline(focusDate, viewMode)}</p>
      </div>

      {coverageMutation.isIdle || coverageMutation.isLoading ? null : feedback ? (
        <p className="text-xs text-emerald-400">{feedback}</p>
      ) : null}

      {activeShift && (
        <div className="rounded-2xl border border-dashed border-slate-800/40 bg-slate-900/60 p-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-xs uppercase tracking-[0.4em] text-slate-500">Coverage request</p>
              <p className="text-lg font-semibold text-white">{activeShift.site}</p>
              <p className="text-sm text-slate-400">
                {new Date(activeShift.start_time).toLocaleString()} – {new Date(activeShift.end_time).toLocaleTimeString()}
              </p>
            </div>
            <button
              type="button"
              onClick={() => setActiveShift(null)}
              className="text-xs font-semibold uppercase tracking-[0.4em] text-slate-500 underline"
            >
              Dismiss
            </button>
          </div>
          <textarea
            value={message}
            onChange={(event) => setMessage(event.target.value)}
            placeholder="Include any additional details for the coverage request."
            className="mt-4 w-full rounded-2xl border border-slate-800 bg-slate-950/60 px-3 py-2 text-sm text-white focus:border-brand-500 focus:outline-none"
          />
          <input
            value={connectedIds}
            onChange={(event) => setConnectedIds(event.target.value)}
            placeholder="Connected account IDs (comma separated)"
            className="mt-3 w-full rounded-2xl border border-slate-800 bg-slate-950/60 px-3 py-2 text-sm text-white focus:border-brand-500 focus:outline-none"
          />
          <div className="mt-4 flex items-center gap-3">
            <button
              type="button"
              onClick={submitCoverageRequest}
              disabled={coverageMutation.isLoading}
              className="rounded-2xl bg-gradient-to-r from-brand-500 to-brand-700 px-4 py-2 text-sm font-semibold text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
            >
              Send coverage request
            </button>
            {coverageMutation.isLoading && <p className="text-xs text-slate-400">Sending...</p>}
          </div>
        </div>
      )}

      <div className="space-y-6">
        {isLoading ? (
          <p className="text-sm text-slate-400">Loading shifts…</p>
        ) : (
          viewContent
        )}
      </div>
    </section>
  );
};

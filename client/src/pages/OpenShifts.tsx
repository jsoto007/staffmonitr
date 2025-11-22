import { useCallback, useMemo } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { useAuth } from '../context/AuthContext';
import { useScheduleStore } from '../stores/scheduleStore';
import { useEventStream } from '../hooks/useEventStream';
import { fetchOpenShifts, requestAssignment, fetchOpenShiftRequests } from '../services/assignments';
import { StatusChip } from '../components/StatusChip';

const STATUS_COLORS: Record<string, string> = {
  pending: '#f97316',
  approved: '#22c55e',
  declined: '#ef4444',
};

export const OpenShiftsPage = () => {
  const { setOpenShifts, removeOpenShift } = useScheduleStore();
  const { currentStaff } = useAuth();
  const queryClient = useQueryClient();

  const { data: openShifts = [] } = useQuery(['open-shifts'], fetchOpenShifts, {
    onSuccess(data) {
      setOpenShifts(data);
    },
  });

  const { data: requests = [] } = useQuery(
    ['open-shift-requests', currentStaff?.id],
    () => fetchOpenShiftRequests({ staff_id: currentStaff?.id ?? '' }),
    {
      enabled: Boolean(currentStaff?.id),
      refetchOnWindowFocus: false,
    },
  );

  const handleStreamEvent = useCallback(
    ({ type }: { type: string }) => {
      if (type?.startsWith('open_shift')) {
        queryClient.invalidateQueries(['open-shifts']);
        queryClient.invalidateQueries(['open-shift-requests', currentStaff?.id]);
      }
    },
    [currentStaff?.id, queryClient],
  );

  useEventStream(handleStreamEvent);

  const requestShift = useMutation(
    ({ shiftId, assignmentId }: { shiftId: string; assignmentId: string }) =>
      requestAssignment(assignmentId, currentStaff?.id),
    {
      onSuccess(_, variables) {
        removeOpenShift(variables.shiftId);
        queryClient.invalidateQueries(['open-shift-requests', currentStaff?.id]);
      },
    },
  );

  const groupedBySite = useMemo(() => {
    return openShifts.reduce<Record<string, number>>((acc, shift) => {
      acc[shift.site] = (acc[shift.site] ?? 0) + 1;
      return acc;
    }, {});
  }, [openShifts]);

  const requestSummary = useMemo(
    () =>
      requests.reduce(
        (acc, request) => {
          acc.total += 1;
          if (request.status === 'approved') acc.approved += 1;
          if (request.status === 'declined') acc.declined += 1;
          return acc;
        },
        { total: 0, approved: 0, declined: 0 },
      ),
    [requests],
  );

  return (
    <section className="space-y-6">
      <header className="flex items-center justify-between gap-3">
        <div>
          <p className="text-sm uppercase tracking-[0.4em] text-slate-500">Open shifts</p>
          <h1 className="text-3xl font-semibold text-white">Request new assignments</h1>
        </div>
        <StatusChip label={`${openShifts.length} live`} color={openShifts.length ? '#4ade80' : '#94a3b8'} />
      </header>

      <p className="text-sm text-slate-400">
        Review published open shifts, submit your interest, and track admin responses without leaving this panel.
      </p>

      <div className="grid gap-4 md:grid-cols-2">
        {openShifts.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-800/40 p-6 text-sm text-slate-500">
            No open shifts have been published yet. Admins can broadcast coverage needs from the calendar.
          </div>
        ) : (
          openShifts.map((shift) => (
            <article key={shift.id} className="space-y-3 rounded-2xl border border-slate-800 bg-slate-900/60 p-5">
              <div className="flex items-center justify-between gap-2">
                <div>
                  <p className="text-xs uppercase tracking-[0.4em] text-slate-500">{shift.site}</p>
                  <p className="text-lg font-semibold text-white">
                    {new Date(shift.start_time).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })} –{' '}
                    {new Date(shift.end_time).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}
                  </p>
                </div>
                <StatusChip label={shift.role} color="#a855f7" />
              </div>
              <p className="text-sm text-slate-400">Ratio min: {shift.ratio_min ?? 1}</p>
              {shift.pendingAssignmentId && (
                <button
                  type="button"
                  onClick={() => requestShift.mutate({ shiftId: shift.id, assignmentId: shift.pendingAssignmentId! })}
                  disabled={requestShift.isLoading}
                  className="rounded-2xl border border-brand-500 bg-gradient-to-r from-brand-500 to-brand-700 px-4 py-2 text-sm font-semibold text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {requestShift.isLoading ? 'Requesting…' : 'Request this shift'}
                </button>
              )}
              <p className="text-xs text-slate-500">
                {shift.assignments.length} assignment{shift.assignments.length === 1 ? '' : 's'}
              </p>
            </article>
          ))
        )}
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <div className="rounded-2xl border border-dashed border-slate-800/40 p-4 text-sm text-slate-300">
          <p className="text-xs uppercase tracking-[0.4em] text-slate-500">Summary</p>
          <p className="text-3xl font-semibold text-white">{requestSummary.total}</p>
          <p className="text-xs text-slate-500">requests submitted</p>
        </div>
        <div className="rounded-2xl border border-dashed border-slate-800/40 p-4 text-sm text-slate-300">
          <p className="text-xs uppercase tracking-[0.4em] text-slate-500">Approved</p>
          <p className="text-3xl font-semibold text-white">{requestSummary.approved}</p>
          <p className="text-xs text-slate-500">ready assignments</p>
        </div>
        <div className="rounded-2xl border border-dashed border-slate-800/40 p-4 text-sm text-slate-300">
          <p className="text-xs uppercase tracking-[0.4em] text-slate-500">Declined</p>
          <p className="text-3xl font-semibold text-white">{requestSummary.declined}</p>
          <p className="text-xs text-slate-500">needs follow-up</p>
        </div>
      </div>

      <section className="space-y-4 rounded-2xl border border-slate-800/40 bg-slate-900/60 p-5">
        <header className="flex items-center justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.4em] text-slate-500">Your requests</p>
            <h2 className="text-lg font-semibold text-white">Request status</h2>
          </div>
          <StatusChip label={`${requests.length} tracked`} color="#38bdf8" />
        </header>

        {requests.length === 0 ? (
          <p className="text-sm text-slate-500">Send a request and it will appear here once the admin responds.</p>
        ) : (
          requests.map((request) => (
            <article
              key={request.id}
              className="flex flex-col gap-3 rounded-2xl border border-white/10 bg-slate-950/50 p-4 text-sm text-slate-300"
            >
              <div className="flex items-center justify-between gap-3">
                <p className="text-base font-semibold text-white">{request.shift?.site ?? 'Shift'}</p>
                <StatusChip label={request.status} color={STATUS_COLORS[request.status] ?? '#94a3b8'} />
              </div>
              <p>
                Requested on {new Date(request.requested_at).toLocaleString()} ·{' '}
                {request.shift ? (
                  <>
                    {new Date(request.shift.start_time).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })} –
                    {new Date(request.shift.end_time).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}
                  </>
                ) : (
                  'Shift details unavailable'
                )}
              </p>
              <p className="text-xs text-slate-500">{request.status === 'pending' ? 'Awaiting admin approval' : 'Response recorded'}</p>
            </article>
          ))
        )}
      </section>

      {Object.keys(groupedBySite).length > 0 && (
        <div className="rounded-2xl border border-slate-800/40 bg-slate-900/60 p-5 text-sm text-slate-300">
          <p className="text-xs uppercase tracking-[0.4em] text-slate-500">Focus areas</p>
          <div className="mt-3 flex flex-wrap gap-2">
            {Object.entries(groupedBySite).map(([site, count]) => (
              <span key={site} className="rounded-full border border-white/10 px-3 py-1 text-xs text-white">
                {site} · {count} shift{count === 1 ? '' : 's'}
              </span>
            ))}
          </div>
        </div>
      )}
    </section>
  );
};

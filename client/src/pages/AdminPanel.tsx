import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { useAccountContext } from '../context/AccountContext';
import { useAuth } from '../context/AuthContext';
import { TeamManager } from '../components/TeamManager';
import { StatusChip } from '../components/StatusChip';
import { fetchShifts, createShift, updateShift, deleteShift } from '../services/shifts';
import {
  fetchOpenShiftRequests,
  createAssignment,
  updateAssignment,
  deleteAssignment,
  respondToOpenShiftRequest,
} from '../services/assignments';
import { fetchAccountStaff, updateAccountStaff, removeAccountStaff } from '../services/staff';
import { useScheduleStore } from '../stores/scheduleStore';
import { ADMIN_ROLE_SET, ROLE_OPTIONS } from '../constants/roles';
const STATUS_OPTIONS = ['active', 'paused', 'inactive'] as const;
const REQUEST_STATUS_COLORS: Record<string, string> = {
  pending: '#f97316',
  approved: '#22c55e',
  declined: '#ef4444',
};

export const AdminPanel = () => {
  const { selectedAccount } = useAccountContext();
  const { currentStaff } = useAuth();
  const { setShifts, setAssignments, setKids } = useScheduleStore();
  const queryClient = useQueryClient();

  const isAdmin = currentStaff ? ADMIN_ROLE_SET.has(currentStaff.role) : false;
  const accountId = selectedAccount?.id;

  const [shiftForm, setShiftForm] = useState({
    site: '',
    start_time: '',
    end_time: '',
    ratio_min: 1,
    leads_required: 1,
    difficulty: 'standard',
    is_special: false,
    openShift: true,
  });

  const [assignmentForm, setAssignmentForm] = useState({
    shift_id: '',
    staff_id: '',
    title: '',
    difficulty_rating: 2,
    instructions: '',
  });

  const { data: shifts = [] } = useQuery(
    ['shifts', accountId],
    () => fetchShifts(accountId as string),
    {
      enabled: Boolean(accountId),
      onSuccess(data) {
        setShifts(data);
        setAssignments(data.flatMap((shift) => shift.assignments ?? []));
        setKids(data.flatMap((shift) => shift.kids ?? []));
      },
    },
  );

  const { data: staffList = [], refetch: refetchStaff } = useQuery(
    ['accountStaff', accountId],
    () => fetchAccountStaff(accountId as string),
    {
      enabled: Boolean(accountId && isAdmin),
    },
  );

  const { data: openShiftRequests = [] } = useQuery(
    ['open-shift-requests', accountId],
    () => fetchOpenShiftRequests({ account_id: accountId! }),
    {
      enabled: Boolean(accountId),
    },
  );

  const shiftMutation = useMutation((payload: typeof shiftForm) => createShift({ account_group_id: accountId!, ...payload }), {
    onSuccess() {
      queryClient.invalidateQueries(['shifts', accountId]);
      setShiftForm((prev) => ({ ...prev, site: '', start_time: '', end_time: '' }));
    },
  });

  const updateShiftMutation = useMutation(
    ({ id, payload }: { id: string; payload: Record<string, unknown> }) => updateShift(id, payload),
    {
      onSuccess() {
        queryClient.invalidateQueries(['shifts', accountId]);
      },
    },
  );

  const deleteShiftMutation = useMutation((shiftId: string) => deleteShift(shiftId), {
    onSuccess() {
      queryClient.invalidateQueries(['shifts', accountId]);
    },
  });

  const assignmentMutation = useMutation((payload: typeof assignmentForm & { kids?: unknown[] }) => createAssignment(payload), {
    onSuccess() {
      queryClient.invalidateQueries(['shifts', accountId]);
      setAssignmentForm({ shift_id: '', staff_id: '', title: '', difficulty_rating: 2, instructions: '' });
    },
  });

  const assignmentUpdateMutation = useMutation(
    ({ id, payload }: { id: string; payload: Record<string, unknown> }) => updateAssignment(id, payload),
    {
      onSuccess() {
        queryClient.invalidateQueries(['shifts', accountId]);
      },
    },
  );

  const assignmentDeleteMutation = useMutation((id: string) => deleteAssignment(id), {
    onSuccess() {
      queryClient.invalidateQueries(['shifts', accountId]);
    },
  });

  const staffUpdateMutation = useMutation(
    ({ staffId, payload }: { staffId: string; payload: Record<string, unknown> }) => updateAccountStaff(accountId as string, staffId, payload),
    {
      onSuccess() {
        refetchStaff();
      },
    },
  );

  const staffRemoveMutation = useMutation((staffId: string) => removeAccountStaff(accountId as string, staffId), {
    onSuccess() {
      refetchStaff();
    },
  });

  const respondRequestMutation = useMutation(
    ({ requestId, action }: { requestId: string; action: 'approve' | 'decline' }) =>
      respondToOpenShiftRequest(requestId, action),
    {
      onSuccess() {
        queryClient.invalidateQueries(['open-shift-requests', accountId]);
        queryClient.invalidateQueries(['shifts', accountId]);
      },
    },
  );

  const assignments = useMemo(
    () => shifts.flatMap((shift) => (shift.assignments ?? []).map((assignment) => ({ ...assignment, shift }))),
    [shifts],
  );

  if (!isAdmin) {
    return (
      <section className="rounded-2xl border border-slate-800 bg-slate-900/60 p-6 text-sm text-slate-400">
        <p>Only admins can access the management workspace.</p>
      </section>
    );
  }

  const handleShiftFormChange = (field: keyof typeof shiftForm, value: string | number | boolean) => {
    setShiftForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleAssignmentChange = (field: keyof typeof assignmentForm, value: string | number) => {
    setAssignmentForm((prev) => ({ ...prev, [field]: value }));
  };

  return (
    <section className="space-y-8">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm uppercase tracking-[0.4em] text-slate-500">{selectedAccount?.name}</p>
          <h1 className="text-3xl font-semibold text-white">Admin console</h1>
        </div>
        <StatusChip label="Full CRUD" color="#34d399" />
      </header>

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="space-y-4 rounded-2xl border border-slate-800 bg-slate-900/60 p-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs uppercase tracking-[0.4em] text-slate-500">Staff roster</p>
              <h2 className="text-lg font-semibold text-white">Manage administrators & staff</h2>
            </div>
          </div>

          <TeamManager />

          <div className="space-y-3">
            {staffList.map((staff) => (
              <div key={staff.id} className="rounded-2xl border border-white/10 bg-slate-950/50 p-4">
                <div className="flex items-center justify-between">
                  <p className="text-base font-semibold text-white">{staff.full_name}</p>
                  <div className="flex items-center gap-2 text-xs uppercase tracking-[0.3em] text-slate-400">
                    <StatusChip label={staff.role} color="#818cf8" />
                  </div>
                </div>
                <p className="text-xs text-slate-400">{staff.email}</p>
                <div className="mt-3 grid gap-3 sm:grid-cols-2">
                  <label className="text-xs text-slate-400">
                    Role
                    <select
                      value={staff.role}
                      onChange={(event) =>
                        staffUpdateMutation.mutate({ staffId: staff.id, payload: { role: event.target.value } })
                      }
                      className="mt-1 w-full rounded-2xl border border-slate-800 bg-slate-950/70 px-3 py-2 text-sm text-white focus:border-brand-500 focus:outline-none"
                    >
                      {ROLE_OPTIONS.map((role) => (
                        <option key={role} value={role}>
                          {role}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="text-xs text-slate-400">
                    Status
                    <select
                      value={staff.status}
                      onChange={(event) =>
                        staffUpdateMutation.mutate({ staffId: staff.id, payload: { status: event.target.value } })
                      }
                      className="mt-1 w-full rounded-2xl border border-slate-800 bg-slate-950/70 px-3 py-2 text-sm text-white focus:border-brand-500 focus:outline-none"
                    >
                      {STATUS_OPTIONS.map((status) => (
                        <option key={status} value={status}>
                          {status}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>
                <button
                  type="button"
                  onClick={() => staffRemoveMutation.mutate(staff.id)}
                  className="mt-3 rounded-2xl border border-red-500/60 px-4 py-2 text-xs font-semibold uppercase tracking-[0.4em] text-red-300 transition hover:bg-red-500/10"
                >
                  Remove from account
                </button>
              </div>
            ))}
          </div>
        </section>

        <section className="space-y-4 rounded-2xl border border-slate-800 bg-slate-900/60 p-5">
          <header>
            <p className="text-xs uppercase tracking-[0.4em] text-slate-500">Shifts</p>
            <h2 className="text-lg font-semibold text-white">Schedule & publish</h2>
          </header>

          <form
            onSubmit={(event) => {
              event.preventDefault();
              if (!shiftForm.start_time || !shiftForm.end_time || !shiftForm.site) return;
              shiftMutation.mutate({
                ...shiftForm,
                start_time: new Date(shiftForm.start_time).toISOString(),
                end_time: new Date(shiftForm.end_time).toISOString(),
              });
            }}
            className="space-y-3"
          >
            <label className="text-xs text-slate-400">
              Site
              <input
                value={shiftForm.site}
                onChange={(event) => handleShiftFormChange('site', event.target.value)}
                className="mt-1 w-full rounded-2xl border border-slate-800 bg-slate-950/70 px-3 py-2 text-sm text-white focus:border-brand-500 focus:outline-none"
              />
            </label>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="text-xs text-slate-400">
                Start
                <input
                  type="datetime-local"
                  value={shiftForm.start_time}
                  onChange={(event) => handleShiftFormChange('start_time', event.target.value)}
                  className="mt-1 w-full rounded-2xl border border-slate-800 bg-slate-950/70 px-3 py-2 text-sm text-white focus:border-brand-500 focus:outline-none"
                />
              </label>
              <label className="text-xs text-slate-400">
                End
                <input
                  type="datetime-local"
                  value={shiftForm.end_time}
                  onChange={(event) => handleShiftFormChange('end_time', event.target.value)}
                  className="mt-1 w-full rounded-2xl border border-slate-800 bg-slate-950/70 px-3 py-2 text-sm text-white focus:border-brand-500 focus:outline-none"
                />
              </label>
            </div>
            <div className="grid gap-3 sm:grid-cols-3">
              <label className="text-xs text-slate-400">
                Ratio min
                <input
                  type="number"
                  min={1}
                  value={shiftForm.ratio_min}
                  onChange={(event) => handleShiftFormChange('ratio_min', Number(event.target.value))}
                  className="mt-1 w-full rounded-2xl border border-slate-800 bg-slate-950/70 px-3 py-2 text-sm text-white focus:border-brand-500 focus:outline-none"
                />
              </label>
              <label className="text-xs text-slate-400">
                Leads required
                <input
                  type="number"
                  min={1}
                  value={shiftForm.leads_required}
                  onChange={(event) => handleShiftFormChange('leads_required', Number(event.target.value))}
                  className="mt-1 w-full rounded-2xl border border-slate-800 bg-slate-950/70 px-3 py-2 text-sm text-white focus:border-brand-500 focus:outline-none"
                />
              </label>
              <label className="text-xs text-slate-400">
                Difficulty
                <input
                  value={shiftForm.difficulty}
                  onChange={(event) => handleShiftFormChange('difficulty', event.target.value)}
                  className="mt-1 w-full rounded-2xl border border-slate-800 bg-slate-950/70 px-3 py-2 text-sm text-white focus:border-brand-500 focus:outline-none"
                />
              </label>
            </div>
            <div className="flex items-center gap-3 text-xs text-slate-400">
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={shiftForm.is_special}
                  onChange={(event) => handleShiftFormChange('is_special', event.target.checked)}
                  className="h-4 w-4 rounded border border-slate-600 bg-slate-900 text-brand-500 focus:ring-brand-500"
                />
                Special
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={shiftForm.openShift}
                  onChange={(event) => handleShiftFormChange('openShift', event.target.checked)}
                  className="h-4 w-4 rounded border border-slate-600 bg-slate-900 text-brand-500 focus:ring-brand-500"
                />
                Publish open shift
              </label>
            </div>
            <button
              type="submit"
              className="w-full rounded-2xl bg-gradient-to-r from-brand-500 to-brand-700 px-4 py-3 text-sm font-semibold text-white uppercase tracking-[0.3em] transition hover:opacity-90"
            >
              Add shift
            </button>
          </form>

          <div className="space-y-3">
            {shifts.map((shift) => (
              <article key={shift.id} className="rounded-2xl border border-white/10 bg-slate-950/50 p-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="text-sm uppercase tracking-[0.4em] text-slate-500">{shift.site}</p>
                    <p className="text-lg font-semibold text-white">
                      {new Date(shift.start_time).toLocaleString()} – {new Date(shift.end_time).toLocaleTimeString()}
                    </p>
                  </div>
                  <StatusChip label={`${shift.assignments.length} assignment${shift.assignments.length === 1 ? '' : 's'}`} color="#38bdf8" />
                </div>
                <div className="mt-3 grid gap-3 sm:grid-cols-3">
                  <label className="text-xs text-slate-400">
                    Ratio min
                    <input
                      type="number"
                      min={1}
                      value={shift.ratio_min ?? 1}
                      onChange={(event) =>
                        updateShiftMutation.mutate({
                          id: shift.id,
                          payload: { ratio_min: Number(event.target.value) },
                        })
                      }
                      className="mt-1 w-full rounded-2xl border border-slate-800 bg-slate-950/70 px-3 py-2 text-sm text-white focus:border-brand-500 focus:outline-none"
                    />
                  </label>
                  <label className="text-xs text-slate-400">
                    Leads
                    <input
                      type="number"
                      min={1}
                      value={shift.leadsRequired ?? 1}
                      onChange={(event) =>
                        updateShiftMutation.mutate({
                          id: shift.id,
                          payload: { leads_required: Number(event.target.value) },
                        })
                      }
                      className="mt-1 w-full rounded-2xl border border-slate-800 bg-slate-950/70 px-3 py-2 text-sm text-white focus:border-brand-500 focus:outline-none"
                    />
                  </label>
                  <label className="flex items-center gap-2 text-xs text-slate-400">
                    <input
                      type="checkbox"
                      checked={shift.openShift ?? false}
                      onChange={(event) =>
                        updateShiftMutation.mutate({
                          id: shift.id,
                          payload: { openShift: event.target.checked },
                        })
                      }
                      className="h-4 w-4 rounded border border-slate-600 bg-slate-900 text-brand-500 focus:ring-brand-500"
                    />
                    Open
                  </label>
                </div>
                <div className="mt-3 flex flex-wrap justify-between gap-3">
                  <button
                    type="button"
                    onClick={() =>
                      deleteShiftMutation.mutate(shift.id)
                    }
                    className="rounded-2xl border border-red-500/60 px-4 py-2 text-xs font-semibold uppercase tracking-[0.4em] text-red-300 transition hover:bg-red-500/10"
                  >
                    Remove
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      updateShiftMutation.mutate({
                        id: shift.id,
                        payload: { difficulty: shift.difficulty ?? 'standard' },
                      })
                    }
                    className="rounded-2xl bg-white/10 px-4 py-2 text-xs font-semibold uppercase tracking-[0.3em] text-white transition hover:bg-white/20"
                  >
                    Refresh difficulty
                  </button>
                </div>
              </article>
            ))}
          </div>
        </section>
      </div>

      <section className="space-y-4 rounded-2xl border border-slate-800 bg-slate-900/60 p-5">
        <header>
          <p className="text-xs uppercase tracking-[0.4em] text-slate-500">Assignments</p>
          <h2 className="text-lg font-semibold text-white">Balance work across shifts</h2>
        </header>

        <form
          onSubmit={(event) => {
            event.preventDefault();
            assignmentMutation.mutate({ ...assignmentForm });
          }}
          className="grid gap-3 lg:grid-cols-3"
        >
          <label className="text-xs text-slate-400">
            Shift
            <select
              value={assignmentForm.shift_id}
              onChange={(event) => handleAssignmentChange('shift_id', event.target.value)}
              className="mt-1 w-full rounded-2xl border border-slate-800 bg-slate-950/70 px-3 py-2 text-sm text-white focus:border-brand-500 focus:outline-none"
              required
            >
              <option value="">Select shift</option>
              {shifts.map((shift) => (
                <option key={shift.id} value={shift.id}>
                  {shift.site} · {new Date(shift.start_time).toLocaleDateString()}
                </option>
              ))}
            </select>
          </label>
          <label className="text-xs text-slate-400">
            Staff
            <select
              value={assignmentForm.staff_id}
              onChange={(event) => handleAssignmentChange('staff_id', event.target.value)}
              className="mt-1 w-full rounded-2xl border border-slate-800 bg-slate-950/70 px-3 py-2 text-sm text-white focus:border-brand-500 focus:outline-none"
            >
              <option value="">Unassigned</option>
              {staffList.map((staff) => (
                <option key={staff.id} value={staff.id}>
                  {staff.full_name} ({staff.role})
                </option>
              ))}
            </select>
          </label>
          <label className="text-xs text-slate-400">
            Difficulty
            <input
              type="number"
              min={1}
              max={5}
              value={assignmentForm.difficulty_rating}
              onChange={(event) => handleAssignmentChange('difficulty_rating', Number(event.target.value))}
              className="mt-1 w-full rounded-2xl border border-slate-800 bg-slate-950/70 px-3 py-2 text-sm text-white focus:border-brand-500 focus:outline-none"
            />
          </label>
          <label className="text-xs text-slate-400 lg:col-span-3">
            Title
            <input
              value={assignmentForm.title}
              onChange={(event) => handleAssignmentChange('title', event.target.value)}
              className="mt-1 w-full rounded-2xl border border-slate-800 bg-slate-950/70 px-3 py-2 text-sm text-white focus:border-brand-500 focus:outline-none"
            />
          </label>
          <label className="text-xs text-slate-400 lg:col-span-3">
            Instructions
            <textarea
              value={assignmentForm.instructions}
              onChange={(event) => handleAssignmentChange('instructions', event.target.value)}
              className="mt-1 w-full rounded-2xl border border-slate-800 bg-slate-950/70 px-3 py-2 text-sm text-white focus:border-brand-500 focus:outline-none"
            />
          </label>
          <button
            type="submit"
            className="lg:col-span-3 rounded-2xl bg-gradient-to-r from-brand-500 to-brand-700 px-4 py-3 text-sm font-semibold text-white uppercase tracking-[0.3em] transition hover:opacity-90"
          >
            Create assignment
          </button>
        </form>

        <div className="space-y-3">
          {assignments.map((assignment) => (
            <article key={assignment.id} className="rounded-2xl border border-white/10 bg-slate-950/60 p-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <p className="text-base font-semibold text-white">
                  {assignment.title} · {assignment.shift?.site}
                </p>
                <StatusChip label={`${assignment.shift?.role ?? 'Staff'}`} color="#34d399" />
              </div>
              <p className="mt-2 text-xs uppercase tracking-[0.3em] text-slate-500">
                {assignment.shift ? new Date(assignment.shift.start_time).toLocaleDateString() : 'Unlinked'}
              </p>
              <div className="mt-3 grid gap-3 sm:grid-cols-3">
                <label className="text-xs text-slate-400">
                  Staff
                  <select
                    value={assignment.staff_id ?? ''}
                    onChange={(event) =>
                      assignmentUpdateMutation.mutate({
                        id: assignment.id,
                        payload: { staff_id: event.target.value || null },
                      })
                    }
                    className="mt-1 w-full rounded-2xl border border-slate-800 bg-slate-950/70 px-3 py-2 text-sm text-white focus:border-brand-500 focus:outline-none"
                  >
                    <option value="">Unassigned</option>
                    {staffList.map((staff) => (
                      <option key={staff.id} value={staff.id}>
                        {staff.full_name}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="text-xs text-slate-400">
                  Difficulty
                  <input
                    type="number"
                    min={1}
                    max={5}
                    value={assignment.difficulty ?? 2}
                    onChange={(event) =>
                      assignmentUpdateMutation.mutate({
                        id: assignment.id,
                        payload: { difficulty_rating: Number(event.target.value) },
                      })
                    }
                    className="mt-1 w-full rounded-2xl border border-slate-800 bg-slate-950/70 px-3 py-2 text-sm text-white focus:border-brand-500 focus:outline-none"
                  />
                </label>
                <button
                  type="button"
                  onClick={() => assignmentDeleteMutation.mutate(assignment.id)}
                  className="rounded-2xl border border-red-500/60 px-4 py-2 text-xs font-semibold uppercase tracking-[0.4em] text-red-300 transition hover:bg-red-500/10"
                >
                  Remove
                </button>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="space-y-4 rounded-2xl border border-slate-800 bg-slate-900/60 p-5">
        <header className="flex items-center justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.4em] text-slate-500">Open shift requests</p>
            <h2 className="text-lg font-semibold text-white">Respond to staff</h2>
          </div>
          <StatusChip label={`${openShiftRequests.length} pending`} color="#38bdf8" />
        </header>
        {openShiftRequests.length === 0 ? (
          <p className="text-sm text-slate-400">No outstanding requests right now.</p>
        ) : (
          <div className="space-y-3">
            {openShiftRequests.map((request) => (
              <article key={request.id} className="rounded-2xl border border-white/5 bg-slate-950/60 p-4 text-sm text-slate-300">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <p className="text-base font-semibold text-white">{request.shift?.site ?? 'Unlinked shift'}</p>
                  <StatusChip label={request.status} color={REQUEST_STATUS_COLORS[request.status] ?? '#94a3b8'} />
                </div>
                <p className="text-xs text-slate-500">
                  Requested by {request.staff?.full_name ?? 'a teammate'} · {new Date(request.requested_at).toLocaleString()}
                </p>
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => respondRequestMutation.mutate({ requestId: request.id, action: 'approve' })}
                    disabled={request.status !== 'pending' || respondRequestMutation.isLoading}
                    className="rounded-2xl border border-emerald-500/60 bg-emerald-500/10 px-4 py-2 text-xs font-semibold uppercase tracking-[0.3em] text-emerald-200 transition hover:bg-emerald-500/20 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    Approve
                  </button>
                  <button
                    type="button"
                    onClick={() => respondRequestMutation.mutate({ requestId: request.id, action: 'decline' })}
                    disabled={request.status !== 'pending' || respondRequestMutation.isLoading}
                    className="rounded-2xl border border-red-500/60 bg-red-500/10 px-4 py-2 text-xs font-semibold uppercase tracking-[0.3em] text-red-200 transition hover:bg-red-500/20 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    Decline
                  </button>
                  <p className="text-xs text-slate-500">Shift ID: {request.shift_id}</p>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
    </section>
  );
};

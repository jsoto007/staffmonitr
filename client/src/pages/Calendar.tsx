import { useCallback, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { useAccountContext } from '../context/AccountContext';
import { useAuth } from '../context/AuthContext';
import { useScheduleStore } from '../stores/scheduleStore';
import { fetchShifts, requestShiftCoverage, createShift } from '../services/shifts';
import { fetchAccountStaff } from '../services/staff';
import { fetchProjectionSettings } from '../services/projectionSettings';
import { createAssignment, updateAssignment, deleteAssignment } from '../services/assignments';
import { ViewSwitcher } from '../components/calendar/ViewSwitcher';
import { DayView } from '../components/calendar/DayView';
import { WeekView } from '../components/calendar/WeekView';
import { MonthView } from '../components/calendar/MonthView';
import { StatusChip } from '../components/StatusChip';
import { AssignStaffModal } from '../components/calendar/AssignStaffModal';
import { useEventStream } from '../hooks/useEventStream';
import { ADMIN_ROLE_SET, ROLE_OPTIONS } from '../constants/roles';
import { timeInputToMinutes } from '../utils/time';
import type { Assignment, Role, ShiftEvent, ShiftTemplate, StaffMember } from '../types';

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

type AssignmentTarget =
  | { type: 'shift'; shift: ShiftEvent }
  | { type: 'template'; template: ShiftTemplate; date: Date };

const buildSegmentWindow = (template: ShiftTemplate, date: Date) => {
  const base = new Date(date);
  base.setHours(0, 0, 0, 0);
  const startMinutes = timeInputToMinutes(template.start_time);
  const endMinutes = timeInputToMinutes(template.end_time);
  const start = new Date(base);
  start.setMinutes(startMinutes);
  const end = new Date(base);
  end.setMinutes(endMinutes);
  if (endMinutes <= startMinutes) {
    end.setDate(end.getDate() + 1);
  }
  return { start, end };
};

const formatTimeRange = (start: Date, end: Date) =>
  `${start.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })} – ${end.toLocaleTimeString([], {
    hour: 'numeric',
    minute: '2-digit',
  })}`;

export const CalendarPage = () => {
  const { selectedAccount } = useAccountContext();
  const { currentStaff, loading: authLoading, isAuthenticated } = useAuth();
  const { setShifts, setAssignments, setKids } = useScheduleStore();
  const queryClient = useQueryClient();
  const isAdmin = currentStaff ? ADMIN_ROLE_SET.has(currentStaff.role) : false;
  const accountId = !authLoading && isAuthenticated ? selectedAccount?.id ?? '' : '';

  const [viewMode, setViewMode] = useState<ViewMode>('week');
  const [focusDate, setFocusDate] = useState(() => new Date());
  const [activeShift, setActiveShift] = useState<ShiftEvent | null>(null);
  const [message, setMessage] = useState('');
  const [connectedIds, setConnectedIds] = useState('');
  const [feedback, setFeedback] = useState<string | null>(null);
  const [assignmentTarget, setAssignmentTarget] = useState<AssignmentTarget | null>(null);
  const [assignmentFeedback, setAssignmentFeedback] = useState<string | null>(null);
  const [assignmentError, setAssignmentError] = useState<string | null>(null);
  const [removingAssignmentId, setRemovingAssignmentId] = useState<string | null>(null);
  const [roleFilter, setRoleFilter] = useState<Role | 'all'>('all');
  const [staffFilter, setStaffFilter] = useState<string | 'all'>('all');

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

  const filteredShifts = useMemo(() => {
    return shifts.filter((shift) => {
      if (roleFilter !== 'all' && shift.role !== roleFilter) {
        return false;
      }
      if (staffFilter !== 'all') {
        const assigned = shift.assignments ?? [];
        if (!assigned.some((assignment) => assignment.staff_id === staffFilter)) {
          return false;
        }
      }
      return true;
    });
  }, [shifts, roleFilter, staffFilter]);

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

  const assignmentMutation = useMutation(
    ({ shift, staffId }: { shift: ShiftEvent; staffId: string }) => {
      if (shift.pendingAssignmentId) {
        return updateAssignment(shift.pendingAssignmentId, { staff_id: staffId });
      }
      return createAssignment({
        shift_id: shift.id,
        staff_id: staffId,
        title: 'Shift assignment',
        difficulty_rating: 2,
      });
    },
    {
      onSuccess() {
        setAssignmentFeedback('Staff assigned to shift.');
        setAssignmentError(null);
        setAssignmentTarget(null);
        if (accountId) {
          queryClient.invalidateQueries(['shifts', accountId]);
        }
      },
      onError() {
        setAssignmentError('Unable to assign staff to shift.');
      },
    },
  );

  const removeAssignmentMutation = useMutation((assignmentId: string) => deleteAssignment(assignmentId), {
    onMutate(assignmentId) {
      setRemovingAssignmentId(assignmentId);
      setAssignmentError(null);
      setAssignmentFeedback(null);
    },
    onSuccess() {
      setAssignmentFeedback('Assignment removed.');
      if (accountId) {
        queryClient.invalidateQueries(['shifts', accountId]);
      }
    },
    onError() {
      setAssignmentError('Unable to remove assignment.');
    },
    onSettled() {
      setRemovingAssignmentId(null);
    },
  });

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

  const openAssignmentModal = useCallback((target: AssignmentTarget) => {
    setAssignmentTarget(target);
    setAssignmentError(null);
    setAssignmentFeedback(null);
  }, []);

  const closeAssignmentModal = useCallback(() => {
    setAssignmentTarget(null);
  }, []);

  const handleAssignShift = useCallback(
    (shift: ShiftEvent) => {
      openAssignmentModal({ type: 'shift', shift });
    },
    [openAssignmentModal],
  );

  const handleAssignTemplate = useCallback(
    (template: ShiftTemplate, date: Date) => {
      openAssignmentModal({ type: 'template', template, date });
    },
    [openAssignmentModal],
  );

  const handleRemoveAssignment = useCallback(
    (assignmentId: string) => {
      if (removingAssignmentId === assignmentId || removeAssignmentMutation.isLoading) {
        return;
      }
      removeAssignmentMutation.mutate(assignmentId);
    },
    [removeAssignmentMutation, removingAssignmentId],
  );

  const handleAssignStaff = useCallback(
    async (staffId: string) => {
      if (!assignmentTarget) {
        return;
      }
      setAssignmentError(null);
      if (assignmentTarget.type === 'shift') {
        assignmentMutation.mutate({ shift: assignmentTarget.shift, staffId });
        return;
      }
      if (!accountId) {
        setAssignmentError('Unable to locate account context.');
        return;
      }
      const { template, date } = assignmentTarget;
      const { start, end } = buildSegmentWindow(template, date);
      setAssignmentFeedback('Creating shift…');
      try {
        const response = await createShift({
          account_group_id: accountId,
          site: template.label || 'Shift',
          start_time: start.toISOString(),
          end_time: end.toISOString(),
          ratio_min: 1,
          leads_required: 1,
          difficulty: 'medium',
        });
        const newShift: ShiftEvent = {
          id: response.data.id,
          account_group_id: accountId,
          start_time: start.toISOString(),
          end_time: end.toISOString(),
          ratio_min: 1,
          role: 'Staff',
          difficulty: 'medium',
          site: template.label ?? 'Shift',
          is_special: false,
          leadsRequired: 1,
          assignments: [] as Assignment[],
        };
        assignmentMutation.mutate({ shift: newShift, staffId });
        setAssignmentFeedback('Assigning staff…');
      } catch {
        setAssignmentError('Unable to create shift for this segment.');
        setAssignmentFeedback(null);
      }
    },
    [accountId, assignmentMutation, assignmentTarget],
  );

  const dayShifts = useMemo(
    () => filteredShifts.filter((shift) => new Date(shift.start_time).toDateString() === focusDate.toDateString()),
    [focusDate, filteredShifts],
  );
  const weekStart = useMemo(() => calculateWeekStart(focusDate), [focusDate]);

  const { data: projectionSettings } = useQuery(
    ['projectionSettings', accountId],
    () => fetchProjectionSettings(accountId),
    {
      enabled: Boolean(accountId && !authLoading && isAuthenticated),
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
          onAssignStaff={handleAssignShift}
          onAssignTemplate={handleAssignTemplate}
          onRemoveAssignment={handleRemoveAssignment}
          shiftTemplates={shiftTemplates}
          staffMembers={staffList}
        />
      );
    }
    if (viewMode === 'week') {
      return (
        <WeekView
          weekStart={weekStart}
          shifts={filteredShifts}
          isAdmin={isAdmin}
          onRequestCoverage={handleRequestCoverage}
          onAssignStaff={handleAssignShift}
          onAssignTemplate={handleAssignTemplate}
          onRemoveAssignment={handleRemoveAssignment}
          shiftTemplates={shiftTemplates}
          staffMembers={staffList}
        />
      );
    }
    return (
      <MonthView
        monthDate={focusDate}
        shifts={filteredShifts}
        isAdmin={isAdmin}
        onRequestCoverage={handleRequestCoverage}
        onAssignStaff={handleAssignShift}
        onAssignTemplate={handleAssignTemplate}
        onRemoveAssignment={handleRemoveAssignment}
        staffMembers={staffList}
        shiftTemplates={shiftTemplates}
      />
    );
  }, [dayShifts, focusDate, handleRequestCoverage, isAdmin, handleAssignShift, handleAssignTemplate, handleRemoveAssignment, shiftTemplates, viewMode, staffList, weekStart, shifts]);

  const modalContext = useMemo(() => {
    if (!assignmentTarget) {
      return null;
    }
    if (assignmentTarget.type === 'shift') {
      const { shift } = assignmentTarget;
      const start = new Date(shift.start_time);
      const end = new Date(shift.end_time);
      const assignedStaffIds = (shift.assignments ?? [])
        .map((assignment) => assignment.staff_id)
        .filter(Boolean) as string[];
      return {
        site: shift.site,
        timeRange: formatTimeRange(start, end),
        ratioMin: shift.ratio_min ?? 1,
        assignedStaffIds,
        note: shift.pendingAssignmentId ? 'Open slot ready' : 'Creates a new assignment slot',
      };
    }
    const { template, date } = assignmentTarget;
    const { start, end } = buildSegmentWindow(template, date);
    return {
      site: template.label || 'Shift template',
      timeRange: formatTimeRange(start, end),
      ratioMin: 1,
      assignedStaffIds: [],
      note: 'Creates a new shift and assignment slot',
    };
  }, [assignmentTarget]);

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

      <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-white/10 bg-slate-950/50 px-4 py-3 text-xs uppercase tracking-[0.3em] text-slate-400">
        <label className="text-[10px]">
          Role
          <select
            value={roleFilter}
            onChange={(event) => setRoleFilter(event.target.value as Role | 'all')}
            className="ml-2 rounded-2xl border border-white/10 bg-slate-900/50 px-2 py-1 text-xs font-semibold uppercase tracking-[0.3em] text-white focus:border-white focus:outline-none"
          >
            <option value="all" className="bg-slate-900">All roles</option>
            {ROLE_OPTIONS.map((role) => (
              <option key={role} value={role} className="bg-slate-900">
                {role}
              </option>
            ))}
          </select>
        </label>
        <label className="text-[10px]">
          Staff
          <select
            value={staffFilter}
            onChange={(event) => setStaffFilter(event.target.value as string | 'all')}
            className="ml-2 rounded-2xl border border-white/10 bg-slate-900/50 px-2 py-1 text-xs font-semibold uppercase tracking-[0.3em] text-white focus:border-white focus:outline-none"
          >
            <option value="all" className="bg-slate-900">All staff</option>
            {staffList.map((member) => (
              <option key={member.id} value={member.id} className="bg-slate-900">
                {member.full_name}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <StatusChip label={viewMode} color={viewMode === 'month' ? '#38bdf8' : viewMode === 'week' ? '#a855f7' : '#f472b6'} />
        <p className="text-sm text-slate-400">{formatHeadline(focusDate, viewMode)}</p>
      </div>

      {coverageMutation.isIdle || coverageMutation.isLoading ? null : feedback ? (
        <p className="text-xs text-emerald-400">{feedback}</p>
      ) : null}
      {assignmentFeedback && <p className="text-xs text-emerald-400">{assignmentFeedback}</p>}

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

      {modalContext && (
        <AssignStaffModal
          site={modalContext.site}
          timeRange={modalContext.timeRange}
          ratioMin={modalContext.ratioMin}
          assignedStaffIds={modalContext.assignedStaffIds}
          note={modalContext.note}
          staffMembers={staffList}
          onClose={closeAssignmentModal}
          onAssign={handleAssignStaff}
          isLoading={assignmentMutation.isLoading}
          errorMessage={assignmentError}
        />
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

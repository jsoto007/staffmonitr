import { useCallback, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { useAccountContext } from '../context/AccountContext';
import { useAuth } from '../context/AuthContext';
import { fetchAccountStaff } from '../services/staff';
import {
  assignStaffToTemplate,
  fetchStaffMatrixCalendar,
  unassignStaffFromTemplate,
} from '../services/staffMatrix';
import { ViewSwitcher } from '../components/calendar/ViewSwitcher';
import { DayView } from '../components/calendar/DayView';
import { WeekView } from '../components/calendar/WeekView';
import { MonthView } from '../components/calendar/MonthView';
import { StatusChip } from '../components/StatusChip';
import { AssignStaffModal } from '../components/calendar/AssignStaffModal';
import { ADMIN_ROLE_SET } from '../constants/roles';
import { useStaffMatrixRoles } from '../hooks/useStaffMatrixRoles';
import type { Role, StaffMatrixCalendarEntry, StaffMember } from '../types';

type ViewMode = 'day' | 'week' | 'month';

const formatHeadline = (date: Date, mode: ViewMode) =>
  mode === 'month'
    ? date.toLocaleDateString([], { month: 'long', year: 'numeric' })
    : date.toLocaleDateString([], { weekday: 'long', month: 'short', day: 'numeric' });

const calculateWeekStart = (source: Date) => {
  const target = new Date(source);
  target.setHours(0, 0, 0, 0);
  target.setDate(target.getDate() - target.getDay());
  return target;
};

const toIsoDate = (value: Date) => value.toISOString().split('T')[0];

const getMonthWindow = (focus: Date) => {
  const start = new Date(focus.getFullYear(), focus.getMonth(), 1);
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setMonth(start.getMonth() + 1);
  end.setDate(0);
  end.setHours(0, 0, 0, 0);
  return { start, end };
};

type AssignmentTarget = { entry: StaffMatrixCalendarEntry };

export const CalendarPage = () => {
  const { selectedAccount } = useAccountContext();
  const { currentStaff, loading: authLoading, isAuthenticated } = useAuth();
  const queryClient = useQueryClient();
  const isAdmin = currentStaff ? ADMIN_ROLE_SET.has(currentStaff.role) : false;
  const accountId = !authLoading && isAuthenticated ? selectedAccount?.id ?? '' : '';

  const [viewMode, setViewMode] = useState<ViewMode>('week');
  const [focusDate, setFocusDate] = useState(() => new Date());
  const [assignmentTarget, setAssignmentTarget] = useState<AssignmentTarget | null>(null);
  const [assignmentFeedback, setAssignmentFeedback] = useState<string | null>(null);
  const [assignmentError, setAssignmentError] = useState<string | null>(null);
  const [removingAssignmentId, setRemovingAssignmentId] = useState<string | null>(null);
  const [roleFilter, setRoleFilter] = useState<Role | 'all'>('all');
  const [staffFilter, setStaffFilter] = useState<string | 'all'>('all');
  const { roles: staffMatrixRoles } = useStaffMatrixRoles(accountId);

  const calendarRange = useMemo(() => {
    if (viewMode === 'day') {
      const day = new Date(focusDate);
      day.setHours(0, 0, 0, 0);
      return { start: day, end: day };
    }
    if (viewMode === 'week') {
      const start = calculateWeekStart(focusDate);
      const end = new Date(start);
      end.setDate(end.getDate() + 6);
      return { start, end };
    }
    return getMonthWindow(focusDate);
  }, [viewMode, focusDate]);

  const startDateIso = toIsoDate(calendarRange.start);
  const endDateIso = toIsoDate(calendarRange.end);
  const calendarQueryKey = ['staffMatrixCalendar', accountId, startDateIso, endDateIso];

  const { data: calendarData, isLoading } = useQuery(
    calendarQueryKey,
    () => fetchStaffMatrixCalendar(accountId, startDateIso, endDateIso),
    {
      enabled: Boolean(accountId),
      refetchOnWindowFocus: false,
    },
  );

  const entries = calendarData?.entries ?? [];

  const filteredEntries = useMemo(() => {
    return entries.filter((entry) => {
      const matchesRole = roleFilter === 'all' || entry.template_role === roleFilter;
      const matchesStaff = staffFilter === 'all' || entry.staff_id === staffFilter;
      return matchesRole && matchesStaff;
    });
  }, [entries, roleFilter, staffFilter]);

  const entriesByDate = useMemo(() => {
    const map = new Map<string, StaffMatrixCalendarEntry[]>();
    filteredEntries.forEach((entry) => {
      const bucket = map.get(entry.date) ?? [];
      bucket.push(entry);
      map.set(entry.date, bucket);
    });
    return map;
  }, [filteredEntries]);

  const derivedRoleOptions = useMemo(() => {
    const roles = new Set<string>();
    entries.forEach((entry) => {
      if (entry.template_role) {
        roles.add(entry.template_role);
      }
    });
    return Array.from(roles).sort();
  }, [entries]);

  const matrixRoleOptions = useMemo(
    () => staffMatrixRoles.map((role) => role.name).sort((a, b) => a.localeCompare(b)),
    [staffMatrixRoles],
  );

  const combinedRoleOptions = useMemo(() => {
    const options = new Set<string>(matrixRoleOptions);
    derivedRoleOptions.forEach((role) => options.add(role));
    return Array.from(options);
  }, [derivedRoleOptions, matrixRoleOptions]);

  const { data: staffList = [] } = useQuery<StaffMember[]>(
    ['accountStaff', accountId],
    () => fetchAccountStaff(accountId),
    {
      enabled: Boolean(accountId),
      refetchOnWindowFocus: false,
    },
  );

  const weekDays = useMemo(() => {
    if (viewMode !== 'week') {
      return [];
    }
    return Array.from({ length: 7 }).map((_, index) => {
      const day = new Date(calendarRange.start);
      day.setDate(calendarRange.start.getDate() + index);
      return day;
    });
  }, [calendarRange.start, viewMode]);

  const assignmentMutation = useMutation(
    ({ entry, staffId }: { entry: StaffMatrixCalendarEntry; staffId: string }) => {
      if (!accountId) {
        return Promise.reject(new Error('Account context missing.'));
      }
      return assignStaffToTemplate(accountId, entry.template_id, {
        staff_id: staffId,
        start_date: entry.date,
        end_date: entry.date,
      });
    },
    {
      onMutate() {
        setAssignmentError(null);
        setAssignmentFeedback(null);
      },
      onSuccess() {
        setAssignmentFeedback('Staff assigned to shift.');
        setAssignmentTarget(null);
        queryClient.invalidateQueries({ queryKey: ['staffMatrixCalendar', accountId] });
      },
      onError() {
        setAssignmentError('Unable to assign staff to shift.');
      },
    },
  );

  const removeAssignmentMutation = useMutation(
    (assignmentId: string) => {
      if (!accountId) {
        return Promise.reject(new Error('Account context missing.'));
      }
      return unassignStaffFromTemplate(accountId, assignmentId);
    },
    {
      onMutate(assignmentId) {
        setRemovingAssignmentId(assignmentId);
        setAssignmentError(null);
        setAssignmentFeedback(null);
      },
      onSuccess() {
        setAssignmentFeedback('Assignment removed.');
        queryClient.invalidateQueries({ queryKey: ['staffMatrixCalendar', accountId] });
      },
      onError() {
        setAssignmentError('Unable to remove assignment.');
      },
      onSettled() {
        setRemovingAssignmentId(null);
      },
    },
  );

  const handleAssignEntry = useCallback((entry: StaffMatrixCalendarEntry) => {
    setAssignmentTarget({ entry });
  }, []);

  const handleAssignStaff = useCallback(
    (staffId: string) => {
      if (!assignmentTarget) {
        return;
      }
      assignmentMutation.mutate({ entry: assignmentTarget.entry, staffId });
    },
    [assignmentMutation, assignmentTarget],
  );

  const handleRemoveAssignment = useCallback(
    (entry: StaffMatrixCalendarEntry) => {
      if (!entry.assignment_id || removingAssignmentId === entry.assignment_id) {
        return;
      }
      removeAssignmentMutation.mutate(entry.assignment_id);
    },
    [removeAssignmentMutation, removingAssignmentId],
  );

  const modalContext = useMemo(() => {
    if (!assignmentTarget) {
      return null;
    }
    const { entry } = assignmentTarget;
    return {
      site: entry.template_label || 'Shift',
      timeRange: `${entry.start_time} – ${entry.end_time}`,
      ratioMin: 1,
      assignedStaffIds: entry.staff_id ? [entry.staff_id] : [],
      note: entry.is_open ? 'Assign coverage to this shift' : 'Reassign the slot',
    };
  }, [assignmentTarget]);

  const viewContent = useMemo(() => {
    if (viewMode === 'day') {
      const dayEntries = entriesByDate.get(toIsoDate(focusDate)) ?? [];
      return (
        <DayView
          date={focusDate}
          entries={dayEntries}
          isAdmin={isAdmin}
          onAssignEntry={handleAssignEntry}
          onRemoveAssignment={handleRemoveAssignment}
        />
      );
    }
    if (viewMode === 'week') {
      return (
        <WeekView
          weekStart={calendarRange.start}
          weekDays={weekDays}
          entriesByDate={entriesByDate}
          isAdmin={isAdmin}
          onAssignEntry={handleAssignEntry}
          onRemoveAssignment={handleRemoveAssignment}
        />
      );
    }
    return (
      <MonthView
        monthDate={focusDate}
        entries={filteredEntries}
        entriesByDate={entriesByDate}
        isAdmin={isAdmin}
        onAssignEntry={handleAssignEntry}
        onRemoveAssignment={handleRemoveAssignment}
      />
    );
  }, [
    viewMode,
    focusDate,
    calendarRange.start,
    entriesByDate,
    filteredEntries,
    weekDays,
    isAdmin,
    handleAssignEntry,
    handleRemoveAssignment,
  ]);

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

  const closeAssignmentModal = useCallback(() => {
    setAssignmentTarget(null);
  }, []);

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
            <option value="all" className="bg-slate-900">
              All roles
            </option>
            {combinedRoleOptions.map((role) => (
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
            <option value="all" className="bg-slate-900">
              All staff
            </option>
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

      {assignmentFeedback && <p className="text-xs text-emerald-400">{assignmentFeedback}</p>}
      {assignmentError && <p className="text-xs text-rose-400">{assignmentError}</p>}

      <div className="space-y-6">
        {isLoading ? <p className="text-sm text-slate-400">Loading staff matrix…</p> : viewContent}
      </div>

      {modalContext && (
        <AssignStaffModal
          site={modalContext.site}
          timeRange={modalContext.timeRange}
          ratioMin={modalContext.ratioMin}
          assignedStaffIds={modalContext.assignedStaffIds}
          staffMembers={staffList}
          onClose={closeAssignmentModal}
          onAssign={handleAssignStaff}
          isLoading={assignmentMutation.isLoading}
          errorMessage={assignmentError}
          note={modalContext.note}
        />
      )}
    </section>
  );
};

import { FormEvent, useEffect, useMemo, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { useAccountContext } from '../context/AccountContext';
import { useAuth } from '../context/AuthContext';
import { fetchAccountStaff } from '../services/staff';
import { fetchProjectionSettings } from '../services/projectionSettings';
import {
  createStaffMatrixTemplate,
  createStaffMatrixRole,
  assignStaffToTemplate,
  deleteStaffMatrixRole,
  deleteStaffMatrixTemplate,
  fetchStaffMatrix,
  unassignStaffFromTemplate,
  updateStaffMatrixRole,
  updateStaffMatrixTemplate,
} from '../services/staffMatrix';
import type {
  ShiftTemplate as ProjectionShiftTemplate,
  StaffMatrixAssignment,
  StaffMatrixDay,
  StaffMatrixTemplate,
  WeeklyPatternEntry,
} from '../types';

const WEEKDAY_LABELS: Record<StaffMatrixDay, string> = {
  sun: 'Sun',
  mon: 'Mon',
  tue: 'Tue',
  wed: 'Wed',
  thu: 'Thu',
  fri: 'Fri',
  sat: 'Sat',
};
const WEEKDAYS = Object.keys(WEEKDAY_LABELS) as StaffMatrixDay[];
const SHIFT_TYPE_OPTIONS = ['Morning', 'Evening', 'Night'] as const;
type ShiftTypeOption = (typeof SHIFT_TYPE_OPTIONS)[number];
const YOUTH_CARE_WORKER_ROLE = 'Youth Care Worker';
const YOUTH_CARE_WORKER_ROLE_NORMALIZED = YOUTH_CARE_WORKER_ROLE.toLowerCase();
const isYouthCareWorkerRole = (role?: string | null) =>
  (role ?? '').trim().toLowerCase() === YOUTH_CARE_WORKER_ROLE_NORMALIZED;

interface TemplateFormState {
  label: string;
  role: string;
  notes: string;
  weeklyPattern: Record<StaffMatrixDay, WeeklyPatternEntry>;
  dayOff: Record<StaffMatrixDay, boolean>;
  shiftType: ShiftTypeOption | '';
}

const createEmptyTemplateForm = (): TemplateFormState => ({
  label: '',
  role: '',
  notes: '',
  weeklyPattern: WEEKDAYS.reduce((acc, day) => {
    acc[day] = { start_time: '', end_time: '' };
    return acc;
  }, {} as Record<StaffMatrixDay, WeeklyPatternEntry>),
  dayOff: WEEKDAYS.reduce((acc, day) => {
    acc[day] = false;
    return acc;
  }, {} as Record<StaffMatrixDay, boolean>),
  shiftType: '',
});

const toPayloadPattern = (pattern: TemplateFormState['weeklyPattern'], dayOff: TemplateFormState['dayOff']) =>
  WEEKDAYS.reduce<Record<StaffMatrixDay, WeeklyPatternEntry[]>>((acc, day) => {
    if (dayOff[day]) {
      acc[day] = [];
      return acc;
    }
    const entry = pattern[day];
    if (entry?.start_time && entry?.end_time) {
      acc[day] = [{ start_time: entry.start_time, end_time: entry.end_time }];
    } else {
      acc[day] = [];
    }
    return acc;
  }, {} as Record<StaffMatrixDay, WeeklyPatternEntry[]>);

const patternToForm = (
  pattern: Record<StaffMatrixDay, WeeklyPatternEntry[]>,
  shiftType: ShiftTypeOption | '' = '',
) => {
  const base = createEmptyTemplateForm();
  for (const day of WEEKDAYS) {
    const entry = pattern[day]?.[0];
    if (entry) {
      base.weeklyPattern[day] = { start_time: entry.start_time, end_time: entry.end_time };
      base.dayOff[day] = false;
    } else {
      base.dayOff[day] = true;
      base.weeklyPattern[day] = { start_time: '', end_time: '' };
    }
  }
  base.shiftType = shiftType;
  return base;
};

const extractErrorMessage = (error: unknown) => {
  const response = (error as any)?.response;
  return response?.data?.error ?? 'Unable to complete the request.';
};

type ScheduleRow = {
  id: string;
  template: StaffMatrixTemplate;
  assignmentId?: string;
  staffName: string;
  staffId?: string;
  status: 'Assigned' | 'Vacant';
  staffRole?: string;
};

const timeFormatter = new Intl.DateTimeFormat('en-US', {
  hour: 'numeric',
  minute: 'numeric',
});

const formatTime = (raw: string) => {
  const [hours, minutes] = raw.split(':').map((value) => Number(value));
  const date = new Date();
  date.setHours(hours, minutes, 0, 0);
  return timeFormatter.format(date);
};

const formatSchedulePattern = (pattern: Record<StaffMatrixDay, WeeklyPatternEntry[]>) => {
  const entries = WEEKDAYS.map((day) => {
    const segments = (pattern?.[day] ?? [])
      .map((segment) => `${formatTime(segment.start_time)} – ${formatTime(segment.end_time)}`)
      .join(', ');
    return { day, label: segments || 'Off' };
  });

  type Segment = {
    text: string;
    isOff: boolean;
  };

  const segments: Segment[] = [];
  let idx = 0;
  while (idx < entries.length) {
    const { day: start, label } = entries[idx];
    let end = start;
    let nextIdx = idx + 1;
    while (nextIdx < entries.length && entries[nextIdx].label === label) {
      end = entries[nextIdx].day;
      nextIdx += 1;
    }
    const dayLabel = start === end ? WEEKDAY_LABELS[start] : `${WEEKDAY_LABELS[start]}-${WEEKDAY_LABELS[end]}`;
    const text = label === 'Off' ? `${dayLabel} Off` : `${dayLabel} ${label}`;
    segments.push({ text, isOff: label === 'Off' });
    idx = nextIdx;
  }

  if (!segments.length) {
    return 'Off';
  }

  let result = '';
  let insertedSeparator = false;
  segments.forEach((segment) => {
    if (!result) {
      result = segment.text;
      return;
    }
    if (segment.isOff && !insertedSeparator) {
      result += ` | ${segment.text}`;
      insertedSeparator = true;
      return;
    }
    result += ` · ${segment.text}`;
  });

  return result;
};

const formatPreferenceDays = (days?: string[]) => {
  if (!days || !days.length) {
    return 'Daily';
  }
  const normalized = WEEKDAYS.filter((day) => days.includes(day));
  if (!normalized.length) {
    return 'None';
  }
  if (normalized.length === WEEKDAYS.length) {
    return 'Every day';
  }
  if (normalized.length === 5 && (['mon', 'tue', 'wed', 'thu', 'fri'] as StaffMatrixDay[]).every((day) => normalized.includes(day))) {
    return 'Mon-Fri';
  }
  return normalized.map((day) => WEEKDAY_LABELS[day]).join(', ');
};

export const StaffMatrixPage = () => {
  const { selectedAccount } = useAccountContext();
  const { currentStaff, loading: authLoading, isAuthenticated } = useAuth();
  const queryClient = useQueryClient();
  const accountId = !authLoading && isAuthenticated ? selectedAccount?.id ?? '' : '';

  const [templateForm, setTemplateForm] = useState<TemplateFormState>(() => createEmptyTemplateForm());
  const [editingTemplateId, setEditingTemplateId] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [selectedShiftId, setSelectedShiftId] = useState('');
  const [assignmentStaffId, setAssignmentStaffId] = useState('');
  const [assignmentSearch, setAssignmentSearch] = useState('');
  const [isAssignmentDropdownOpen, setIsAssignmentDropdownOpen] = useState(false);
  const assignmentDropdownRef = useRef<HTMLDivElement | null>(null);
  const [roleName, setRoleName] = useState('');
  const [editingRoleId, setEditingRoleId] = useState<string | null>(null);

  const { data: staffMatrix } = useQuery(
    ['staffMatrix', accountId],
    () => fetchStaffMatrix(accountId),
    {
      enabled: Boolean(accountId),
      refetchOnWindowFocus: false,
    },
  );
  const { data: staffList = [] } = useQuery(
    ['accountStaff', accountId],
    () => fetchAccountStaff(accountId),
    {
      enabled: Boolean(accountId),
      refetchOnWindowFocus: false,
    },
  );
  const { data: projectionSettings } = useQuery(
    ['projectionSettings', accountId],
    () => fetchProjectionSettings(accountId),
    {
      enabled: Boolean(accountId),
      refetchOnWindowFocus: false,
    },
  );

  const templates = staffMatrix?.templates ?? [];
  const assignments = staffMatrix?.assignments ?? [];
  const roleList = staffMatrix?.roles ?? [];
  const roleOptions = useMemo(() => {
    const roles = new Set<string>();
    roleList.forEach((role) => roles.add(role.name));
    staffList.forEach((staff) => {
      if (staff.role) {
        roles.add(staff.role);
      }
    });
    templates.forEach((template) => {
      if (template.role) {
        roles.add(template.role);
      }
    });
    if (!roles.size) {
      roles.add('Staff');
    }
    return Array.from(roles).sort();
  }, [roleList, staffList, templates]);

  const preferredShiftTemplates = useMemo<ProjectionShiftTemplate[]>(() => {
    return (projectionSettings?.shifts ?? []).filter((shift) => isYouthCareWorkerRole(shift.role));
  }, [projectionSettings]);

  const normalizeShiftTypeLabel = (label?: string | null): ShiftTypeOption | '' => {
    if (!label) {
      return '';
    }
    const normalized = label.trim();
    return SHIFT_TYPE_OPTIONS.includes(normalized as ShiftTypeOption) ? (normalized as ShiftTypeOption) : '';
  };

  const createFormFromShift = (shift: ProjectionShiftTemplate, defaultRole: string): TemplateFormState => {
    const normalizedDays = (shift.days ?? []).map((day) => day.toLowerCase());
    const shiftType = normalizeShiftTypeLabel(shift.label);
    const daySet = new Set(normalizedDays.length ? normalizedDays : WEEKDAYS);

    const weeklyPattern = WEEKDAYS.reduce<Record<StaffMatrixDay, WeeklyPatternEntry>>((acc, day) => {
      const isOff = !daySet.has(day);
      acc[day] = isOff ? { start_time: '', end_time: '' } : { start_time: shift.start_time, end_time: shift.end_time };
      return acc;
    }, createEmptyTemplateForm().weeklyPattern);

    const dayOff = WEEKDAYS.reduce<Record<StaffMatrixDay, boolean>>((acc, day) => {
      acc[day] = !daySet.has(day);
      return acc;
    }, createEmptyTemplateForm().dayOff);

    return {
      label: shift.label,
      role: shift.role ?? defaultRole,
      notes: shift.notes ?? '',
      weeklyPattern,
      dayOff,
      shiftType,
    };
  };

  const usePreferenceTemplate = (shift: ProjectionShiftTemplate) => {
    const updatedForm = createFormFromShift(shift, templateForm.role);
    setEditingTemplateId(null);
    setSelectedShiftId(shift.id);
    setTemplateForm(updatedForm);
    setIsModalOpen(true);
  };

  const assignmentsByTemplate = useMemo(() => {
    return assignments.reduce<Record<string, StaffMatrixAssignment[]>>((acc, assignment) => {
      acc[assignment.template_id] = acc[assignment.template_id] ?? [];
      acc[assignment.template_id].push(assignment);
      return acc;
    }, {});
  }, [assignments]);

  useEffect(() => {
    if (!editingTemplateId) {
      setAssignmentStaffId('');
      setAssignmentSearch('');
      setIsAssignmentDropdownOpen(false);
      return;
    }
    const existingAssignment = assignmentsByTemplate[editingTemplateId]?.[0];
    setAssignmentStaffId(existingAssignment?.staff_id ?? '');
    setAssignmentSearch('');
    setIsAssignmentDropdownOpen(false);
  }, [assignmentsByTemplate, editingTemplateId]);

  const scheduleRows = useMemo<ScheduleRow[]>(() => {
    const rows: ScheduleRow[] = [];
    templates.forEach((template) => {
      const assigned = assignmentsByTemplate[template.id] ?? [];
      if (assigned.length) {
        assigned.forEach((assignment) => {
          rows.push({
            id: assignment.id,
            template,
            assignmentId: assignment.id,
            staffName: assignment.staff_name,
            staffId: assignment.staff_id,
            status: 'Assigned',
            staffRole: assignment.staff_role,
          });
        });
        return;
      }
      rows.push({
        id: `${template.id}-vacant`,
        template,
        staffName: 'Vacant',
        status: 'Vacant',
      });
    });
    return rows;
  }, [assignmentsByTemplate, templates]);

  const rowsByRole = useMemo<Record<string, ScheduleRow[]>>(() => {
    return scheduleRows.reduce<Record<string, ScheduleRow[]>>((acc, row) => {
      const role = row.template.role || 'Unspecified';
      acc[role] = acc[role] ?? [];
      acc[role].push(row);
      return acc;
    }, {});
  }, [scheduleRows]);

  const scheduleRoleGroups = useMemo(() => {
    return Object.entries(rowsByRole).sort(([roleA], [roleB]) => roleA.localeCompare(roleB));
  }, [rowsByRole]);
  const currentTemplateAssignment = editingTemplateId ? assignmentsByTemplate[editingTemplateId]?.[0] : undefined;
  const extraAssignmentsCount = Math.max(
    0,
    editingTemplateId ? (assignmentsByTemplate[editingTemplateId]?.length ?? 0) - 1 : 0,
  );
  const filteredStaffList = useMemo(() => {
    if (!assignmentSearch.trim()) {
      return staffList;
    }
    const term = assignmentSearch.trim().toLowerCase();
    return staffList.filter(
      (staff) =>
        staff.full_name.toLowerCase().includes(term) ||
        (staff.email && staff.email.toLowerCase().includes(term)) ||
        (staff.role && staff.role.toLowerCase().includes(term)),
    );
  }, [assignmentSearch, staffList]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (!isAssignmentDropdownOpen) {
        return;
      }
      if (assignmentDropdownRef.current && !assignmentDropdownRef.current.contains(event.target as Node)) {
        setIsAssignmentDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isAssignmentDropdownOpen]);

  useEffect(() => {
    setFeedback(null);
    setErrorMessage(null);
  }, [accountId]);

  useEffect(() => {
    if (!isYouthCareWorkerRole(templateForm.role) && (selectedShiftId || templateForm.shiftType)) {
      if (selectedShiftId) {
        setSelectedShiftId('');
      }
      if (templateForm.shiftType) {
        setTemplateForm((prev) => (prev.shiftType ? { ...prev, shiftType: '' } : prev));
      }
    }
  }, [selectedShiftId, templateForm.role, templateForm.shiftType]);

  const createTemplateMutation = useMutation(
    (payload: Record<string, unknown>) => createStaffMatrixTemplate(accountId, payload),
    {
      onSuccess() {
        setFeedback('Program schedule saved.');
        setTemplateForm(createEmptyTemplateForm());
        setEditingTemplateId(null);
        setIsModalOpen(false);
        setSelectedShiftId('');
        queryClient.invalidateQueries(['staffMatrix', accountId]);
      },
      onError: (error) => {
        setErrorMessage(extractErrorMessage(error));
      },
    },
  );

  const updateTemplateMutation = useMutation(
    ({ payload, templateId }: { payload: Record<string, unknown>; templateId: string }) =>
      updateStaffMatrixTemplate(accountId, templateId, payload),
    {
      onSuccess() {
        setFeedback('Program schedule updated.');
        setTemplateForm(createEmptyTemplateForm());
        setEditingTemplateId(null);
        setIsModalOpen(false);
        setSelectedShiftId('');
        queryClient.invalidateQueries(['staffMatrix', accountId]);
      },
      onError: (error) => {
        setErrorMessage(extractErrorMessage(error));
      },
    },
  );

  const handleTemplateSubmit = (event: FormEvent) => {
    event.preventDefault();
    setErrorMessage(null);
    setFeedback(null);

    const payload = {
      label: templateForm.label,
      role: templateForm.role,
      notes: templateForm.notes,
      weekly_pattern: toPayloadPattern(templateForm.weeklyPattern, templateForm.dayOff),
      shift_type: isYouthCareWorkerRole(templateForm.role) ? templateForm.shiftType || undefined : undefined,
    };

    if (editingTemplateId) {
      updateTemplateMutation.mutate({ templateId: editingTemplateId, payload });
      return;
    }
    createTemplateMutation.mutate(payload);
  };

  const openCreateModal = () => {
    setEditingTemplateId(null);
    setTemplateForm(createEmptyTemplateForm());
    setSelectedShiftId('');
    setAssignmentStaffId('');
    setAssignmentSearch('');
    setIsAssignmentDropdownOpen(false);
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setEditingTemplateId(null);
    setAssignmentStaffId('');
    setAssignmentSearch('');
    setIsAssignmentDropdownOpen(false);
  };

  const handleEditTemplate = (template: StaffMatrixTemplate) => {
    setEditingTemplateId(template.id);
    const formState = patternToForm(template.weekly_pattern, template.shift_type ?? '');
    setTemplateForm({
      label: template.label,
      role: template.role,
      notes: template.notes ?? '',
      weeklyPattern: formState.weeklyPattern,
      dayOff: formState.dayOff,
      shiftType: formState.shiftType,
    });
    setSelectedShiftId('');
    setAssignmentSearch('');
    setIsAssignmentDropdownOpen(false);
    setIsModalOpen(true);
  };

  const deleteTemplateMutation = useMutation(
    (templateId: string) => deleteStaffMatrixTemplate(accountId, templateId),
    {
      onMutate() {
        setErrorMessage(null);
        setFeedback(null);
      },
      onSuccess(_, templateId) {
        setFeedback('Schedule deleted.');
        setTemplateForm(createEmptyTemplateForm());
        setEditingTemplateId(null);
        setIsModalOpen(false);
        setSelectedShiftId('');
        setAssignmentStaffId('');
        queryClient.invalidateQueries(['staffMatrix', accountId]);
      },
      onError: (error) => {
        setErrorMessage(extractErrorMessage(error));
      },
    },
  );

  const createRoleMutation = useMutation(
    (payload: { name: string }) => createStaffMatrixRole(accountId, payload),
    {
      onSuccess() {
        setFeedback('Role added.');
        setRoleName('');
        setEditingRoleId(null);
        queryClient.invalidateQueries(['staffMatrix', accountId]);
      },
      onError: (error) => setErrorMessage(extractErrorMessage(error)),
    },
  );

  const updateRoleMutation = useMutation(
    ({ roleId, payload }: { roleId: string; payload: { name: string } }) =>
      updateStaffMatrixRole(accountId, roleId, payload),
    {
      onSuccess() {
        setFeedback('Role updated.');
        setRoleName('');
        setEditingRoleId(null);
        queryClient.invalidateQueries(['staffMatrix', accountId]);
      },
      onError: (error) => setErrorMessage(extractErrorMessage(error)),
    },
  );

  const deleteRoleMutation = useMutation(
    (roleId: string) => deleteStaffMatrixRole(accountId, roleId),
    {
      onSuccess() {
        setFeedback('Role removed.');
        setRoleName('');
        setEditingRoleId(null);
        queryClient.invalidateQueries(['staffMatrix', accountId]);
      },
      onError: (error) => setErrorMessage(extractErrorMessage(error)),
    },
  );

  const saveAssignmentMutation = useMutation(
    async ({
      templateId,
      staffId,
      previousAssignmentId,
    }: {
      templateId: string;
      staffId: string;
      previousAssignmentId?: string;
    }) => {
      if (previousAssignmentId) {
        await unassignStaffFromTemplate(accountId, previousAssignmentId);
      }
      return assignStaffToTemplate(accountId, templateId, { staff_id: staffId });
    },
    {
      onMutate() {
        setErrorMessage(null);
        setFeedback(null);
      },
      onSuccess(_, variables) {
        setAssignmentStaffId(variables.staffId);
        setFeedback(variables.previousAssignmentId ? 'Assignment updated.' : 'Staff assigned to schedule.');
        queryClient.invalidateQueries(['staffMatrix', accountId]);
      },
      onError: (error) => {
        setErrorMessage(extractErrorMessage(error));
      },
    },
  );

  const removeAssignmentMutation = useMutation(
    ({ assignmentId }: { assignmentId: string }) => unassignStaffFromTemplate(accountId, assignmentId),
    {
      onMutate() {
        setErrorMessage(null);
        setFeedback(null);
      },
      onSuccess() {
        setAssignmentStaffId('');
        setFeedback('Staff removed from schedule.');
        queryClient.invalidateQueries(['staffMatrix', accountId]);
      },
      onError: (error) => {
        setErrorMessage(extractErrorMessage(error));
      },
    },
  );

  if (!accountId) {
    return <p className="text-sm text-slate-600 dark:text-slate-400">Loading account…</p>;
  }

  const handleAssignmentSave = () => {
    if (!editingTemplateId) {
      setErrorMessage('Open a schedule to manage assignments.');
      return;
    }
    if (!assignmentStaffId) {
      setErrorMessage('Select a staff member to assign.');
      return;
    }
    const existingAssignment = assignmentsByTemplate[editingTemplateId]?.[0];
    if (existingAssignment?.staff_id === assignmentStaffId) {
      setFeedback('Schedule is already assigned to this staff member.');
      return;
    }
    saveAssignmentMutation.mutate({
      templateId: editingTemplateId,
      staffId: assignmentStaffId,
      previousAssignmentId: existingAssignment?.id,
    });
  };

  const handleAssignmentRemoval = () => {
    if (!editingTemplateId) {
      return;
    }
    const existingAssignment = assignmentsByTemplate[editingTemplateId]?.[0];
    if (!existingAssignment) {
      setErrorMessage('No assignment to remove.');
      return;
    }
    removeAssignmentMutation.mutate({ assignmentId: existingAssignment.id });
  };

  const handleDeleteTemplate = () => {
    if (!editingTemplateId) {
      return;
    }
    const confirmed = window.confirm('Delete this schedule? This will remove its assignments.');
    if (!confirmed) {
      return;
    }
    deleteTemplateMutation.mutate(editingTemplateId);
  };

  const handleRoleSubmit = (event: FormEvent) => {
    event.preventDefault();
    const trimmed = roleName.trim();
    if (!trimmed) {
      setErrorMessage('Role name is required.');
      return;
    }
    setErrorMessage(null);
    setFeedback(null);

    if (editingRoleId) {
      updateRoleMutation.mutate({ roleId: editingRoleId, payload: { name: trimmed } });
      return;
    }
    createRoleMutation.mutate({ name: trimmed });
  };

  const handleEditRole = (roleId: string) => {
    const target = roleList.find((role) => role.id === roleId);
    if (!target) {
      return;
    }
    setEditingRoleId(roleId);
    setRoleName(target.name);
  };

  const handleDeleteRole = (roleId: string) => {
    const target = roleList.find((role) => role.id === roleId);
    if (!target) {
      return;
    }
    const confirmed = window.confirm(`Delete the "${target.name}" role? This cannot be undone.`);
    if (!confirmed) {
      return;
    }
    deleteRoleMutation.mutate(roleId);
  };

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-2">
        <p className="text-sm text-slate-500 dark:text-slate-400">Program</p>
        <h1 className="text-3xl font-semibold text-slate-900 dark:text-white">{selectedAccount?.name ?? 'Staff Matrix'}</h1>
        <p className="max-w-2xl text-base text-slate-600 dark:text-slate-300">
          Define the program schedules, assign them to staff, and keep track of one-off overrides and overtime shifts.
        </p>
      </header>

      {errorMessage && (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700 dark:border-rose-600 dark:bg-rose-900/40 dark:text-rose-200">
          {errorMessage}
        </div>
      )}
      {feedback && (
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800 dark:border-emerald-500/60 dark:bg-emerald-500/10 dark:text-emerald-300">
          {feedback}
        </div>
      )}

      <section className="space-y-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-white/10 dark:bg-slate-900/50">
        <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Roles</p>
            <p className="text-sm text-slate-700 dark:text-slate-300">Manage the roles available for program schedules.</p>
          </div>
          <form className="flex flex-col gap-2 md:flex-row" onSubmit={handleRoleSubmit}>
            <input
              className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-200 dark:border-white/10 dark:bg-slate-900/70 dark:text-slate-50"
              value={roleName}
              onChange={(event) => setRoleName(event.target.value)}
              placeholder="Add a role (e.g., Counselor)"
            />
            <div className="flex gap-2 md:justify-end">
              {editingRoleId ? (
                <button
                  type="button"
                  className="rounded-xl border border-slate-200 px-3 py-2 text-sm font-medium text-slate-700 shadow-sm transition hover:border-slate-300 dark:border-white/10 dark:bg-white/5 dark:text-slate-100"
                  onClick={() => {
                    setEditingRoleId(null);
                    setRoleName('');
                  }}
                >
                  Cancel
                </button>
              ) : null}
              <button
                type="submit"
                className="rounded-xl bg-indigo-600 px-3 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-700"
                disabled={createRoleMutation.isLoading || updateRoleMutation.isLoading}
              >
                {editingRoleId ? 'Update role' : 'Add role'}
              </button>
            </div>
          </form>
        </div>
        <div className="flex flex-wrap gap-2">
          {roleList.length ? (
            roleList.map((role) => (
              <div
                key={role.id}
                className="flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-sm text-slate-700 shadow-sm dark:border-white/10 dark:bg-white/5 dark:text-slate-100"
              >
                <span>{role.name}</span>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => handleEditRole(role.id)}
                    className="text-xs font-medium text-indigo-600 hover:underline dark:text-indigo-300"
                  >
                    Edit
                  </button>
                  <span aria-hidden className="text-slate-400">·</span>
                  <button
                    type="button"
                    onClick={() => handleDeleteRole(role.id)}
                    className="text-xs font-medium text-rose-600 hover:underline dark:text-rose-300"
                    disabled={deleteRoleMutation.isLoading}
                  >
                    Delete
                  </button>
                </div>
              </div>
            ))
          ) : (
            <p className="text-sm text-slate-500 dark:text-slate-400">No roles yet. Create one to get started.</p>
          )}
        </div>
      </section>

      {preferredShiftTemplates.length ? (
        <section className="space-y-4 rounded-3xl border border-slate-200/70 bg-white/80 p-6 shadow-lg shadow-black/3 ring-1 ring-white/50 dark:border-white/10 dark:bg-slate-900/80 dark:shadow-[0_25px_50px_rgba(0,0,0,0.45)]">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Youth Care Worker</p>
              <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Shift preferences</h2>
              <p className="text-sm text-slate-600 dark:text-slate-300">These categories are defined under projection shift preferences and anchor every day of the week.</p>
            </div>
            <button
              type="button"
              onClick={openCreateModal}
              className="rounded-full border border-indigo-200 bg-indigo-50 px-4 py-2 text-sm font-semibold text-indigo-700 shadow-sm hover:bg-indigo-100 dark:border-indigo-500/40 dark:bg-indigo-500/10 dark:text-indigo-200 dark:hover:bg-indigo-500/20"
            >
              + Create Schedule
            </button>
          </div>
          <div className="grid gap-4 md:grid-cols-3">
            {preferredShiftTemplates.map((shift) => (
              <div key={shift.id} className="rounded-2xl border border-slate-200/60 bg-white/80 p-4 shadow-sm dark:border-white/10 dark:bg-slate-900/70">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs font-semibold uppercase text-slate-500 dark:text-slate-400">
                      {shift.category ?? 'General'}
                    </p>
                    <h3 className="text-lg font-semibold text-slate-900 dark:text-white">{shift.label}</h3>
                  </div>
                  <span className="text-sm font-semibold text-slate-600 dark:text-slate-300">
                    {formatTime(shift.start_time)} – {formatTime(shift.end_time)}
                  </span>
                </div>
                <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
                  Days: {formatPreferenceDays(shift.days)}
                </p>
                <button
                  type="button"
                  onClick={() => usePreferenceTemplate(shift)}
                  className="mt-4 w-full rounded-full border border-indigo-200 bg-indigo-50 px-3 py-2 text-sm font-semibold text-indigo-700 shadow-sm hover:bg-indigo-100 dark:border-indigo-500/40 dark:bg-indigo-500/10 dark:text-indigo-200 dark:hover:bg-indigo-500/20"
                >
                  Define from preference
                </button>
              </div>
            ))}
          </div>
        </section>
      ) : null}
      <section className="space-y-6 rounded-3xl border border-slate-200/70 bg-white/80 p-6 shadow-lg shadow-black/5 ring-1 ring-white/50 dark:border-white/10 dark:bg-slate-900/80 dark:shadow-[0_25px_50px_rgba(0,0,0,0.45)]">
        <div className="sm:flex sm:items-center sm:justify-between">
          <div className="sm:flex-auto">
            <p className="text-sm font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Schedules</p>
            <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Existing program schedules</h2>
            <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">See who is assigned to each schedule and edit them directly from the table.</p>
          </div>
          <div className="mt-4 flex items-center sm:mt-0 sm:flex-none">
            <button
              type="button"
              onClick={openCreateModal}
              className="rounded-full border border-indigo-200 bg-indigo-50 px-4 py-2 text-sm font-semibold text-indigo-700 shadow-sm hover:bg-indigo-100 dark:border-indigo-500/40 dark:bg-indigo-500/10 dark:text-indigo-200 dark:hover:bg-indigo-500/20"
            >
              + Create Schedule
            </button>
          </div>
        </div>

        {templates.length ? (
          <div className="space-y-6">
            {scheduleRoleGroups.map(([role, rows]) => {
              const rowsByShift = rows.reduce<Record<string, ScheduleRow[]>>((acc, row) => {
                const shiftLabel = row.template.shift_type || 'Unspecified shift';
                acc[shiftLabel] = acc[shiftLabel] ?? [];
                acc[shiftLabel].push(row);
                return acc;
              }, {});
              const shiftGroups = Object.entries(rowsByShift).sort(([shiftA], [shiftB]) => shiftA.localeCompare(shiftB));

              return (
                <div key={role} className="flow-root rounded-2xl border border-slate-200/70 bg-white/80 shadow-sm shadow-black/5 dark:border-white/10 dark:bg-slate-900/70">
                  <div className="flex items-center justify-between border-b border-slate-100/70 px-5 py-3 dark:border-white/5">
                    <div>
                      <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">{role}</p>
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        {rows.length} schedule{rows.length === 1 ? '' : 's'}
                      </p>
                    </div>
                  </div>
                  <div className="space-y-3 p-4">
                    {shiftGroups.map(([shiftLabel, shiftRows]) => {
                      const assignedCount = shiftRows.filter((row) => row.status === 'Assigned').length;
                      const vacantCount = shiftRows.filter((row) => row.status === 'Vacant').length;

                      return (
                        <div key={shiftLabel} className="overflow-x-auto rounded-2xl border border-slate-100/70 dark:border-white/5">
                          <div className="flex items-center justify-between border-b border-slate-100/60 bg-slate-50/80 px-4 py-3 text-xs uppercase tracking-wide text-slate-500 dark:border-white/5 dark:bg-white/5 dark:text-slate-400">
                            <div className="font-semibold text-slate-700 dark:text-slate-200">{shiftLabel}</div>
                            <div className="flex items-center gap-3 text-[11px] font-semibold">
                              <span className="rounded-full bg-emerald-50 px-3 py-1 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300">
                                {assignedCount} staff
                              </span>
                              <span className="rounded-full bg-amber-50 px-3 py-1 text-amber-700 dark:bg-amber-900/40 dark:text-amber-200">
                                {vacantCount} vacanc{vacantCount === 1 ? 'y' : 'ies'}
                              </span>
                            </div>
                          </div>
                          <table className="min-w-full divide-y divide-slate-200 text-sm text-slate-700 dark:divide-white/5 dark:text-slate-200">
                            <thead className="bg-white/70 text-xs uppercase tracking-wide text-slate-500 dark:bg-slate-900/60 dark:text-slate-400">
                              <tr>
                                <th className="py-3.5 pl-4 pr-3 text-left font-semibold sm:pl-6">Name</th>
                                <th className="px-3 py-3.5 text-left font-semibold">Title</th>
                                <th className="px-3 py-3.5 text-left font-semibold">Status</th>
                                <th className="px-3 py-3.5 text-left font-semibold">Role</th>
                                <th className="relative py-3.5 pl-3 pr-4 sm:pr-6">
                                  <span className="sr-only">Edit</span>
                                </th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 bg-white dark:bg-slate-900/40">
                              {shiftRows.map((row) => {
                                const staffMember = row.staffId ? staffList.find((s) => s.id === row.staffId) : undefined;
                                const avatarUrl = staffMember?.photo_url;
                                const phoneNumber = staffMember?.phone_number;
                                const email = staffMember?.email;

                                return (
                                  <tr key={row.id}>
                                    <td className="whitespace-nowrap py-5 pl-4 pr-3 text-sm sm:pl-6">
                                      <div className="flex items-center">
                                        <div className="h-11 w-11 flex-shrink-0">
                                          {avatarUrl ? (
                                            <img className="h-11 w-11 rounded-full" src={avatarUrl} alt="" />
                                          ) : (
                                            <div className="flex h-11 w-11 items-center justify-center rounded-full bg-slate-100 text-xs font-medium text-slate-500 dark:bg-slate-800 dark:text-slate-400">
                                              {row.staffName.charAt(0)}
                                            </div>
                                          )}
                                        </div>
                                        <div className="ml-4">
                                          <div className="font-medium text-slate-900 dark:text-white">{row.staffName}</div>
                                          <div className="mt-1 text-slate-500 dark:text-slate-400">{email}</div>
                                        </div>
                                      </div>
                                    </td>
                                    <td className="whitespace-nowrap px-3 py-5 text-sm text-slate-500 dark:text-slate-400">
                                      <div className="text-slate-900 dark:text-white">{row.status === 'Assigned' ? row.staffRole ?? row.template.role : 'Vacant'}</div>
                                      <div className="mt-1 text-slate-500 dark:text-slate-400">{phoneNumber}</div>
                                    </td>
                                    <td className="whitespace-nowrap px-3 py-5 text-sm text-slate-500 dark:text-slate-400">
                                      <span
                                        className={`inline-flex items-center rounded-md px-2 py-1 text-xs font-medium ring-1 ring-inset ${row.status === 'Assigned'
                                          ? 'bg-green-50 text-green-700 ring-green-600/20 dark:bg-green-900/30 dark:text-green-400 dark:ring-green-500/30'
                                          : 'bg-rose-50 text-rose-700 ring-rose-600/20 dark:bg-rose-900/30 dark:text-rose-400 dark:ring-rose-500/30'
                                          }`}
                                      >
                                        {row.status === 'Assigned' ? 'Active' : 'Vacant'}
                                      </span>
                                    </td>
                                    <td className="whitespace-nowrap px-3 py-5 text-sm text-slate-500 dark:text-slate-400">
                                      {row.template.role}
                                      {row.template.shift_type ? ` · ${row.template.shift_type}` : ''}
                                      <div className="mt-1 text-xs text-slate-400 dark:text-slate-500">
                                        {formatSchedulePattern(row.template.weekly_pattern)}
                                      </div>
                                    </td>
                                    <td className="relative whitespace-nowrap py-5 pl-3 pr-4 text-right text-sm font-medium sm:pr-6">
                                      <button
                                        type="button"
                                        onClick={() => handleEditTemplate(row.template)}
                                        className="text-indigo-600 hover:text-indigo-900 dark:text-indigo-400 dark:hover:text-indigo-300"
                                      >
                                        Edit<span className="sr-only">, {row.template.label}</span>
                                      </button>
                                    </td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <p className="text-sm text-slate-500 dark:text-slate-400">No permanent schedules defined yet.</p>
        )}
      </section>

      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-start justify-center px-4 py-6">
          <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={closeModal} />
          <form
            onSubmit={handleTemplateSubmit}
            className="relative w-full max-w-5xl max-h-[90vh] overflow-y-auto rounded-3xl bg-white px-6 py-7 shadow-2xl ring-1 ring-slate-900/5 md:px-9 md:py-8 dark:bg-slate-900"
          >
            <header className="flex flex-col gap-3 pb-2 md:flex-row md:items-center md:justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Program schedule</p>
                <h3 className="text-2xl font-semibold text-slate-900 dark:text-white">
                  {editingTemplateId ? 'Edit schedule' : 'Create schedule'}
                </h3>
                <p className="text-sm text-slate-500 dark:text-slate-400">
                  Configure the role, staff assignment, and weekly hours for this schedule.
                </p>
              </div>
              {templateForm.shiftType ? (
                <span className="inline-flex items-center gap-2 self-start rounded-full bg-indigo-50 px-3 py-1 text-xs font-semibold text-indigo-700 ring-1 ring-indigo-100 dark:bg-indigo-500/10 dark:text-indigo-200 dark:ring-indigo-500/30">
                  <span className="inline-block h-2.5 w-2.5 rounded-full bg-indigo-500" />
                  {templateForm.shiftType} shift
                </span>
              ) : null}
              <button
                type="button"
                onClick={closeModal}
                className="absolute right-4 top-4 inline-flex h-9 w-9 items-center justify-center rounded-full border border-slate-200 bg-white text-lg text-slate-500 shadow-sm transition hover:bg-slate-50 dark:border-white/10 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700"
                aria-label="Close modal"
              >
                ×
              </button>
            </header>

            <section className="space-y-4">
              <h4 className="text-sm font-semibold text-slate-900 dark:text-white">General information</h4>
              <div
                className={`grid gap-4 ${
                  isYouthCareWorkerRole(templateForm.role) ? 'md:grid-cols-3' : 'md:grid-cols-2'
                }`}
              >
                <label className="space-y-1 text-sm">
                  <span className="text-slate-600 dark:text-slate-400">Schedule name</span>
                  <input
                    className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-200 dark:border-white/10 dark:bg-slate-900/70 dark:text-slate-50 dark:focus:border-indigo-400"
                    value={templateForm.label}
                    onChange={(event) => setTemplateForm((prev) => ({ ...prev, label: event.target.value }))}
                    placeholder="Enter schedule name"
                    required
                  />
                </label>
                <label className="space-y-1 text-sm">
                  <span className="text-slate-600 dark:text-slate-400">Role</span>
                  <select
                    className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-200 dark:border-white/10 dark:bg-slate-900/70 dark:text-slate-50"
                    value={templateForm.role}
                    onChange={(event) => setTemplateForm((prev) => ({ ...prev, role: event.target.value }))}
                    required
                  >
                    <option value="">Select role</option>
                    {roleOptions.map((role) => (
                      <option key={role} value={role}>
                        {role}
                      </option>
                    ))}
                  </select>
                </label>

                {isYouthCareWorkerRole(templateForm.role) ? (
                  <label className="space-y-1 text-sm">
                    <span className="text-slate-600 dark:text-slate-400">Shift tag</span>
                    <select
                      className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-200 dark:border-white/10 dark:bg-slate-900/70 dark:text-slate-50"
                      value={templateForm.shiftType}
                      onChange={(event) => {
                        const value = (event.target.value as ShiftTypeOption | '') || '';
                        setTemplateForm((prev) => ({
                          ...prev,
                          shiftType: value,
                        }));
                      }}
                    >
                      <option value="">Select shift</option>
                      {SHIFT_TYPE_OPTIONS.map((shiftType) => (
                        <option key={shiftType} value={shiftType}>
                          {shiftType}
                        </option>
                      ))}
                    </select>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      Tag this Youth Care Worker schedule with one of the standard shifts.
                    </p>
                  </label>
                ) : null}
                {isYouthCareWorkerRole(templateForm.role) && preferredShiftTemplates.length ? (
                  <label className="space-y-1 text-sm md:col-span-2">
                    <span className="text-slate-600 dark:text-slate-400">Projection shift</span>
                    <select
                      className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-200 dark:border-white/10 dark:bg-slate-900/70 dark:text-slate-50"
                      value={selectedShiftId}
                      onChange={(event) => {
                        const shiftId = event.target.value;
                        setSelectedShiftId(shiftId);
                        const selectedShift = preferredShiftTemplates.find((shift) => shift.id === shiftId);
                        if (selectedShift) {
                          setTemplateForm(createFormFromShift(selectedShift, YOUTH_CARE_WORKER_ROLE));
                        }
                      }}
                    >
                      <option value="">Select shift</option>
                      {preferredShiftTemplates.map((shift) => (
                        <option key={shift.id} value={shift.id}>
                          {shift.label}
                        </option>
                      ))}
                    </select>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      Select a projection shift to auto-fill the weekly schedule for Youth Care Workers.
                    </p>
                  </label>
                ) : null}
              </div>
              <label className="space-y-1 text-sm">
                <span className="flex items-center justify-between text-slate-600 dark:text-slate-400">
                  Notes <span className="text-xs font-normal text-slate-400 dark:text-slate-500">Optional</span>
                </span>
                <textarea
                  rows={3}
                  className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-200 dark:border-white/10 dark:bg-slate-900/70 dark:text-slate-50"
                  value={templateForm.notes}
                  onChange={(event) => setTemplateForm((prev) => ({ ...prev, notes: event.target.value }))}
                  placeholder="Add any special instructions for this schedule..."
                />
              </label>
            </section>

            {editingTemplateId ? (
              <section className="mt-6 space-y-3 rounded-2xl border border-slate-200 bg-slate-50/70 p-4 text-sm shadow-sm dark:border-white/10 dark:bg-white/5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Staff assignment</p>
                    <p className="text-slate-700 dark:text-slate-200">Attach this schedule to a staff member so it appears on their calendar.</p>
                    {currentTemplateAssignment ? (
                      <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                        Currently assigned to {currentTemplateAssignment.staff_name}
                        {extraAssignmentsCount > 0 ? ` (+${extraAssignmentsCount} more)` : ''}
                      </p>
                    ) : (
                      <p className="mt-1 text-xs text-amber-600 dark:text-amber-300">No staff assigned yet.</p>
                    )}
                  </div>
                  {saveAssignmentMutation.isLoading || removeAssignmentMutation.isLoading ? (
                    <span className="text-xs text-slate-500 dark:text-slate-400">Saving…</span>
                  ) : null}
                </div>
                <div className="flex flex-col gap-3 md:flex-row md:items-end">
                  <div className="relative flex-1" ref={assignmentDropdownRef}>
                    <span className="text-slate-600 dark:text-slate-400">Staff member</span>
                    <button
                      type="button"
                      onClick={() => setIsAssignmentDropdownOpen((open) => !open)}
                      className="mt-1 flex w-full items-center justify-between rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm transition hover:border-slate-300 dark:border-white/10 dark:bg-slate-900/70 dark:text-slate-50"
                      aria-haspopup="listbox"
                      aria-expanded={isAssignmentDropdownOpen}
                    >
                      <span className="truncate text-left">
                        {assignmentStaffId
                          ? staffList.find((staff) => staff.id === assignmentStaffId)?.full_name ?? 'Selected staff'
                          : 'Select staff'}
                      </span>
                      <span className="text-slate-400">▾</span>
                    </button>
                    {isAssignmentDropdownOpen && (
                      <div className="absolute z-20 mt-2 w-full overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-lg dark:border-white/10 dark:bg-slate-900">
                        <div className="border-b border-slate-100/70 bg-slate-50/70 p-2 dark:border-white/5 dark:bg-white/5">
                          <input
                            type="search"
                            value={assignmentSearch}
                            onChange={(event) => setAssignmentSearch(event.target.value)}
                            placeholder="Search by name, email, or role"
                            className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-900 focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-200 dark:border-white/10 dark:bg-slate-900/70 dark:text-slate-50"
                            autoFocus
                          />
                        </div>
                        <div className="max-h-60 overflow-y-auto py-1">
                          {filteredStaffList.length ? (
                            filteredStaffList.map((staff) => (
                              <button
                                type="button"
                                key={staff.id}
                                onClick={() => {
                                  setAssignmentStaffId(staff.id);
                                  setIsAssignmentDropdownOpen(false);
                                }}
                                className={`flex w-full items-start gap-2 px-3 py-2 text-left text-sm hover:bg-slate-50 dark:hover:bg-white/10 ${assignmentStaffId === staff.id
                                    ? 'bg-indigo-50 text-indigo-700 dark:bg-indigo-500/10 dark:text-indigo-200'
                                    : 'text-slate-900 dark:text-slate-100'
                                  }`}
                                role="option"
                                aria-selected={assignmentStaffId === staff.id}
                              >
                                <div className="flex-1">
                                  <div className="font-medium">{staff.full_name}</div>
                                  <div className="text-xs text-slate-500 dark:text-slate-400">
                                    {[staff.role, staff.email].filter(Boolean).join(' · ')}
                                  </div>
                                </div>
                              </button>
                            ))
                          ) : (
                            <div className="px-3 py-3 text-sm text-slate-500 dark:text-slate-400">No matches.</div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={handleAssignmentSave}
                      disabled={!assignmentStaffId || saveAssignmentMutation.isLoading || deleteTemplateMutation.isLoading}
                      className="inline-flex items-center justify-center rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-60 dark:bg-indigo-500 dark:hover:bg-indigo-400"
                    >
                      {currentTemplateAssignment ? 'Update assignment' : 'Assign staff'}
                    </button>
                    {currentTemplateAssignment ? (
                      <button
                        type="button"
                        onClick={handleAssignmentRemoval}
                        disabled={
                          removeAssignmentMutation.isLoading || saveAssignmentMutation.isLoading || deleteTemplateMutation.isLoading
                        }
                        className="inline-flex items-center justify-center rounded-lg border border-rose-200 px-4 py-2 text-sm font-semibold text-rose-700 shadow-sm transition hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-60 dark:border-rose-500/50 dark:text-rose-200 dark:hover:bg-rose-500/10"
                      >
                        Remove
                      </button>
                    ) : null}
                  </div>
                </div>
              </section>
            ) : null}

            <section className="mt-6 space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-sm font-semibold text-slate-900 dark:text-white">Weekly hours</h4>
                  <p className="text-xs text-slate-500 dark:text-slate-400">Toggle off-days and set start/end for each day.</p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setTemplateForm((prev) => {
                      const monday = prev.weeklyPattern.mon ?? { start_time: '', end_time: '' };
                      const mondayOff = prev.dayOff.mon;
                      const nextPattern = { ...prev.weeklyPattern };
                      const nextDayOff = { ...prev.dayOff };
                      (['tue', 'wed', 'thu', 'fri'] as StaffMatrixDay[]).forEach((day) => {
                        nextDayOff[day] = mondayOff;
                        nextPattern[day] = mondayOff ? { start_time: '', end_time: '' } : { ...monday };
                      });
                      return { ...prev, weeklyPattern: nextPattern, dayOff: nextDayOff };
                    });
                  }}
                  className="text-xs font-semibold text-indigo-600 transition hover:text-indigo-700 dark:text-indigo-300 dark:hover:text-indigo-200"
                >
                  Copy Monday to weekdays
                </button>
              </div>
              <div className="grid grid-cols-1 gap-3 md:grid-cols-3 lg:grid-cols-7">
                {WEEKDAYS.map((day) => {
                  const dayData = templateForm.weeklyPattern[day];
                  const isOff = templateForm.dayOff[day];
                  const hasError = !isOff && dayData?.end_time && dayData?.start_time && dayData.end_time <= dayData.start_time;

                  return (
                    <div
                      key={day}
                      className="flex h-full flex-col gap-2 rounded-2xl border border-slate-200 bg-white p-3 shadow-sm ring-1 ring-white/60 dark:border-white/10 dark:bg-slate-900/60"
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-semibold text-slate-900 dark:text-white">{WEEKDAY_LABELS[day]}</span>
                        <button
                          type="button"
                          onClick={() =>
                            setTemplateForm((prev) => ({
                              ...prev,
                              dayOff: { ...prev.dayOff, [day]: !prev.dayOff[day] },
                              weeklyPattern: {
                                ...prev.weeklyPattern,
                                [day]: !prev.dayOff[day] ? { start_time: '', end_time: '' } : prev.weeklyPattern[day],
                              },
                            }))
                          }
                          className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-semibold transition ${
                            isOff
                              ? 'border-slate-200 bg-slate-50 text-slate-600 dark:border-white/10 dark:bg-white/5 dark:text-slate-300'
                              : 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-500/40 dark:bg-emerald-500/10 dark:text-emerald-200'
                          }`}
                        >
                          {isOff ? 'Off' : 'On'}
                        </button>
                      </div>
                      <div className="space-y-2">
                        <label className="space-y-1">
                          <span className="text-[11px] uppercase tracking-wide text-slate-400 dark:text-slate-500">Start</span>
                          <input
                            type="time"
                            value={dayData?.start_time ?? ''}
                            disabled={isOff}
                            onChange={(event) =>
                              setTemplateForm((prev) => ({
                                ...prev,
                                weeklyPattern: {
                                  ...prev.weeklyPattern,
                                  [day]: { ...prev.weeklyPattern[day], start_time: event.target.value },
                                },
                              }))
                            }
                            className="w-full rounded-lg border border-slate-200 bg-slate-50 px-2 py-1.5 text-xs text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 disabled:cursor-not-allowed disabled:opacity-60 dark:border-white/10 dark:bg-slate-800 dark:text-slate-100"
                          />
                        </label>
                        <label className="space-y-1">
                          <span className="text-[11px] uppercase tracking-wide text-slate-400 dark:text-slate-500">End</span>
                          <input
                            type="time"
                            value={dayData?.end_time ?? ''}
                            disabled={isOff}
                            onChange={(event) =>
                              setTemplateForm((prev) => ({
                                ...prev,
                                weeklyPattern: {
                                  ...prev.weeklyPattern,
                                  [day]: { ...prev.weeklyPattern[day], end_time: event.target.value },
                                },
                              }))
                            }
                            className="w-full rounded-lg border border-slate-200 bg-slate-50 px-2 py-1.5 text-xs text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 disabled:cursor-not-allowed disabled:opacity-60 dark:border-white/10 dark:bg-slate-800 dark:text-slate-100"
                          />
                        </label>
                      </div>
                      {hasError ? <p className="text-[11px] text-rose-600 dark:text-rose-300">End time must be after start.</p> : null}
                    </div>
                  );
                })}
              </div>
            </section>

            <footer className="mt-6 flex flex-col gap-3 border-t border-slate-100 pt-4 sm:flex-row sm:items-center sm:justify-between dark:border-white/10">
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={closeModal}
                  className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50 dark:border-white/10 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
                >
                  Cancel
                </button>
                {editingTemplateId ? (
                  <button
                    type="button"
                    onClick={handleDeleteTemplate}
                    disabled={deleteTemplateMutation.isLoading}
                    className="text-sm font-semibold text-rose-600 underline-offset-2 hover:text-rose-700 disabled:cursor-not-allowed disabled:opacity-60 dark:text-rose-300 dark:hover:text-rose-200"
                  >
                    Delete schedule
                  </button>
                ) : null}
              </div>
              <button
                type="submit"
                className="inline-flex items-center justify-center rounded-lg bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-1 dark:bg-indigo-500 dark:hover:bg-indigo-400"
              >
                {editingTemplateId ? 'Update schedule' : 'Create schedule'}
              </button>
            </footer>
          </form>
        </div>
      )}

    </div>
  );
};

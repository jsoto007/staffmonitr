import { FormEvent, useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { useAccountContext } from '../context/AccountContext';
import { useAuth } from '../context/AuthContext';
import { fetchAccountStaff } from '../services/staff';
import { fetchProjectionSettings } from '../services/projectionSettings';
import {
  createStaffMatrixTemplate,
  fetchStaffMatrix,
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
  color: string;
  notes: string;
  weeklyPattern: Record<StaffMatrixDay, WeeklyPatternEntry>;
  dayOff: Record<StaffMatrixDay, boolean>;
  shiftType: ShiftTypeOption | '';
}

const createEmptyTemplateForm = (): TemplateFormState => ({
  label: '',
  role: '',
  color: '#6366f1',
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
  if (normalized.length === 5 && ['mon', 'tue', 'wed', 'thu', 'fri'].every((day) => normalized.includes(day))) {
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
  const roleOptions = useMemo(() => {
    const roles = new Set<string>();
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
  }, [staffList, templates]);

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
    color: shift.color ?? '#6366f1',
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

  useEffect(() => {
    setFeedback(null);
    setErrorMessage(null);
  }, [accountId]);

  useEffect(() => {
    if (!isYouthCareWorkerRole(templateForm.role)) {
      if (selectedShiftId) {
        setSelectedShiftId('');
      }
      if (templateForm.shiftType) {
        setTemplateForm((prev) => ({ ...prev, shiftType: '' }));
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

  if (!accountId) {
    return <p className="text-sm text-slate-600 dark:text-slate-400">Loading account…</p>;
  }

  const handleTemplateSubmit = (event: FormEvent) => {
    event.preventDefault();
    setErrorMessage(null);
    setFeedback(null);

    const payload = {
      label: templateForm.label,
      role: templateForm.role,
      color: templateForm.color,
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
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setEditingTemplateId(null);
  };

  const handleEditTemplate = (template: StaffMatrixTemplate) => {
    setEditingTemplateId(template.id);
    const formState = patternToForm(template.weekly_pattern, template.shift_type ?? '');
    setTemplateForm({
      label: template.label,
      role: template.role,
      color: template.color ?? '#6366f1',
      notes: template.notes ?? '',
      weeklyPattern: formState.weeklyPattern,
      dayOff: formState.dayOff,
      shiftType: formState.shiftType,
    });
    setSelectedShiftId('');
    setIsModalOpen(true);
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
                                <th className="py-3.5 px-4 text-left">Name</th>
                                <th className="py-3.5 px-4 text-left">Title</th>
                                <th className="py-3.5 px-4 text-left">Schedule</th>
                                <th className="py-3.5 px-4 text-left">Status</th>
                                <th className="py-3.5 px-4 text-left">Edit</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 bg-white dark:bg-slate-900/40">
                              {shiftRows.map((row) => (
                                <tr key={row.id}>
                                  <td className="whitespace-nowrap py-4 px-4">
                                    <div className="text-sm font-semibold text-slate-900 dark:text-white">{row.staffName}</div>
                                    <div className="text-xs text-slate-500 dark:text-slate-400">
                                      {row.status === 'Assigned' ? row.staffRole ?? row.template.role : 'Vacant'}
                                    </div>
                                  </td>
                                  <td className="whitespace-nowrap py-4 px-4">
                                    <div className="text-sm font-semibold text-slate-900 dark:text-white">{row.template.label}</div>
                                    <div className="text-xs text-slate-500 dark:text-slate-400">
                                      {row.template.role}
                                      {row.template.shift_type ? ` · ${row.template.shift_type}` : ''}
                                    </div>
                                  </td>
                                  <td className="py-4 px-4 text-xs text-slate-500 dark:text-slate-400">
                                    {formatSchedulePattern(row.template.weekly_pattern)}
                                  </td>
                                  <td className="py-4 px-4">
                                    <span
                                      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                                        row.status === 'Assigned'
                                          ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300'
                                          : 'bg-rose-50 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300'
                                      }`}
                                    >
                                      {row.status === 'Assigned' ? 'Assigned' : 'Vacant'}
                                    </span>
                                  </td>
                                  <td className="py-4 px-4 text-right">
                                    <button
                                      type="button"
                                      onClick={() => handleEditTemplate(row.template)}
                                      className="text-xs font-semibold text-indigo-600 hover:text-indigo-900"
                                    >
                                      Edit<span className="sr-only">, {row.template.label} schedule</span>
                                    </button>
                                  </td>
                                </tr>
                              ))}
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
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4 py-6">
          <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={closeModal} />
          <div className="relative w-full max-w-3xl max-h-[90vh] overflow-y-auto rounded-3xl bg-white p-6 shadow-2xl dark:bg-slate-900">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <p className="text-sm font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Program schedule</p>
                <h3 className="text-xl font-semibold text-slate-900 dark:text-white">
                  {editingTemplateId ? 'Edit schedule' : 'Create schedule'}
                </h3>
              </div>
              <button
                type="button"
                onClick={closeModal}
                className="rounded-full bg-slate-200/80 p-2 text-slate-600 transition hover:bg-slate-300 hover:text-slate-900 dark:bg-slate-700/80 dark:text-slate-300 dark:hover:bg-slate-600 dark:hover:text-white"
                aria-label="Close modal"
              >
                ✕
              </button>
            </div>
            <form className="space-y-4" onSubmit={handleTemplateSubmit}>
              <div className="grid gap-4 md:grid-cols-2">
                <label className="space-y-1 text-sm">
                  <span className="text-slate-500 dark:text-slate-400">Schedule name</span>
                  <input
                    className="w-full rounded-2xl border border-slate-200 px-3 py-2 text-sm text-slate-900 focus:border-slate-400 focus:outline-none dark:border-white/10 dark:bg-slate-900/70 dark:text-slate-50"
                    value={templateForm.label}
                    onChange={(event) => setTemplateForm((prev) => ({ ...prev, label: event.target.value }))}
                    required
                  />
                </label>
                <label className="space-y-1 text-sm">
                  <span className="text-slate-500 dark:text-slate-400">Role</span>
                  <select
                    className="w-full rounded-2xl border border-slate-200 px-3 py-2 text-sm text-slate-900 focus:border-slate-400 focus:outline-none dark:border-white/10 dark:bg-slate-900/70 dark:text-slate-50"
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
                {isYouthCareWorkerRole(templateForm.role) && (
                  <label className="space-y-1 text-sm">
                    <span className="text-slate-500 dark:text-slate-400">Shift tag</span>
                    <select
                      className="w-full rounded-2xl border border-slate-200 px-3 py-2 text-sm text-slate-900 focus:border-slate-400 focus:outline-none dark:border-white/10 dark:bg-slate-900/70 dark:text-slate-50"
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
                )}
                {isYouthCareWorkerRole(templateForm.role) && preferredShiftTemplates.length ? (
                  <label className="space-y-1 text-sm">
                    <span className="text-slate-500 dark:text-slate-400">Projection shift</span>
                    <select
                      className="w-full rounded-2xl border border-slate-200 px-3 py-2 text-sm text-slate-900 focus:border-slate-400 focus:outline-none dark:border-white/10 dark:bg-slate-900/70 dark:text-slate-50"
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
                <label className="space-y-1 text-sm">
                  <span className="text-slate-500 dark:text-slate-400">Color</span>
                  <input
                    type="color"
                    className="h-10 w-14 rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-900 focus:outline-none dark:border-white/10"
                    value={templateForm.color}
                    onChange={(event) => setTemplateForm((prev) => ({ ...prev, color: event.target.value }))}
                  />
                </label>
                <label className="space-y-1 text-sm">
                  <span className="text-slate-500 dark:text-slate-400">Notes</span>
                  <input
                    className="w-full rounded-2xl border border-slate-200 px-3 py-2 text-sm text-slate-900 focus:border-slate-400 focus:outline-none dark:border-white/10 dark:bg-slate-900/70 dark:text-slate-50"
                    value={templateForm.notes}
                    onChange={(event) => setTemplateForm((prev) => ({ ...prev, notes: event.target.value }))}
                  />
                </label>
              </div>

              <div className="grid gap-4 md:grid-cols-3">
                {WEEKDAYS.map((day) => (
                  <label key={day} className="space-y-1 text-sm">
                    <span className="text-slate-500 dark:text-slate-400">{WEEKDAY_LABELS[day]}</span>
                    <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
                      <span>Mark off day</span>
                      <label className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={templateForm.dayOff[day]}
                          onChange={(event) => {
                            const isOff = event.target.checked;
                            setTemplateForm((prev) => ({
                              ...prev,
                              dayOff: { ...prev.dayOff, [day]: isOff },
                              weeklyPattern: {
                                ...prev.weeklyPattern,
                                [day]: isOff ? { start_time: '', end_time: '' } : prev.weeklyPattern[day],
                              },
                            }));
                          }}
                          className="h-4 w-4 rounded border-slate-300 text-slate-900 focus:ring-slate-500 dark:border-white/40 dark:bg-slate-900/60"
                        />
                      </label>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <input
                        type="time"
                        className="rounded-2xl border border-slate-200 px-3 py-2 text-sm text-slate-900 focus:border-slate-400 focus:outline-none dark:border-white/10 dark:bg-slate-900/70 dark:text-slate-50"
                        value={templateForm.weeklyPattern[day]?.start_time ?? ''}
                        onChange={(event) =>
                          setTemplateForm((prev) => ({
                            ...prev,
                            weeklyPattern: {
                              ...prev.weeklyPattern,
                              [day]: { ...prev.weeklyPattern[day], start_time: event.target.value },
                            },
                          }))
                        }
                        disabled={templateForm.dayOff[day]}
                      />
                      <input
                        type="time"
                        className="rounded-2xl border border-slate-200 px-3 py-2 text-sm text-slate-900 focus:border-slate-400 focus:outline-none dark:border-white/10 dark:bg-slate-900/70 dark:text-slate-50"
                        value={templateForm.weeklyPattern[day]?.end_time ?? ''}
                        onChange={(event) =>
                          setTemplateForm((prev) => ({
                            ...prev,
                            weeklyPattern: {
                              ...prev.weeklyPattern,
                              [day]: { ...prev.weeklyPattern[day], end_time: event.target.value },
                            },
                          }))
                        }
                        disabled={templateForm.dayOff[day]}
                      />
                    </div>
                  </label>
                ))}
              </div>

              <div className="flex flex-wrap items-center gap-3">
                  <button
                    type="submit"
                    className="inline-flex items-center justify-center rounded-full bg-slate-900 px-6 py-2 text-sm font-semibold text-white shadow-lg shadow-black/40 transition hover:bg-slate-800 dark:bg-white dark:text-slate-900"
                  >
                    {editingTemplateId ? 'Update schedule' : 'Create schedule'}
                  </button>
                <button
                  type="button"
                  onClick={closeModal}
                  className="text-sm font-semibold text-slate-500 underline-offset-2 hover:text-slate-900 dark:text-slate-300"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
};

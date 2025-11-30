import { FormEvent, useEffect, useMemo, useState } from 'react';
import type { AccessRole, Permission, ShiftScope } from '../../types';

export type RoleFormState = {
  name: string;
  description: string;
  level: number;
  permissionCodes: string[];
  shiftIds: string[];
};

type RoleDrawerProps = {
  open: boolean;
  mode: 'create' | 'edit';
  initialRole?: AccessRole | null;
  permissions: Permission[];
  shiftOptions: ShiftScope[];
  onClose: () => void;
  onSubmit: (state: RoleFormState) => void;
  isSaving?: boolean;
  error?: string | null;
};

const emptyForm: RoleFormState = {
  name: '',
  description: '',
  level: 3,
  permissionCodes: [],
  shiftIds: [],
};

export const RoleDrawer = ({
  open,
  mode,
  initialRole,
  permissions,
  shiftOptions,
  onClose,
  onSubmit,
  isSaving = false,
  error,
}: RoleDrawerProps) => {
  const [form, setForm] = useState<RoleFormState>(emptyForm);

  useEffect(() => {
    if (!open) {
      return;
    }
    if (initialRole) {
      setForm({
        name: initialRole.name,
        description: initialRole.description ?? '',
        level: initialRole.level,
        permissionCodes: [...initialRole.permissionCodes],
        shiftIds: initialRole.shifts.map((shift) => shift.id),
      });
      return;
    }
    setForm(emptyForm);
  }, [initialRole, open]);

  const sortedPermissions = useMemo(
    () => [...permissions].sort((a, b) => a.code.localeCompare(b.code)),
    [permissions],
  );
  const sortedShifts = useMemo(() => [...shiftOptions].sort((a, b) => (a.name ?? '').localeCompare(b.name ?? '')), [shiftOptions]);

  const toggleCode = (code: string) => {
    setForm((prev) => {
      const exists = prev.permissionCodes.includes(code);
      return {
        ...prev,
        permissionCodes: exists ? prev.permissionCodes.filter((value) => value !== code) : [...prev.permissionCodes, code],
      };
    });
  };

  const toggleShift = (id: string) => {
    setForm((prev) => {
      const exists = prev.shiftIds.includes(id);
      return {
        ...prev,
        shiftIds: exists ? prev.shiftIds.filter((value) => value !== id) : [...prev.shiftIds, id],
      };
    });
  };

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    onSubmit(form);
  };

  if (!open) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-end bg-slate-900/50 backdrop-blur-sm">
      <div className="h-full w-full max-w-xl overflow-y-auto bg-white shadow-2xl ring-1 ring-slate-900/5 dark:bg-slate-900">
        <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4 dark:border-white/5">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
              {mode === 'create' ? 'Create role' : 'Edit role'}
            </p>
            <h2 className="text-xl font-semibold text-slate-900 dark:text-white">
              {mode === 'create' ? 'New access role' : initialRole?.name ?? 'Update access role'}
            </h2>
            <p className="text-sm text-slate-500 dark:text-slate-400">Lower numbers indicate higher privilege. Permissions stack through inheritance.</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full border border-slate-200 bg-white p-2 text-slate-500 shadow-sm transition hover:bg-slate-50 dark:border-white/10 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700"
            aria-label="Close drawer"
          >
            ×
          </button>
        </div>

        {error ? (
          <div className="mx-6 mt-4 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700 dark:border-rose-600 dark:bg-rose-900/30 dark:text-rose-100">
            {error}
          </div>
        ) : null}

        <form onSubmit={handleSubmit} className="space-y-6 px-6 py-6">
          <div className="space-y-1">
            <label className="text-sm font-medium text-slate-700 dark:text-slate-200">Role name</label>
            <input
              className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-200 dark:border-white/10 dark:bg-slate-900/70 dark:text-slate-50"
              value={form.name}
              onChange={(event) => setForm((prev) => ({ ...prev, name: event.target.value }))}
              placeholder="Lead Youth Care Worker"
              required
            />
          </div>
          <div className="space-y-1">
            <label className="text-sm font-medium text-slate-700 dark:text-slate-200">Description</label>
            <textarea
              className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-200 dark:border-white/10 dark:bg-slate-900/70 dark:text-slate-50"
              value={form.description}
              rows={3}
              onChange={(event) => setForm((prev) => ({ ...prev, description: event.target.value }))}
              placeholder="Where does this role sit in the hierarchy?"
            />
          </div>
          <div className="space-y-1">
            <label className="text-sm font-medium text-slate-700 dark:text-slate-200">Level</label>
            <input
              type="number"
              min={1}
              className="w-32 rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-200 dark:border-white/10 dark:bg-slate-900/70 dark:text-slate-50"
              value={form.level}
              onChange={(event) => setForm((prev) => ({ ...prev, level: Number(event.target.value) }))}
            />
            <p className="text-xs text-slate-500 dark:text-slate-400">Lower numbers inherit from everything below them.</p>
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-100">Permissions</h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">Select explicit permissions. Higher roles also inherit from lower ones.</p>
              </div>
            </div>
            <div className="grid gap-2">
              {sortedPermissions.map((permission) => (
                <label
                  key={permission.id}
                  className="flex items-start gap-3 rounded-xl border border-slate-200 bg-slate-50/60 px-3 py-2 text-sm shadow-sm transition hover:bg-slate-50 dark:border-white/10 dark:bg-white/5"
                >
                  <input
                    type="checkbox"
                    className="mt-1 h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                    checked={form.permissionCodes.includes(permission.code)}
                    onChange={() => toggleCode(permission.code)}
                  />
                  <div>
                    <div className="font-medium text-slate-900 dark:text-slate-50">{permission.code}</div>
                    {permission.description ? (
                      <p className="text-xs text-slate-500 dark:text-slate-400">{permission.description}</p>
                    ) : null}
                  </div>
                </label>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-100">Shift scope (optional)</h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Limit editing permissions to specific shifts. Leave empty to allow any shift.
            </p>
            {sortedShifts.length ? (
              <div className="space-y-2 rounded-xl border border-slate-200 bg-slate-50/50 p-3 shadow-sm dark:border-white/10 dark:bg-white/5">
                {sortedShifts.map((shift) => (
                  <label key={shift.id} className="flex items-center gap-3 text-sm text-slate-700 dark:text-slate-200">
                    <input
                      type="checkbox"
                      className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                      checked={form.shiftIds.includes(shift.id)}
                      onChange={() => toggleShift(shift.id)}
                    />
                    <div>
                      <div className="font-medium">{shift.name || shift.site || 'Shift'}</div>
                      {shift.start_time && shift.end_time ? (
                        <p className="text-xs text-slate-500 dark:text-slate-400">
                          {new Date(shift.start_time).toLocaleString()} – {new Date(shift.end_time).toLocaleString()}
                        </p>
                      ) : null}
                    </div>
                  </label>
                ))}
              </div>
            ) : (
              <p className="text-xs text-slate-500 dark:text-slate-400">No shifts available to scope this role.</p>
            )}
          </div>

          <div className="sticky bottom-0 -mx-6 -mb-6 flex justify-end gap-3 border-t border-slate-100 bg-white px-6 py-4 dark:border-white/10 dark:bg-slate-900">
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-50 dark:border-white/10 dark:bg-white/5 dark:text-slate-100"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="rounded-xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:bg-indigo-400"
              disabled={isSaving}
            >
              {mode === 'create' ? 'Create role' : 'Save changes'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

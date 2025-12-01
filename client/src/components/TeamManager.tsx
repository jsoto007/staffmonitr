import { AxiosError } from 'axios';
import { useEffect, useState, type FormEvent } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useAccountContext } from '../context/AccountContext';
import { useAuth } from '../context/AuthContext';
import api from '../utils/api';
import { useStaffMatrixRoles } from '../hooks/useStaffMatrixRoles';
import type { Role } from '../types';

export const TeamManager = () => {
  const { selectedAccount } = useAccountContext();
  const { currentStaff } = useAuth();
  const accountId = selectedAccount?.id;
  const { roles: staffMatrixRoles } = useStaffMatrixRoles(accountId);
  const roleOptions = staffMatrixRoles.map((role) => role.name);
  const [formState, setFormState] = useState({
    full_name: '',
    email: '',
    role: '' as Role,
    password: '',
  });
  const [status, setStatus] = useState<string | null>(null);

  const isOwnerAdmin = currentStaff?.role === 'Owner_admin';

  const { data: staffList = [], isFetching, refetch } = useQuery(
    ['accountStaff', selectedAccount?.id],
    async () => {
      const response = await api.get(`/accounts/${selectedAccount?.id}/staff`);
      return response.data.staff;
    },
    {
      enabled: Boolean(selectedAccount?.id && isOwnerAdmin),
      refetchOnWindowFocus: false,
    },
  );

  useEffect(() => {
    if (!formState.role && roleOptions[0]) {
      setFormState((prev) => ({ ...prev, role: roleOptions[0] as Role }));
    }
  }, [formState.role, roleOptions]);

  const handleChange = (field: keyof typeof formState, value: string) => {
    setFormState((prev) => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!selectedAccount) return;
    if (!formState.role) {
      setStatus('Select a role from the Staff Matrix.');
      return;
    }
    setStatus('Creating staff account…');
    try {
      await api.post(`/accounts/${selectedAccount.id}/staff`, {
        full_name: formState.full_name.trim(),
        email: formState.email.trim(),
        role: formState.role,
        password: formState.password,
      });
      setStatus('Staff account created for your group.');
      setFormState({ full_name: '', email: '', role: 'Staff', password: '' });
      refetch();
    } catch (err) {
      const message =
        (err as AxiosError<{ error?: string }>)?.response?.data?.error || 'Unable to create staff account.';
      setStatus(message);
    }
  };

  if (!selectedAccount) {
    return null;
  }

  return (
    <section className="rounded-2xl border border-slate-800 bg-slate-900/60 p-6 shadow-inner shadow-black/40">
      <div className="flex flex-col gap-1">
        <p className="text-xs uppercase tracking-[0.4em] text-slate-400">Team</p>
        <h2 className="text-xl font-semibold text-white">Manage your admin & staff pool</h2>
        <p className="text-xs text-slate-500">
          Owner admins can create staff accounts that are automatically scoped to {selectedAccount.name}.
        </p>
      </div>

      {!isOwnerAdmin ? (
        <p className="mt-4 text-sm text-slate-400">
          Only owner administrators can invite or create team members. Contact your workspace owner to get started.
        </p>
      ) : (
        <>
          <form className="mt-6 space-y-4" onSubmit={handleSubmit}>
            <div className="grid gap-4 lg:grid-cols-2">
              <label className="space-y-1 text-xs text-slate-400">
                Full name
                <input
                  type="text"
                  required
                  value={formState.full_name}
                  onChange={(event) => handleChange('full_name', event.target.value)}
                  className="mt-1 w-full rounded-2xl border border-slate-800 bg-slate-950/70 px-3 py-2 text-sm text-white focus:border-brand-500 focus:outline-none"
                />
              </label>
              <label className="space-y-1 text-xs text-slate-400">
                Email
                <input
                  type="email"
                  required
                  value={formState.email}
                  onChange={(event) => handleChange('email', event.target.value)}
                  className="mt-1 w-full rounded-2xl border border-slate-800 bg-slate-950/70 px-3 py-2 text-sm text-white focus:border-brand-500 focus:outline-none"
                />
              </label>
            </div>
            <div className="grid gap-4 lg:grid-cols-2">
              <label className="space-y-1 text-xs text-slate-400">
                Role
                <select
                  value={formState.role}
                  onChange={(event) => handleChange('role', event.target.value)}
                  className="mt-1 w-full rounded-2xl border border-slate-800 bg-slate-950/70 px-3 py-2 text-sm text-white focus:border-brand-500 focus:outline-none"
                  disabled={!roleOptions.length}
                >
                  {roleOptions.map((role) => (
                    <option key={role} value={role}>
                      {role}
                    </option>
                  ))}
                </select>
                {!roleOptions.length ? (
                  <p className="text-[11px] text-amber-300">
                    Roles come from the Staff Matrix. Add them there first.
                  </p>
                ) : null}
              </label>
              <label className="space-y-1 text-xs text-slate-400">
                Password
                <input
                  type="password"
                  required
                  minLength={8}
                  value={formState.password}
                  onChange={(event) => handleChange('password', event.target.value)}
                  className="mt-1 w-full rounded-2xl border border-slate-800 bg-slate-950/70 px-3 py-2 text-sm text-white focus:border-brand-500 focus:outline-none"
                />
              </label>
            </div>
            <button
              type="submit"
              disabled={!roleOptions.length}
              className="w-full rounded-2xl bg-gradient-to-r from-brand-500 to-brand-700 px-4 py-3 text-sm font-semibold uppercase tracking-[0.4em] text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {roleOptions.length ? `Add to ${selectedAccount.name}` : 'Add roles in Staff Matrix first'}
            </button>
          </form>
          {status && <p className="mt-2 text-xs text-slate-500">{status}</p>}
          <div className="mt-6 grid gap-3">
            {isFetching ? (
              <p className="text-xs text-slate-500">Refreshing team roster…</p>
            ) : staffList.length === 0 ? (
              <p className="text-xs text-slate-500">No staff yet. Add someone to see them here.</p>
            ) : (
              staffList.map((member) => (
                <div key={member.id} className="rounded-2xl border border-slate-800 bg-slate-950/60 px-4 py-3 text-sm text-slate-300">
                  <div className="flex items-center justify-between">
                    <p className="font-semibold text-white">{member.full_name}</p>
                    <span className="text-xs uppercase tracking-[0.3em] text-slate-500">{member.role}</span>
                  </div>
                  <p className="text-xs text-slate-400">{member.email}</p>
                </div>
              ))
            )}
          </div>
        </>
      )}
    </section>
  );
};

import { useMemo, useState } from 'react';
import type React from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';

import { useAccountContext } from '../context/AccountContext';
import { useAuth } from '../context/AuthContext';
import { ADMIN_ROLE_SET, ROLE_OPTIONS } from '../constants/roles';
import { createAccountStaff, fetchAccountStaff, updateAccountStaff } from '../services/staff';
import type { StaffMember } from '../types';

type StaffStatus = 'active' | 'paused' | 'inactive';

export const StaffSettingsPage = () => {
  const { selectedAccount } = useAccountContext();
  const { currentStaff, loading: authLoading, isAuthenticated } = useAuth();
  const queryClient = useQueryClient();
  const accountId = !authLoading && isAuthenticated ? selectedAccount?.id ?? '' : '';
  const isAdmin = ADMIN_ROLE_SET.has(currentStaff?.role ?? '');

  const [newStaff, setNewStaff] = useState({ full_name: '', email: '', role: ROLE_OPTIONS[0], password: '' });
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState<{ full_name: string; email: string }>({ full_name: '', email: '' });
  const [feedback, setFeedback] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');

  const {
    data: staff = [],
    isLoading,
    isFetching,
  } = useQuery(['accountStaff', accountId], () => fetchAccountStaff(accountId), {
    enabled: Boolean(accountId) && isAdmin,
  });

  const sortedStaff = useMemo(() => [...staff].sort((a, b) => a.full_name.localeCompare(b.full_name)), [staff]);
  const filteredStaff = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    if (!term) {
      return sortedStaff;
    }
    return sortedStaff.filter((member) => {
      const name = member.full_name.toLowerCase();
      const email = (member.email || '').toLowerCase();
      const role = (member.role || '').toLowerCase();
      return name.includes(term) || email.includes(term) || role.includes(term);
    });
  }, [sortedStaff, searchTerm]);

  const invalidateStaff = () => {
    if (accountId) {
      queryClient.invalidateQueries(['accountStaff', accountId]);
    }
  };

  const createMutation = useMutation(
    (payload: { full_name: string; email: string; role: string; password: string }) => createAccountStaff(accountId, payload),
    {
      onSuccess: () => {
        setNewStaff({ full_name: '', email: '', role: ROLE_OPTIONS[0], password: '' });
        setFeedback('Staff member added.');
        invalidateStaff();
      },
      onError: () => {
        setFeedback('Unable to add staff. Check required fields.');
      },
    },
  );

  const updateMutation = useMutation(
    ({ staffId, updates }: { staffId: string; updates: Partial<StaffMember> }) =>
      updateAccountStaff(accountId, staffId, updates),
    {
      onSuccess: () => {
        setEditingId(null);
        invalidateStaff();
      },
    },
  );

  const handleCreate = (event: React.FormEvent) => {
    event.preventDefault();
    setFeedback(null);
    if (!newStaff.full_name.trim() || !newStaff.email.trim() || !newStaff.password.trim()) {
      setFeedback('Name, email, and password are required.');
      return;
    }
    createMutation.mutate({
      full_name: newStaff.full_name.trim(),
      email: newStaff.email.trim(),
      role: newStaff.role,
      password: newStaff.password,
    });
  };

  const handleEditToggle = (member: StaffMember) => {
    setEditingId(member.id);
    setEditDraft({ full_name: member.full_name, email: member.email });
  };

  const handleSaveDetails = (memberId: string) => {
    if (!editDraft.full_name.trim() || !editDraft.email.trim()) {
      return;
    }
    updateMutation.mutate({
      staffId: memberId,
      updates: { full_name: editDraft.full_name.trim(), email: editDraft.email.trim() },
    });
  };

  const handleStatusChange = (memberId: string, status: StaffStatus) => {
    updateMutation.mutate({ staffId: memberId, updates: { status } });
  };

  const handleRoleChange = (memberId: string, role: string) => {
    updateMutation.mutate({ staffId: memberId, updates: { role } });
  };

  if (!selectedAccount) {
    return (
      <section className="rounded-2xl border border-white/10 bg-slate-900/70 p-6 text-sm text-slate-300">
        Unable to load account context.
      </section>
    );
  }

  if (!isAdmin) {
    return (
      <section className="rounded-2xl border border-white/10 bg-slate-900/70 p-6 text-sm text-slate-300">
        Admin access required to manage staff.
      </section>
    );
  }

  return (
    <section className="space-y-8">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-[0.4em] text-slate-400">Roster</p>
          <h1 className="text-3xl font-semibold text-white">Staff Settings</h1>
          <p className="max-w-2xl text-sm text-slate-400">
            Add teammates, adjust roles, and keep account access in sync with program needs.
          </p>
        </div>
        <Link
          to="/roster"
          className="rounded-2xl border border-white/10 bg-white/5 px-4 py-2 text-sm font-semibold text-white transition hover:border-white/30"
        >
          Back to roster
        </Link>
      </header>

      <div className="grid gap-6 lg:grid-cols-3">
        <article className="space-y-4 rounded-3xl border border-white/10 bg-slate-950/70 p-5 lg:col-span-1">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-white">Add staff</h2>
            <span className="text-xs uppercase tracking-[0.3em] text-slate-400">Create</span>
          </div>
          <form className="space-y-3" onSubmit={handleCreate}>
            <label className="block text-xs uppercase tracking-[0.3em] text-slate-400">
              Full name
              <input
                type="text"
                value={newStaff.full_name}
                onChange={(event) => setNewStaff((prev) => ({ ...prev, full_name: event.target.value }))}
                className="mt-1 w-full rounded-2xl border border-white/10 bg-slate-900/60 px-3 py-2 text-sm text-white focus:border-white focus:outline-none"
                placeholder="Alex Doe"
              />
            </label>
            <label className="block text-xs uppercase tracking-[0.3em] text-slate-400">
              Email
              <input
                type="email"
                value={newStaff.email}
                onChange={(event) => setNewStaff((prev) => ({ ...prev, email: event.target.value }))}
                className="mt-1 w-full rounded-2xl border border-white/10 bg-slate-900/60 px-3 py-2 text-sm text-white focus:border-white focus:outline-none"
                placeholder="name@org.com"
              />
            </label>
            <label className="block text-xs uppercase tracking-[0.3em] text-slate-400">
              Role
              <select
                value={newStaff.role}
                onChange={(event) => setNewStaff((prev) => ({ ...prev, role: event.target.value }))}
                className="mt-1 w-full rounded-2xl border border-white/10 bg-slate-900/60 px-3 py-2 text-sm text-white focus:border-white focus:outline-none"
              >
                {ROLE_OPTIONS.map((role) => (
                  <option key={role} value={role} className="bg-slate-900 text-white">
                    {role}
                  </option>
                ))}
              </select>
            </label>
            <label className="block text-xs uppercase tracking-[0.3em] text-slate-400">
              Password
              <input
                type="password"
                value={newStaff.password}
                onChange={(event) => setNewStaff((prev) => ({ ...prev, password: event.target.value }))}
                className="mt-1 w-full rounded-2xl border border-white/10 bg-slate-900/60 px-3 py-2 text-sm text-white focus:border-white focus:outline-none"
                placeholder="Temporary password"
              />
            </label>
            <button
              type="submit"
              disabled={createMutation.isLoading}
              className="w-full rounded-2xl border border-transparent bg-gradient-to-r from-indigo-500 to-violet-600 px-4 py-2 text-sm font-semibold text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {createMutation.isLoading ? 'Adding…' : 'Add staff member'}
            </button>
          </form>
        </article>

        <article className="lg:col-span-2">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <div>
              <p className="text-xs uppercase tracking-[0.3em] text-slate-400">Team</p>
              <h2 className="text-lg font-semibold text-white">Manage access</h2>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <label className="relative">
                <span className="sr-only">Search staff</span>
                <input
                  type="search"
                  value={searchTerm}
                  onChange={(event) => setSearchTerm(event.target.value)}
                  placeholder="Search name, email, or role"
                  className="w-64 rounded-2xl border border-white/10 bg-slate-900/60 px-3 py-2 text-sm text-white focus:border-white focus:outline-none"
                />
              </label>
              {isFetching && <span className="text-xs text-slate-400">Refreshing…</span>}
            </div>
          </div>
          {feedback && <p className="text-sm text-slate-300">{feedback}</p>}

          <div className="space-y-3">
            {isLoading && <p className="text-sm text-slate-400">Loading staff…</p>}
            {!isLoading && filteredStaff.length === 0 && (
              <p className="rounded-2xl border border-dashed border-white/10 bg-slate-950/60 p-4 text-sm text-slate-400">
                No staff found. Adjust your search or add a teammate to enable scheduling and assignments.
              </p>
            )}
            {filteredStaff.map((member) => {
              const isEditing = editingId === member.id;
              const memberStatus = member.status ?? 'active';
              return (
                <div
                  key={member.id}
                  className="space-y-3 rounded-3xl border border-white/10 bg-slate-950/60 p-4 shadow-inner shadow-black/30"
                >
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      {isEditing ? (
                        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                          <input
                            type="text"
                            value={editDraft.full_name}
                            onChange={(event) => setEditDraft((prev) => ({ ...prev, full_name: event.target.value }))}
                            className="w-full rounded-2xl border border-white/10 bg-slate-900/60 px-3 py-2 text-sm text-white focus:border-white focus:outline-none sm:w-56"
                          />
                          <input
                            type="email"
                            value={editDraft.email}
                            onChange={(event) => setEditDraft((prev) => ({ ...prev, email: event.target.value }))}
                            className="w-full rounded-2xl border border-white/10 bg-slate-900/60 px-3 py-2 text-sm text-white focus:border-white focus:outline-none sm:w-56"
                          />
                        </div>
                      ) : (
                        <>
                          <p className="text-base font-semibold text-white">{member.full_name}</p>
                          <p className="text-xs text-slate-400">{member.email}</p>
                        </>
                      )}
                    </div>
                    <div className="flex flex-wrap items-center gap-2 text-[11px] uppercase tracking-[0.3em] text-slate-400">
                      <span className="rounded-full border border-white/10 px-3 py-1 text-slate-200">{memberStatus}</span>
                      {isEditing ? (
                        <>
                          <button
                            type="button"
                            onClick={() => handleSaveDetails(member.id)}
                            className="rounded-2xl border border-emerald-400/70 px-3 py-2 text-[11px] font-semibold text-emerald-200 transition hover:border-emerald-300"
                          >
                            Save
                          </button>
                          <button
                            type="button"
                            onClick={() => setEditingId(null)}
                            className="rounded-2xl border border-white/20 px-3 py-2 text-[11px] font-semibold text-slate-200 transition hover:border-white/40"
                          >
                            Cancel
                          </button>
                        </>
                      ) : (
                        <button
                          type="button"
                          onClick={() => handleEditToggle(member)}
                          className="rounded-2xl border border-white/20 px-3 py-2 text-[11px] font-semibold text-slate-200 transition hover:border-white/40"
                        >
                          Edit details
                        </button>
                      )}
                    </div>
                  </div>

                  <div className="grid gap-3 sm:grid-cols-3">
                    <label className="text-xs uppercase tracking-[0.3em] text-slate-400">
                      Edit role
                      <select
                        value={member.role}
                        onChange={(event) => handleRoleChange(member.id, event.target.value)}
                        className="mt-1 w-full rounded-2xl border border-white/10 bg-slate-900/60 px-3 py-2 text-sm text-white focus:border-white focus:outline-none"
                      >
                        {ROLE_OPTIONS.map((role) => (
                          <option key={role} value={role} className="bg-slate-900 text-white">
                            {role}
                          </option>
                        ))}
                      </select>
                    </label>
                    <div className="space-y-2 rounded-2xl border border-white/10 bg-slate-900/40 p-3 text-xs text-slate-300">
                      <p className="text-[11px] uppercase tracking-[0.3em] text-slate-400">Status</p>
                      <div className="flex flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={() => handleStatusChange(member.id, 'active')}
                          className="rounded-xl border border-emerald-400/70 px-3 py-2 text-[11px] font-semibold text-emerald-100 transition hover:border-emerald-300"
                        >
                          Activate
                        </button>
                        <button
                          type="button"
                          onClick={() => handleStatusChange(member.id, 'paused')}
                          className="rounded-xl border border-amber-300/70 px-3 py-2 text-[11px] font-semibold text-amber-100 transition hover:border-amber-200"
                        >
                          Pause
                        </button>
                        <button
                          type="button"
                          onClick={() => handleStatusChange(member.id, 'inactive')}
                          className="rounded-xl border border-rose-400/70 px-3 py-2 text-[11px] font-semibold text-rose-100 transition hover:border-rose-300"
                        >
                          Deactivate
                        </button>
                      </div>
                    </div>
                    <div className="space-y-2 rounded-2xl border border-white/10 bg-slate-900/40 p-3 text-xs text-slate-300">
                      <p className="text-[11px] uppercase tracking-[0.3em] text-slate-400">Notes</p>
                      <p className="text-sm text-slate-400">
                        Use role and status controls to match coverage templates and keep permissions aligned.
                      </p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </article>
      </div>
    </section>
  );
};

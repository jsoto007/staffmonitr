import { useMemo, useState } from 'react';

import type { StaffMember } from '../../types';

interface AssignStaffModalProps {
  site: string;
  timeRange: string;
  ratioMin: number;
  assignedStaffIds: string[];
  staffMembers: StaffMember[];
  onClose: () => void;
  onAssign: (staffId: string) => void;
  isLoading: boolean;
  errorMessage?: string | null;
  note?: string;
}

export const AssignStaffModal = ({
  site,
  timeRange,
  ratioMin,
  assignedStaffIds,
  staffMembers,
  onClose,
  onAssign,
  isLoading,
  errorMessage,
  note,
}: AssignStaffModalProps) => {
  const [query, setQuery] = useState('');
  const normalizedQuery = query.trim().toLowerCase();
  const assignedSet = useMemo(() => new Set(assignedStaffIds), [assignedStaffIds]);

  const filteredStaff = useMemo(() => {
    return staffMembers
      .filter((member) => {
        if (!normalizedQuery) {
          return true;
        }
        const name = member.full_name.toLowerCase();
        const email = member.email.toLowerCase();
        return name.includes(normalizedQuery) || email.includes(normalizedQuery);
      })
      .sort((a, b) => a.full_name.localeCompare(b.full_name));
  }, [normalizedQuery, staffMembers]);

  const assignedCount = assignedStaffIds.length;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-black/60 p-4"
      role="dialog"
      aria-modal="true"
      aria-label={`Assign staff to ${site}`}
      onClick={onClose}
    >
      <div
        className="w-full max-w-3xl overflow-hidden rounded-3xl border border-white/10 bg-slate-950/90 shadow-2xl shadow-black/60"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex flex-col gap-3 border-b border-white/5 px-6 py-5 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.4em] text-slate-400">Assign staff</p>
            <h2 className="text-xl font-semibold text-white">{site}</h2>
            <p className="text-sm text-slate-400">{timeRange}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-2xl border border-white/20 px-4 py-2 text-xs font-semibold uppercase tracking-[0.4em] text-slate-300 transition hover:border-white/50 hover:text-white"
          >
            Close
          </button>
        </div>

        <div className="space-y-4 px-6 py-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-slate-400">
              {assignedCount} assigned · ratio minimum {ratioMin}
            </p>
            <p className="text-xs uppercase tracking-[0.4em] text-slate-400">{note ?? 'Creates a new assignment slot'}</p>
          </div>

          <label className="block text-xs uppercase tracking-[0.4em] text-slate-400">
            Search staff
            <input
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Type a name or email"
              className="mt-2 w-full rounded-2xl border border-white/10 bg-slate-950/40 px-3 py-2 text-sm text-white focus:border-white focus:outline-none"
            />
          </label>

          {errorMessage && <p className="text-xs text-rose-400">{errorMessage}</p>}

          <div className="max-h-[55vh] space-y-2 overflow-y-auto pr-1">
            {filteredStaff.length === 0 ? (
              <p className="text-sm text-slate-400">No staff members match that search.</p>
            ) : (
              filteredStaff.map((member) => {
                const alreadyAssigned = assignedSet.has(member.id);
                return (
                  <div
                    key={member.id}
                    className="flex items-center justify-between gap-3 rounded-2xl border border-white/5 bg-slate-900/60 px-4 py-3"
                  >
                    <div>
                      <p className="text-sm font-semibold text-white">{member.full_name}</p>
                      <p className="text-[11px] text-slate-400">
                        {member.role} · {member.status}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => onAssign(member.id)}
                      disabled={isLoading || alreadyAssigned}
                      className={`rounded-2xl border px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.4em] transition ${
                        alreadyAssigned
                          ? 'border-white/10 text-slate-500'
                          : 'border-transparent bg-gradient-to-r from-brand-500 to-brand-700 text-white hover:opacity-90'
                      } ${isLoading ? 'cursor-wait opacity-60' : ''}`}
                    >
                      {alreadyAssigned ? 'Assigned' : 'Assign'}
                    </button>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

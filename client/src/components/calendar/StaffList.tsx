import type { Assignment, StaffMember } from '../../types';

interface StaffListProps {
  assignments: Assignment[];
  staffById: Record<string, StaffMember>;
  fallbackRole?: string;
}

export const StaffList = ({ assignments, staffById, fallbackRole }: StaffListProps) => {
  if (!assignments.length) {
    return <p className="mt-3 text-sm text-slate-400">No staff assigned yet.</p>;
  }

  return (
    <div className="mt-3 space-y-2">
      {assignments.map((assignment) => {
        const staffName = assignment.staff_id
          ? staffById[assignment.staff_id]?.full_name ?? 'Unassigned slot'
          : 'Unassigned slot';
        return (
          <div
            key={assignment.id}
            className="flex items-center justify-between gap-3 rounded-2xl border border-white/5 bg-white/5 px-3 py-2 text-sm text-slate-100"
          >
            <div>
              <p className="text-sm font-semibold text-white">{staffName}</p>
              <p className="text-xs text-slate-300">
                {assignment.title} · Difficulty {assignment.difficulty}
              </p>
            </div>
            <span className="text-[11px] uppercase tracking-[0.4em] text-slate-400">{assignment.staffRole ?? fallbackRole ?? 'Staff'}</span>
          </div>
        );
      })}
    </div>
  );
};

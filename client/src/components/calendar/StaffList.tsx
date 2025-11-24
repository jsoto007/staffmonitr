import type { Assignment, StaffMember } from '../../types';

interface StaffListProps {
  assignments: Assignment[];
  staffById: Record<string, StaffMember>;
  fallbackRole?: string;
  onRemoveAssignment?: (assignmentId: string) => void;
  allowRemove?: boolean;
}

export const StaffList = ({ assignments, staffById, fallbackRole, onRemoveAssignment, allowRemove }: StaffListProps) => {
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
            <div className="flex items-center gap-2">
              <span className="text-[11px] uppercase tracking-[0.4em] text-slate-400">{assignment.staffRole ?? fallbackRole ?? 'Staff'}</span>
              {allowRemove && onRemoveAssignment && (
                <button
                  type="button"
                  onClick={() => onRemoveAssignment(assignment.id)}
                  className="rounded-xl border border-white/15 px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.3em] text-slate-300 transition hover:border-rose-300/50 hover:text-white"
                >
                  Remove
                </button>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
};

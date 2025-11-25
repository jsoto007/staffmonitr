import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useScheduleStore } from '../stores/scheduleStore';
import type { KidDetails } from '../types';

export const RosterPage = () => {
  const { kids } = useScheduleStore();

  const grouped = useMemo<Record<string, KidDetails[]>>(() => {
    return kids.reduce<Record<string, KidDetails[]>>((acc, kid) => {
      const ratio = kid.ratio;
      acc[ratio] = acc[ratio] ? [...acc[ratio], kid] : [kid];
      return acc;
    }, {});
  }, [kids]);

  return (
    <section className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm uppercase tracking-[0.4em] text-slate-500">Roster</p>
          <h1 className="text-3xl font-semibold text-white">Kids & assignment ratios</h1>
        </div>
        <div className="flex flex-wrap gap-2">
          <button className="rounded-2xl border border-slate-800 px-4 py-2 text-sm text-slate-200">Import CSV</button>
          <button className="rounded-2xl border border-slate-800 px-4 py-2 text-sm text-slate-200">Export filtered</button>
          <Link
            to="/staff"
            className="rounded-2xl border border-white/10 bg-white/5 px-4 py-2 text-sm font-semibold text-white transition hover:border-white/30"
          >
            Staff
          </Link>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {Object.entries(grouped).map(([ratio, list]) => (
          <div key={ratio} className="rounded-2xl border border-slate-800 bg-slate-900/40 p-4">
            <p className="text-sm text-slate-400">Ratio {ratio}</p>
            <p className="text-2xl font-semibold text-white">{list.length} kid(s)</p>
            <ul className="mt-3 space-y-3 text-sm text-slate-400">
              {list.slice(0, 4).map((kid) => (
                <li key={kid.id} className="space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-white">{kid.name}</span>
                    <span className="text-xs uppercase tracking-[0.4em] text-amber-300">
                      {kid.requiresOneOnOne ? '1:1' : 'Group'}
                    </span>
                  </div>
                  {kid.specialInstructions && (
                    <p className="text-xs text-slate-500">{kid.specialInstructions}</p>
                  )}
                  {kid.bans && kid.bans.length > 0 && (
                    <p className="text-xs text-rose-300">Banned: {kid.bans.join(', ')}</p>
                  )}
                </li>
              ))}
            </ul>
            {list.length > 4 && (
              <p className="mt-2 text-xs text-slate-500">{list.length - 4} more kids</p>
            )}
          </div>
        ))}
        {kids.length === 0 && (
          <div className="rounded-2xl border border-dashed border-slate-800/40 p-6 text-sm text-slate-500">
            No kids loaded. Use the import workflow with preview and custom field mapping for the first upload.
          </div>
        )}
      </div>
    </section>
  );
};

// Backward compatibility export until all imports switch to RosterPage.
export const KidsPage = RosterPage;

import {
  CalendarDaysIcon,
  HomeIcon,
  MegaphoneIcon,
  UserGroupIcon,
} from '@heroicons/react/24/outline';
import clsx from 'clsx';
import { ReactNode } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { NavBarContainer } from './navigation/NavBarContainer';

export const Layout = ({ children }: { children: ReactNode }) => {
  const location = useLocation();

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-purple-50 to-blue-50 text-slate-800 transition-colors duration-300 ease-out dark:from-gray-900 dark:via-slate-900 dark:to-black dark:text-slate-100">
      <NavBarContainer />
      <div className="mx-auto flex max-w-8xl flex-col gap-4 px-4 pb-20 pt-32">
        <main className="w-full flex-1 rounded-[2rem] border border-white/40 bg-white/70 p-6 shadow-lg shadow-black/5 backdrop-blur-2xl transition-all duration-300 ease-out hover:shadow-xl hover:shadow-black/10 dark:border-white/10 dark:bg-slate-900/60 dark:shadow-xl dark:shadow-black/20">
          {children}
        </main>
      </div>

      <nav className="fixed bottom-8 left-1/2 z-50 flex h-16 min-w-[300px] max-w-xl -translate-x-1/2 items-center justify-between gap-4 rounded-full border border-white/40 bg-white/70 px-6 text-slate-800 shadow-lg shadow-black/5 backdrop-blur-2xl transition-all duration-300 ease-out md:hidden dark:border-white/10 dark:bg-slate-900/60 dark:text-slate-100 dark:shadow-xl dark:shadow-black/20">
        {[{ path: '/dashboard', Icon: HomeIcon, label: 'Home' }, { path: '/calendar/projection', Icon: CalendarDaysIcon, label: 'Projection' }, { path: '/roster', Icon: UserGroupIcon, label: 'Roster' }, { path: '/open-shifts', Icon: MegaphoneIcon, label: 'Broadcasts' }].map((item) => (
          <Link
            key={item.path}
            to={item.path}
            className={clsx(
              'relative flex flex-1 items-center justify-center gap-2 rounded-full px-3 py-2 text-sm font-semibold transition-all duration-300 ease-out hover:scale-105 hover:bg-white/90 active:scale-95 dark:hover:bg-white/10',
              location.pathname === item.path
                ? 'bg-white text-violet-600 shadow-md shadow-black/10 ring-1 ring-white/60 dark:bg-white/10 dark:text-cyan-400 dark:ring-white/10'
                : 'text-slate-700 dark:text-slate-100',
            )}
          >
            <item.Icon className="h-5 w-5" aria-hidden="true" />
            <span className="sr-only sm:not-sr-only sm:inline">{item.label}</span>
          </Link>
        ))}
      </nav>
    </div>
  );
};

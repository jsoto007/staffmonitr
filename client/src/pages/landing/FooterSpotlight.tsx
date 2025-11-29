import { Link } from 'react-router-dom';

export const FooterSpotlight = () => (
  <footer id="resources" className="bg-white text-slate-900 dark:bg-slate-950 dark:text-white">
    <div className="mx-auto max-w-8xl px-4 py-16 sm:px-6 lg:px-8">
      <div className="rounded-3xl border border-slate-200 bg-slate-50/80 p-8 text-center shadow-lg shadow-slate-200/40 dark:border-slate-800 dark:bg-slate-900/60">
        <p className="text-xs uppercase tracking-[0.4em] text-indigo-500">Stay informed</p>
        <h2 className="mt-4 text-3xl font-semibold text-slate-900 dark:text-white sm:text-4xl">
          Launch secure schedules in minutes.
        </h2>
        <p className="mt-3 text-base text-slate-600 dark:text-slate-300">
          Join the staffmonitr waitlist to see how autonomous scheduling, analytics, and compliance reporting can work for you.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-4">
          <Link
            to="/signup"
            className="rounded-full bg-gradient-to-r from-indigo-600 to-sky-500 px-7 py-3 text-sm font-semibold uppercase tracking-[0.4em] text-white shadow-lg shadow-indigo-500/30 transition hover:opacity-90"
          >
            Request access
          </Link>
          <Link
            to="/signin"
            className="rounded-full border border-slate-200 px-7 py-3 text-sm font-semibold uppercase tracking-[0.4em] text-slate-900 transition hover:border-slate-400 dark:border-slate-700 dark:text-white"
          >
            Login
          </Link>
        </div>
        <p className="mt-6 text-xs uppercase tracking-[0.4em] text-slate-500 dark:text-slate-400">
          © {new Date().getFullYear()} StaffMonitr, Inc.
        </p>
      </div>
    </div>
  </footer>
);

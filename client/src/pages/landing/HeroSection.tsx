import { Link } from 'react-router-dom';
import { heroStats } from './data';

export const HeroSection = () => (
  <section className="relative overflow-hidden bg-white text-slate-900 dark:bg-slate-950 dark:text-white">
    <div className="pointer-events-none absolute inset-0 opacity-40" aria-hidden="true">
      <div className="absolute left-1/2 top-0 h-64 w-64 -translate-x-1/2 rounded-full bg-gradient-to-r from-sky-500 to-indigo-500 blur-3xl" />
    </div>
    <div className="relative mx-auto flex max-w-8xl flex-col gap-10 px-4 pb-14 pt-28 sm:pt-32 sm:pb-16 lg:flex-row lg:items-center lg:pb-20">
      <div className="z-10 w-full lg:max-w-2xl">
        <p className="text-sm font-semibold uppercase tracking-[0.4em] text-indigo-500">Regulated staffing</p>
        <h1 className="mt-4 text-4xl font-semibold leading-tight tracking-tight text-slate-900 dark:text-white sm:text-5xl">
          Staff, assignments, and geofenced shifts for safety-first teams.
        </h1>
        <p className="mt-6 text-lg leading-relaxed text-slate-600 dark:text-slate-300">
          StaffMonitr keeps ratios auditable, geofences enforced, and notifications delivered to every role in seconds.
          Build assignments with context, secure every campus, and ship deployments with a stack designed for regulated
          providers.
        </p>
        <div className="mt-8 flex flex-wrap gap-3">
          <Link
            to="/signup"
            className="rounded-full bg-gradient-to-r from-indigo-600 to-blue-500 px-6 py-3 text-sm font-semibold uppercase tracking-[0.4em] text-white shadow-lg shadow-indigo-500/30 transition hover:opacity-90"
          >
            Start a trial
          </Link>
          <Link
            to="/dashboard"
            className="rounded-full border border-slate-200 px-6 py-3 text-sm font-semibold uppercase tracking-[0.4em] text-slate-900 transition hover:border-slate-400 dark:border-slate-700 dark:text-white"
          >
            Explore dashboard
          </Link>
        </div>
        <div className="mt-10 grid gap-6 sm:grid-cols-3">
          {heroStats.map((stat) => (
            <div key={stat.label} className="rounded-2xl border border-slate-200/60 bg-slate-50/80 p-4 text-center dark:border-slate-800 dark:bg-slate-900/80">
              <p className="text-2xl font-semibold text-slate-900 dark:text-white">{stat.value}</p>
              <p className="text-xs uppercase tracking-[0.3em] text-slate-500 dark:text-slate-400">{stat.label}</p>
              <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{stat.detail}</p>
            </div>
          ))}
        </div>
      </div>
      <aside className="z-10 w-full lg:max-w-lg">
        <div className="rounded-3xl border border-slate-200 bg-gradient-to-br from-slate-900/80 via-slate-950/70 to-slate-900/90 p-6 text-slate-100 shadow-2xl dark:border-slate-800">
          <p className="text-xs uppercase tracking-[0.4em] text-slate-400">Live coverage</p>
          <p className="mt-4 text-2xl font-semibold text-white">24/7 multi-site scheduling</p>
          <p className="mt-3 text-sm text-slate-300">
            Publish shifts, invite operators, and configure open-shift approvals with full audit trails and usage logs.
          </p>
          <div className="mt-6 space-y-4 text-sm text-slate-200">
            <div className="flex items-center justify-between border-t border-white/10 pt-3">
              <span>Sites tracked</span>
              <strong>12 campuses</strong>
            </div>
            <div className="flex items-center justify-between border-t border-white/10 pt-3">
              <span>Active ratios</span>
              <strong>1:4 · 1:1 · 2:1</strong>
            </div>
            <div className="flex items-center justify-between border-t border-white/10 pt-3">
              <span>Email + push</span>
              <strong>enabled</strong>
            </div>
          </div>
        </div>
      </aside>
    </div>
  </section>
);

import { highlights } from './data';

export const FeatureHighlights = () => (
  <section id="features" className="bg-slate-50 py-20 dark:bg-slate-950">
    <div className="mx-auto max-w-8xl space-y-8 px-4 sm:px-6 lg:px-8">
      <div className="space-y-2 text-center">
        <p className="text-xs uppercase tracking-[0.5em] text-indigo-500">Capabilities</p>
        <h2 className="text-3xl font-semibold text-slate-900 dark:text-white sm:text-4xl">Designed for regulated teams</h2>
        <p className="text-lg text-slate-600 dark:text-slate-300">
          Role-based experiences, multi-tenant isolation, and adaptive geofence enforcement keep compliance predictable. Each
          feature is built for clarity, performance, and memorable team experiences.
        </p>
      </div>
      <div className="grid gap-6 md:grid-cols-2">
        {highlights.map((feature) => (
          <article
            key={feature.title}
            className="flex flex-col gap-3 rounded-3xl border border-slate-200 bg-white/80 p-6 shadow-sm shadow-slate-200/50 transition hover:border-indigo-300 dark:border-slate-800 dark:bg-slate-900/70 dark:shadow-none"
          >
            <p className="text-xs uppercase tracking-[0.45em] text-slate-500 dark:text-slate-400">{feature.title}</p>
            <p className="text-base text-slate-700 dark:text-slate-200">{feature.detail}</p>
          </article>
        ))}
      </div>
    </div>
  </section>
);

import { workflowSteps } from './data';

export const WorkflowSection = () => (
  <section id="workflow" className="bg-white py-20 dark:bg-slate-950">
    <div className="mx-auto max-w-8xl px-4 sm:px-6 lg:px-8">
      <div className="flex flex-col gap-3 text-center">
        <p className="text-xs uppercase tracking-[0.5em] text-indigo-500">How it works</p>
        <h2 className="text-3xl font-semibold text-slate-900 dark:text-white sm:text-4xl">
          Structured workflows, human oversight.
        </h2>
        <p className="text-lg text-slate-600 dark:text-slate-300">
          Every step is measurable, auditable, and ready to share with regulators. Keep rules in front of your team and shift
          delivery in the driver’s seat.
        </p>
      </div>
      <div className="mt-12 grid gap-6 md:grid-cols-2">
        {workflowSteps.map((step, idx) => (
          <article
            key={step.title}
            className="h-full rounded-3xl border border-slate-200 bg-slate-50/80 p-6 dark:border-slate-800 dark:bg-slate-900/60"
          >
            <div className="flex items-center gap-3">
              <span className="text-sm font-mono text-indigo-500">{String(idx + 1).padStart(2, '0')}</span>
              <h3 className="text-xl font-semibold text-slate-900 dark:text-white">{step.title}</h3>
            </div>
            <p className="mt-4 text-base leading-relaxed text-slate-600 dark:text-slate-300">{step.body}</p>
          </article>
        ))}
      </div>
    </div>
  </section>
);

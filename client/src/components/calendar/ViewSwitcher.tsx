interface ViewSwitcherProps {
  value: 'day' | 'week' | 'month';
  onChange: (value: 'day' | 'week' | 'month') => void;
}

const MODE_LABELS: Record<'day' | 'week' | 'month', string> = {
  day: 'Day',
  week: 'Week',
  month: 'Month',
};

export const ViewSwitcher = ({ value, onChange }: ViewSwitcherProps) => (
  <div className="flex items-center gap-2 rounded-2xl border border-white/20 bg-slate-900/40 p-1 text-xs font-semibold uppercase tracking-[0.4em] text-slate-500">
    {(['day', 'week', 'month'] as const).map((mode) => (
      <button
        key={mode}
        type="button"
        onClick={() => onChange(mode)}
        className={`flex-1 rounded-2xl px-3 py-1 transition ${
          value === mode
            ? 'bg-gradient-to-r from-brand-500 to-brand-700 text-white shadow-[0_5px_20px_rgba(59,130,246,0.35)]'
            : 'hover:bg-white/10'
        }`}
      >
        {MODE_LABELS[mode]}
      </button>
    ))}
  </div>
);

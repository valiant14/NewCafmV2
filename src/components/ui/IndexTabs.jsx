import { cn } from '../../lib/cn'

export default function IndexTabs({ tabs, active, onChange }) {
  return (
    <div className="mb-4 flex gap-1 overflow-auto rounded-2xl border border-[var(--app-line)] bg-[color:color-mix(in_srgb,var(--app-panel)_78%,var(--app-soft-bg))] p-1 shadow-[0_8px_24px_rgba(15,23,42,.04)]">
      {tabs.map(tab => (
        <button
          key={tab.key}
          className={cn(
            'inline-flex items-center gap-2 whitespace-nowrap rounded-xl px-3 py-2.5 text-[11px] font-bold text-[var(--app-muted)] transition',
            active === tab.key ? 'bg-[var(--app-panel)] text-[var(--app-primary)] shadow-[0_8px_18px_rgba(15,23,42,.06)]' : 'hover:bg-[var(--app-soft-bg-hover)] hover:text-[var(--app-ink)]'
          )}
          onClick={() => onChange?.(tab.key)}
        >
          {tab.label}
          <b className="rounded-full bg-[var(--app-soft-bg)] px-2 py-0.5 text-[8px] text-[var(--app-muted)]">{tab.count}</b>
        </button>
      ))}
    </div>
  )
}

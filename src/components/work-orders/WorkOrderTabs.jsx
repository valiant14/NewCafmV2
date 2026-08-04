import { cn } from '../../lib/cn'

// Uses the shared detail-tab classes rather than a second set of its own, so these tabs and the
// ones on every detail page stay the same size and shape. Sizing lives in `.app-detail-tab`.
export default function WorkOrderTabs({ tabs, active, onChange, alertTabs = [] }) {
  const alerts = new Set(alertTabs)

  return (
    <nav className="app-detail-tabs" role="tablist">
      {tabs.map(name => (
        <button
          key={name}
          type="button"
          onClick={() => onChange(name)}
          className={cn('app-detail-tab', active === name && 'app-detail-tab--active')}
          role="tab"
          aria-selected={active === name}
        >
          {name}
          {alerts.has(name) && <i className="absolute right-2 top-2 h-1.5 w-1.5 rounded-full bg-[var(--orange)]" />}
        </button>
      ))}
    </nav>
  )
}

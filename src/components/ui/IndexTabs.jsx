import { cn } from '../../lib/cn'

export default function IndexTabs({ tabs, active, onChange }) {
  return (
    <div className="app-index-tabs" role="tablist">
      {tabs.map(tab => (
        <button
          key={tab.key}
          className={cn(
            'app-index-tab',
            active === tab.key && 'app-index-tab--active'
          )}
          onClick={() => onChange?.(tab.key)}
          role="tab"
          aria-selected={active === tab.key}
        >
          {tab.label}
          <b className="app-index-tab-count">{tab.count}</b>
        </button>
      ))}
    </div>
  )
}

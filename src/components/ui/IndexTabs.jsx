import { cn } from '../../lib/cn'

// `search` renders on the same row as the tabs. Every list page with a search passes it here
// rather than positioning one itself, so the layout is decided in a single place.
export default function IndexTabs({ tabs, active, onChange, search }) {
  const tabList = (
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

  if (!search) return tabList

  return (
    <div className="app-list-controls">
      {tabList}
      {search}
    </div>
  )
}

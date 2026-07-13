export default function IndexTabs({ tabs, active, onChange }) {
  return (
    <div className="sub-tabs">
      {tabs.map(tab => (
        <button
          key={tab.key}
          className={active === tab.key ? 'active' : ''}
          onClick={() => onChange?.(tab.key)}
        >
          {tab.label} <b>{tab.count}</b>
        </button>
      ))}
    </div>
  )
}

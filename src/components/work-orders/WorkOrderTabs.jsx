const tabsClass = 'flex overflow-auto border-b border-[var(--app-line)] bg-transparent'
const tabClass = active => [
  'relative flex items-center gap-1.5 whitespace-nowrap px-3 py-3 text-[length:var(--app-tab-font-size)] text-[var(--app-muted)] transition hover:text-[var(--app-primary)]',
  active ? 'font-bold text-[var(--app-ink)] after:absolute after:bottom-0 after:left-2.5 after:right-2.5 after:h-0.5 after:bg-[var(--app-primary)]' : ''
].join(' ')
const indexClass = 'text-[length:var(--app-tab-index-font-size)] font-bold text-[var(--app-muted)]'

export default function WorkOrderTabs({ tabs, active, onChange, showFailureDot }) {
  return (
    <div className={tabsClass}>
      {tabs.map((name, index) => (
        <button key={name} className={tabClass(active === name)} onClick={() => onChange(name)}>
          <small className={indexClass}>{String(index + 1).padStart(2, '0')}</small>
          {name}
          {name === 'Failure' && showFailureDot && <i className="absolute right-2 top-2 h-1.5 w-1.5 rounded-full bg-[var(--orange)]" />}
        </button>
      ))}
    </div>
  )
}

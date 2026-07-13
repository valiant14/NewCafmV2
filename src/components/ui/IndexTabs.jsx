import { cn } from '../../lib/cn'

export default function IndexTabs({ tabs, active, onChange }) {
  return (
    <div className="mb-4 -mt-2 flex gap-1 overflow-auto border-b border-[var(--app-line)]">
      {tabs.map(tab => (
        <button
          key={tab.key}
          className={cn(
            'relative inline-flex items-center gap-2 whitespace-nowrap px-3 py-3 text-[11px] text-[#7a847e] transition',
            active === tab.key && 'font-bold text-[#315a47] after:absolute after:bottom-[-1px] after:left-2 after:right-2 after:h-0.5 after:bg-[#477e63]'
          )}
          onClick={() => onChange?.(tab.key)}
        >
          {tab.label}
          <b className="rounded-full bg-[#e9eee9] px-2 py-0.5 text-[8px] text-[#526159]">{tab.count}</b>
        </button>
      ))}
    </div>
  )
}

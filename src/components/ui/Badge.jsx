import { cn } from '../../lib/cn'

const tones = {
  neutral: 'bg-[var(--app-badge-neutral-bg)] text-[var(--app-badge-neutral-text)]',
  green: 'bg-[var(--app-badge-green-bg)] text-[var(--app-badge-green-text)]',
  orange: 'bg-[var(--app-badge-orange-bg)] text-[var(--app-badge-orange-text)]',
  blue: 'bg-[var(--app-badge-blue-bg)] text-[var(--app-badge-blue-text)]',
  purple: 'bg-[var(--app-badge-purple-bg)] text-[var(--app-badge-purple-text)]',
  red: 'bg-[var(--danger-soft)] text-[var(--danger)]'
}

export default function Badge({ children, tone = 'neutral', className, dot = true, title }) {
  return (
    <span title={title} className={cn('inline-flex min-h-6 w-max items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-1 text-[10px] font-bold leading-none', tones[tone] || tones.neutral, className)}>
      {dot && <i aria-hidden="true" className="h-1.5 w-1.5 shrink-0 rounded-full bg-current" />}
      {children}
    </span>
  )
}

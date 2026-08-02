import { cn } from '../../lib/cn'

const tones = {
  neutral: 'bg-[var(--app-badge-neutral-bg)] text-[var(--app-badge-neutral-text)]',
  green: 'bg-[var(--app-badge-green-bg)] text-[var(--app-badge-green-text)]',
  orange: 'bg-[var(--app-badge-orange-bg)] text-[var(--app-badge-orange-text)]',
  blue: 'bg-[var(--app-badge-blue-bg)] text-[var(--app-badge-blue-text)]',
  purple: 'bg-[var(--app-badge-purple-bg)] text-[var(--app-badge-purple-text)]'
}

export default function Badge({ children, tone = 'neutral' }) {
  return (
    <span className={cn('inline-flex w-max items-center gap-1.5 whitespace-nowrap rounded-full px-2 py-1 text-[10px] font-bold tracking-[.01em]', tones[tone] || tones.neutral)}>
      <i className="h-1.5 w-1.5 rounded-full bg-current" />
      {children}
    </span>
  )
}

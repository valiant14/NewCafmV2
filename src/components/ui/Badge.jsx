import { cn } from '../../lib/cn'

const tones = {
  neutral: 'bg-[#f0f2ef] text-[#64706a]',
  green: 'bg-[#e8f3ea] text-[#39805c]',
  orange: 'bg-[#fff0e6] text-[#bb6738]',
  blue: 'bg-[#eaf2f5] text-[#477a8d]',
  purple: 'bg-[#f0ebfa] text-[#755b9f]'
}

export default function Badge({ children, tone = 'neutral' }) {
  return (
    <span className={cn('inline-flex w-max items-center gap-1.5 whitespace-nowrap rounded-full px-2 py-1 text-[10px] font-bold tracking-[.01em]', tones[tone] || tones.neutral)}>
      <i className="h-1.5 w-1.5 rounded-full bg-current" />
      {children}
    </span>
  )
}

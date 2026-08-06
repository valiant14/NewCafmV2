import { ChevronRight } from 'lucide-react'
import { cn } from '../../lib/cn'

export default function StatCard({ icon: Icon, label, value, detail, tone = 'neutral', onClick, className }) {
  const Component = onClick ? 'button' : 'article'

  return (
    <Component
      type={onClick ? 'button' : undefined}
      onClick={onClick}
      className={cn('app-stat-card', `app-stat-card--${tone}`, onClick && 'app-stat-card--interactive', className)}
      aria-label={onClick ? `View ${label}` : undefined}
    >
      <span className="app-stat-icon">
        {Icon && <Icon size={18} />}
      </span>
      <span className="min-w-0 flex-1 text-left">
        <span className="app-stat-label">{label}</span>
        <strong className="app-stat-value">{value}</strong>
        {detail && <span className="app-stat-detail">{detail}</span>}
      </span>
      {onClick && <ChevronRight className="app-stat-chevron" size={17} />}
    </Component>
  )
}

import { AlertCircle, CheckCircle2, Info, TriangleAlert } from 'lucide-react'
import { cn } from '../../lib/cn'

const icons = {
  danger: AlertCircle,
  info: Info,
  success: CheckCircle2,
  warning: TriangleAlert
}

export default function Alert({ tone = 'info', title, children, actions, icon: CustomIcon, className }) {
  const Icon = CustomIcon || icons[tone] || Info

  return (
    <div className={cn('app-alert', `app-alert--${tone}`, className)} role={tone === 'danger' ? 'alert' : 'status'}>
      <Icon className="app-alert-icon" size={18} />
      <div className="min-w-0 flex-1">
        {title && <strong className="app-alert-title">{title}</strong>}
        {children && <div className="app-alert-body">{children}</div>}
      </div>
      {actions && <div className="app-alert-actions">{actions}</div>}
    </div>
  )
}

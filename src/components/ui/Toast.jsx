import { AlertCircle, CheckCircle2, Info, X } from 'lucide-react'
import { cn } from '../../lib/cn'

const icons = { error: AlertCircle, success: CheckCircle2, info: Info }
const labels = { error: 'Action failed', success: 'Saved', info: 'Notice' }

export default function Toast({ message, tone = 'info', onDismiss }) {
  if (!message) return null
  const Icon = icons[tone] || Info

  return (
    <div className={cn('app-toast', `app-toast--${tone}`)} role={tone === 'error' ? 'alert' : 'status'} aria-live="polite">
      <Icon className="app-toast-icon" size={19} />
      <div className="min-w-0 flex-1">
        <strong className="app-toast-title">{labels[tone] || labels.info}</strong>
        <p className="app-toast-message">{message}</p>
      </div>
      <button type="button" className="app-icon-button" onClick={onDismiss} aria-label="Dismiss notification">
        <X size={16} />
      </button>
    </div>
  )
}

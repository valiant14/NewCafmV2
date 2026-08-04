import { X } from 'lucide-react'
import { cn } from '../../lib/cn'

export function ModalOverlay({ children, className }) {
  return (
    <div className={cn('app-modal-overlay', className)}>
      {children}
    </div>
  )
}

export function ModalPanel({ children, className, labelledBy }) {
  return (
    <section
      className={cn('app-modal-panel', className)}
      aria-modal="true"
      role="dialog"
      aria-labelledby={labelledBy}
    >
      {children}
    </section>
  )
}

export function ModalHeader({ eyebrow, title, description, onClose, titleId, children, className }) {
  return (
    <header className={cn('app-modal-header', className)}>
      <div className="min-w-0">
        {eyebrow && <span className="app-eyebrow">{eyebrow}</span>}
        {title && <h2 className="app-modal-title" id={titleId}>{title}</h2>}
        {description && <p className="app-modal-description">{description}</p>}
        {children}
      </div>
      {onClose && (
        <button className="app-modal-close" type="button" onClick={onClose} aria-label="Close">
          <X size={18} />
        </button>
      )}
    </header>
  )
}

export function ModalFooter({ children, className }) {
  return (
    <footer className={cn('app-modal-footer', className)}>
      {children}
    </footer>
  )
}

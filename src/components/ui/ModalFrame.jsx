import { X } from 'lucide-react'
import { cn } from '../../lib/cn'

export function ModalOverlay({ children, className }) {
  return (
    <div className={cn('fixed inset-0 z-50 flex items-end justify-center overflow-auto bg-[color:color-mix(in_srgb,var(--app-sidebar-bg)_72%,transparent)] p-3 backdrop-blur-sm sm:items-center sm:p-6', className)}>
      {children}
    </div>
  )
}

export function ModalPanel({ children, className, labelledBy }) {
  return (
    <section
      className={cn('flex max-h-[92vh] w-full flex-col overflow-hidden rounded-3xl border border-[var(--app-line)] bg-[var(--app-panel)] shadow-[0_28px_80px_rgba(15,23,42,.28)] sm:max-h-[88vh]', className)}
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
    <header className={cn('flex items-start justify-between gap-4 border-b border-[var(--app-line)] bg-[color:color-mix(in_srgb,var(--app-panel)_88%,var(--app-soft-bg))] px-4 py-4 sm:px-6 sm:py-5', className)}>
      <div className="min-w-0">
        {eyebrow && <span className="text-[length:var(--app-page-eyebrow-font-size)] font-extrabold uppercase tracking-[.18em] text-[var(--app-muted)]">{eyebrow}</span>}
        {title && <h2 className="mt-1 text-xl font-extrabold text-[var(--app-ink)] sm:text-2xl" id={titleId}>{title}</h2>}
        {description && <p className="mt-1 text-[length:var(--app-page-description-font-size)] text-[var(--app-muted)]">{description}</p>}
        {children}
      </div>
      {onClose && (
        <button className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-[var(--app-line)] bg-[var(--app-panel)] text-[var(--app-muted)] transition hover:bg-[var(--app-table-hover-bg)] hover:text-[var(--app-ink)]" type="button" onClick={onClose} aria-label="Close">
          <X size={18} />
        </button>
      )}
    </header>
  )
}

export function ModalFooter({ children, className }) {
  return (
    <footer className={cn('sticky bottom-0 flex flex-col-reverse gap-2 border-t border-[var(--app-line)] bg-[color:color-mix(in_srgb,var(--app-panel)_92%,var(--app-soft-bg))] px-4 py-4 sm:flex-row sm:items-center sm:justify-end sm:px-6', className)}>
      {children}
    </footer>
  )
}

import { cn } from '../../lib/cn'

// `icon` is optional and marks the section in its header, so a form can be read at a glance
// without each page building its own heading row.
export default function Section({ title, note, icon: Icon, children, compact = false, className = '' }) {
  return (
    <section className={cn(
      'app-surface',
      compact && 'app-section--compact',
      className
    )}>
      {(title || note) && (
        <header className="app-section-header">
          {Icon && <Icon size={16} className="app-section-icon" />}
          <div>
            {title && <h3 className="app-section-title">{title}</h3>}
            {note && <p className="app-section-note">{note}</p>}
          </div>
        </header>
      )}
      {children}
    </section>
  )
}

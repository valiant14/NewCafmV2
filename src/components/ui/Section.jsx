import { cn } from '../../lib/cn'

export default function Section({ title, note, children, compact = false, className = '' }) {
  return (
    <section className={cn(
      'app-surface',
      compact && 'app-section--compact',
      className
    )}>
      {(title || note) && (
        <header className="app-section-header">
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

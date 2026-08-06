import { cn } from '../../lib/cn'

// `icon` is optional and marks the section in its header, so a form can be read at a glance
// without each page building its own heading row. `tone` picks the accent for that header -
// green, orange, purple, blue or neutral, all from the badge palette - and defaults to the brand
// colour, so a page never names a colour of its own.
export default function Section({ title, note, icon: Icon, tone, children, compact = false, className = '' }) {
  return (
    <section className={cn(
      'app-surface app-section',
      compact && 'app-section--compact',
      tone && `app-section--${tone}`,
      className
    )}>
      {(title || note) && (
        <header className="app-section-header">
          {Icon && <span className="app-section-icon"><Icon size={15} /></span>}
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

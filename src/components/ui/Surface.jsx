import { cn } from '../../lib/cn'

const elementFor = {
  section: 'section',
  article: 'article',
  aside: 'aside',
  div: 'div'
}

// `tone` opts a surface into the same accent treatment as Section and InfoCard - stripe, tinted
// border, tinted header band and table headings - using the badge palette names.
export default function Surface({
  as = 'section',
  children,
  className,
  flush = false,
  interactive = false,
  subtle = false,
  tone
}) {
  const Component = elementFor[as] || 'section'

  return (
    <Component
      className={cn(
        'app-surface',
        flush && 'app-surface--flush',
        subtle && 'app-surface--subtle',
        interactive && 'app-surface--interactive',
        tone && `app-section app-section--${tone}`,
        className
      )}
    >
      {children}
    </Component>
  )
}

export function SurfaceHeader({ eyebrow, title, description, actions, inset = false, className }) {
  return (
    <header className={cn('app-surface-header', inset && 'app-surface-header--inset', className)}>
      <div className="min-w-0">
        {eyebrow && <p className="app-eyebrow">{eyebrow}</p>}
        {title && <h2 className="app-surface-title">{title}</h2>}
        {description && <p className="app-surface-description">{description}</p>}
      </div>
      {actions && <div className="app-surface-actions">{actions}</div>}
    </header>
  )
}

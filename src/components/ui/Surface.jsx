import { cn } from '../../lib/cn'

const elementFor = {
  section: 'section',
  article: 'article',
  aside: 'aside',
  div: 'div'
}

export default function Surface({
  as = 'section',
  children,
  className,
  flush = false,
  interactive = false,
  subtle = false
}) {
  const Component = elementFor[as] || 'section'

  return (
    <Component
      className={cn(
        'app-surface',
        flush && 'app-surface--flush',
        subtle && 'app-surface--subtle',
        interactive && 'app-surface--interactive',
        className
      )}
    >
      {children}
    </Component>
  )
}

export function SurfaceHeader({ eyebrow, title, description, actions, className }) {
  return (
    <header className={cn('app-surface-header', className)}>
      <div className="min-w-0">
        {eyebrow && <p className="app-eyebrow">{eyebrow}</p>}
        {title && <h2 className="app-surface-title">{title}</h2>}
        {description && <p className="app-surface-description">{description}</p>}
      </div>
      {actions && <div className="app-surface-actions">{actions}</div>}
    </header>
  )
}

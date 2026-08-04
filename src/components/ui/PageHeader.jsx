import Button from './Button'
import { cn } from '../../lib/cn'

export default function PageHeader({ eyebrow, title, description, actions, actionLabel, actionIcon, onAction, className = 'page-heading' }) {
  const ActionIcon = actionIcon

  return (
    <header className={cn('app-page-header', className)}>
      <div className="app-page-header-copy">
        {eyebrow && <p className="app-eyebrow">{eyebrow}</p>}
        <h1 className="app-page-title">{title}</h1>
        {description && <p className="app-page-description">{description}</p>}
      </div>

      {(actions || actionLabel) && (
        <div className="app-page-actions">
          {actions || (
            <Button onClick={onAction}>
              {ActionIcon && <ActionIcon size={17} />}
              {actionLabel}
            </Button>
          )}
        </div>
      )}
    </header>
  )
}

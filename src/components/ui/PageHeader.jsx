import Button from './Button'
import { cn } from '../../lib/cn'

export default function PageHeader({ eyebrow, title, description, actions, actionLabel, actionIcon, onAction, className = 'page-heading' }) {
  const ActionIcon = actionIcon

  return (
    <section className={cn('mb-7 flex items-center justify-between gap-5', className)}>
      <div className="min-w-0">
        {eyebrow && <p className="mb-2 text-[length:var(--app-page-eyebrow-font-size)] font-extrabold uppercase tracking-[0.18em] text-[var(--app-muted)]">{eyebrow}</p>}
        <h1 className="font-heading text-[length:var(--app-page-title-font-size)] font-extrabold leading-[1.12] tracking-[-0.04em] text-[var(--app-ink)]">{title}</h1>
        {description && <p className="mt-1 max-w-3xl text-[length:var(--app-page-description-font-size)] text-[var(--app-muted)]">{description}</p>}
      </div>

      {actions || (actionLabel && (
        <Button onClick={onAction}>
          {ActionIcon && <ActionIcon size={17} />}
          {actionLabel}
        </Button>
      ))}
    </section>
  )
}

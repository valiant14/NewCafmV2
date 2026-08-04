import Button from './Button'
import { cn } from '../../lib/cn'

export default function PageHeader({ eyebrow, title, description, actions, actionLabel, actionIcon, onAction, className = 'page-heading' }) {
  const ActionIcon = actionIcon

  return (
    <section className={cn('mb-6 flex flex-col gap-4 rounded-3xl border border-[var(--app-line)] bg-[color:color-mix(in_srgb,var(--app-panel)_86%,var(--app-soft-bg))] p-4 shadow-[0_14px_38px_rgba(15,23,42,.06)] sm:p-5 lg:flex-row lg:items-center lg:justify-between', className)}>
      <div className="min-w-0">
        {eyebrow && <p className="mb-2 text-[length:var(--app-page-eyebrow-font-size)] font-extrabold uppercase tracking-[0.18em] text-[var(--app-muted)]">{eyebrow}</p>}
        <h1 className="font-heading text-[clamp(1.75rem,4vw,var(--app-page-title-font-size))] font-extrabold leading-[1.08] text-[var(--app-ink)]">{title}</h1>
        {description && <p className="mt-1 max-w-3xl text-[length:var(--app-page-description-font-size)] text-[var(--app-muted)]">{description}</p>}
      </div>

      {(actions || actionLabel) && (
        <div className="flex w-full flex-wrap items-center gap-2 lg:w-auto lg:justify-end">
          {actions || (
            <Button onClick={onAction}>
              {ActionIcon && <ActionIcon size={17} />}
              {actionLabel}
            </Button>
          )}
        </div>
      )}
    </section>
  )
}

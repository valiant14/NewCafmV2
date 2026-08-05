import { cn } from '../../lib/cn'

export default function ToggleField({ label, description, checked, onChange, disabled = false, className }) {
  return (
    <div className={cn('flex min-h-20 items-center justify-between gap-4 rounded-lg border border-[var(--app-line)] bg-[var(--app-panel)] p-4', className)}>
      <div className="min-w-0">
        <strong className="block text-sm text-[var(--app-ink)]">{label}</strong>
        {description && <p className="mt-1 text-xs leading-5 text-[var(--app-muted)]">{description}</p>}
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={label}
        disabled={disabled}
        onClick={() => onChange?.(!checked)}
        className={cn(
          'relative h-7 w-12 shrink-0 rounded-full border transition focus:outline-none focus:ring-4 focus:ring-[var(--app-field-focus-ring)] disabled:cursor-not-allowed disabled:opacity-50',
          checked
            ? 'border-[var(--app-primary)] bg-[var(--app-primary)]'
            : 'border-[var(--app-field-border)] bg-[var(--app-soft-bg)]'
        )}
      >
        <span className={cn(
          'absolute top-0.5 h-5 w-5 rounded-full bg-white shadow-sm transition-transform',
          checked ? 'translate-x-5' : 'translate-x-0.5'
        )} />
      </button>
    </div>
  )
}

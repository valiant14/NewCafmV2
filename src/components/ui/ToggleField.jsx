import { cn } from '../../lib/cn'

export default function ToggleField({ label, description, checked, onChange, disabled = false, className }) {
  return (
    <label className={cn(
      'flex min-h-20 items-center justify-between gap-4 rounded-lg border border-[var(--app-line)] bg-[var(--app-panel)] p-4 transition',
      disabled ? 'cursor-not-allowed opacity-60' : 'cursor-pointer hover:border-[var(--app-primary)] hover:bg-[var(--app-soft-bg)]',
      className
    )}>
      <div className="min-w-0">
        <strong className="block text-sm text-[var(--app-ink)]">{label}</strong>
        {description && <p className="mt-1 text-xs leading-5 text-[var(--app-muted)]">{description}</p>}
      </div>
      <span className="flex shrink-0 items-center gap-2">
        <span className="w-6 text-right text-[10px] font-bold uppercase text-[var(--app-muted)]">{checked ? 'On' : 'Off'}</span>
        <input
          type="checkbox"
          role="switch"
          className="peer sr-only"
          checked={Boolean(checked)}
          disabled={disabled}
          onChange={event => onChange?.(event.target.checked)}
          aria-label={label}
        />
        <span
          aria-hidden="true"
          className={cn(
            'relative h-7 w-12 rounded-full border transition-colors peer-focus-visible:ring-4 peer-focus-visible:ring-[var(--app-field-focus-ring)]',
            checked
              ? 'border-[var(--app-primary)] bg-[var(--app-primary)]'
              : 'border-[var(--app-field-border)] bg-[var(--app-soft-bg)]'
          )}
        >
          <span className={cn(
            'absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-white shadow-sm transition-transform',
            checked && 'translate-x-5'
          )} />
        </span>
      </span>
    </label>
  )
}

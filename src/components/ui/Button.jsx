import { cn } from '../../lib/cn'

const variants = {
  primary: 'border-transparent bg-[var(--app-primary)] text-white shadow-[0_10px_24px_color-mix(in_srgb,var(--app-primary)_24%,transparent)] hover:-translate-y-px hover:bg-[var(--app-primary-hover)] hover:shadow-[0_14px_28px_color-mix(in_srgb,var(--app-primary)_28%,transparent)]',
  outline: 'border-[var(--app-line)] bg-[color:color-mix(in_srgb,var(--app-panel)_92%,var(--app-soft-bg))] text-[var(--app-ink)] shadow-[0_6px_16px_rgba(15,23,42,.04)] hover:-translate-y-px hover:bg-[var(--app-panel)] hover:text-[var(--app-primary)]',
  ghost: 'border-transparent bg-transparent text-[var(--app-muted)] hover:bg-[var(--app-soft-bg-hover)] hover:text-[var(--app-ink)]'
}

export default function Button({ children, className, variant = 'primary', type = 'button', ...props }) {
  return (
    <button
      type={type}
      className={cn(
        'inline-flex min-h-10 items-center justify-center gap-2 rounded-xl border px-4 py-2 text-xs font-extrabold transition duration-200 active:translate-y-0 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:translate-y-0',
        variants[variant],
        className
      )}
      {...props}
    >
      {children}
    </button>
  )
}

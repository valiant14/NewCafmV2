import { cn } from '../../lib/cn'

const variants = {
  primary: 'border-transparent bg-[var(--app-primary)] text-white shadow-[0_8px_20px_color-mix(in_srgb,var(--app-primary)_22%,transparent)] hover:bg-[var(--app-primary-hover)]',
  outline: 'border-[var(--app-line)] bg-[var(--app-panel)] text-[var(--app-muted)] hover:bg-[var(--app-soft-bg-hover)] hover:text-[var(--app-ink)]',
  ghost: 'border-transparent bg-transparent text-[var(--app-muted)] hover:bg-[var(--app-soft-bg-hover)] hover:text-[var(--app-ink)]'
}

export default function Button({ children, className, variant = 'primary', type = 'button', ...props }) {
  return (
    <button
      type={type}
      className={cn(
        'inline-flex h-10 items-center justify-center gap-2 rounded-[10px] border px-4 text-xs font-bold transition disabled:cursor-not-allowed disabled:opacity-50',
        variants[variant],
        className
      )}
      {...props}
    >
      {children}
    </button>
  )
}

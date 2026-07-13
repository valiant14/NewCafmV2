import { cn } from '../../lib/cn'

const variants = {
  primary: 'border-transparent bg-[var(--app-primary)] text-white shadow-[0_8px_20px_rgba(49,90,71,.22)] hover:brightness-95',
  outline: 'border-[#dfe5df] bg-white text-[#57645d] hover:bg-[#f7faf7]',
  ghost: 'border-transparent bg-transparent text-[#65746c] hover:bg-[#edf3ef]'
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

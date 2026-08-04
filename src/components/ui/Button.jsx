import { cn } from '../../lib/cn'

const variants = { primary: 'app-button--primary', outline: 'app-button--outline', ghost: 'app-button--ghost', danger: 'app-button--danger' }

export default function Button({ children, className, variant = 'primary', type = 'button', ...props }) {
  return (
    <button
      type={type}
      className={cn(
        'app-button',
        variants[variant],
        className
      )}
      {...props}
    >
      {children}
    </button>
  )
}

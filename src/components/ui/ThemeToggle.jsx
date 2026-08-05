import { Moon, Sun } from 'lucide-react'
import { useTheme } from '../../providers/ThemeProvider'

export default function ThemeToggle({ className = '' }) {
  const { themeName, toggleTheme } = useTheme()
  const dark = themeName === 'dark'
  const label = dark ? 'Switch to light mode' : 'Switch to dark mode'
  const Icon = dark ? Sun : Moon

  return (
    <button
      type="button"
      className={`app-icon-button h-9 w-9 shrink-0 ${className}`}
      aria-label={label}
      title={label}
      aria-pressed={dark}
      onClick={toggleTheme}
    >
      <Icon size={18} aria-hidden="true" />
    </button>
  )
}

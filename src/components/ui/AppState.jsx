import { AlertTriangle, LoaderCircle } from 'lucide-react'
import Surface from './Surface'

export default function AppState({ eyebrow, title, description, tone = 'loading' }) {
  const Icon = tone === 'error' ? AlertTriangle : LoaderCircle

  return (
    <main className="app-state-page">
      <Surface className="app-state-card">
        <Icon className={tone === 'loading' ? 'animate-spin text-[var(--app-primary)]' : 'text-[var(--danger)]'} size={24} />
        <div>
          {eyebrow && <p className="app-eyebrow">{eyebrow}</p>}
          <h1 className="app-state-title">{title}</h1>
          {description && <p className="app-state-description">{description}</p>}
        </div>
      </Surface>
    </main>
  )
}

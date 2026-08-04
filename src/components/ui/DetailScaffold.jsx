import { ArrowLeft, Printer } from 'lucide-react'
import Badge from './Badge'
import Button from './Button'
import { cn } from '../../lib/cn'
import { printWithoutBrowserTitle } from '../../lib/print'

export function DetailHeader({ eyebrow, id, title, status, statusTone = 'green', onBack, backLabel = 'Back', printLabel = 'Print record', stats = [], actions }) {
  return (
    <header className="app-detail-header">
      <div className="app-detail-heading">
        <div className="min-w-0">
          <button className="app-detail-back" onClick={onBack}>
            <ArrowLeft size={14} />
            {backLabel}
          </button>
          <p className="app-eyebrow">{eyebrow}</p>
          <div className="app-detail-title-row">
            <h1 className="app-detail-title">{id}</h1>
            {status && <Badge tone={statusTone}>{status}</Badge>}
          </div>
          {title && <p className="app-page-description">{title}</p>}
        </div>
        <div className="app-page-actions">
          {actions}
          <Button variant="outline" onClick={() => printWithoutBrowserTitle()}>
            <Printer size={15} />
            {printLabel}
          </Button>
        </div>
      </div>
      {stats.length > 0 && (
        <div className="app-detail-stats">
          {stats.map(stat => (
            <div key={stat.label} className="app-detail-stat">
              <span className="app-stat-label">{stat.label}</span>
              <strong>{stat.value || '-'}</strong>
              {stat.note && <small>{stat.note}</small>}
            </div>
          ))}
        </div>
      )}
    </header>
  )
}

export function ProfileStrip({ icon: Icon, tone = 'default', eyebrow, title, description, stats = [] }) {
  const iconTone = {
    default: 'bg-[var(--app-badge-green-bg)] text-[var(--app-badge-green-text)]',
    orange: 'bg-[var(--app-badge-orange-bg)] text-[var(--app-badge-orange-text)]',
    blue: 'bg-[var(--app-badge-blue-bg)] text-[var(--app-badge-blue-text)]'
  }[tone] || 'bg-[var(--app-badge-green-bg)] text-[var(--app-badge-green-text)]'

  return (
    <section className="app-profile-strip">
      <div className={cn('app-profile-icon', iconTone)}>{Icon ? <Icon size={24} /> : null}</div>
      <div className="min-w-0">
        <span className="app-eyebrow">{eyebrow}</span>
        <strong className="app-profile-title">{title}</strong>
        <p className="app-profile-description">{description}</p>
      </div>
      {stats.map(stat => (
        <div key={stat.label} className="app-profile-stat">
          <span className="app-stat-label">{stat.label}</span>
          <strong>{stat.value || '-'}</strong>
        </div>
      ))}
    </section>
  )
}

export function DetailTabs({ tabs = ['Details'], active = tabs[0], onChange }) {
  return (
    <nav className="app-detail-tabs" role="tablist">
      {tabs.map(tab => (
        <button
          key={tab}
          type="button"
          onClick={() => onChange?.(tab)}
          className={cn('app-detail-tab', active === tab && 'app-detail-tab--active')}
          role="tab"
          aria-selected={active === tab}
        >
          {tab}
        </button>
      ))}
    </nav>
  )
}

export function FocusCard({ icon: Icon, eyebrow, title, description, progress = 100, warning = false, metrics = [] }) {
  return (
    <section className="app-surface lg:col-span-2">
      <div className="flex items-start justify-between gap-4">
        <div>
          <span className="app-eyebrow">{eyebrow}</span>
          <h2 className="mt-1 text-xl font-bold text-[var(--app-ink)]">{title}</h2>
          <p className="app-page-description">{description}</p>
        </div>
        {Icon && <Icon className={warning ? 'text-[var(--warning)]' : 'text-[var(--success)]'} size={28} />}
      </div>
      <div className="mt-5 h-2 overflow-hidden rounded-full bg-[var(--app-soft-bg)]">
        <span className={cn('block h-full rounded-full', warning ? 'bg-[var(--warning)]' : 'bg-[var(--success)]')} style={{ width: `${progress}%` }} />
      </div>
      <div className="mt-5 grid gap-3 md:grid-cols-3">
        {metrics.map(metric => <MetricCard key={metric.label} {...metric} />)}
      </div>
    </section>
  )
}

export function MetricCard({ icon: Icon, label, value, note }) {
  return (
    <article className="app-metric-card">
      <div className="flex items-start gap-3">
        {Icon && <Icon className="mt-0.5 text-[var(--app-muted)]" size={17} />}
        <div>
          <span className="app-stat-label">{label}</span>
          <strong>{value || '-'}</strong>
          {note && <small>{note}</small>}
        </div>
      </div>
    </article>
  )
}

export function InfoCard({ icon: Icon, kicker, title, items = [], wide = false }) {
  return (
    <section className={cn('app-surface', wide && 'lg:col-span-2')}>
      <header className="app-info-card-header">
        {Icon && <Icon className="text-[var(--app-muted)]" size={18} />}
        <div>
          <span className="app-eyebrow">{kicker}</span>
          <h2>{title}</h2>
        </div>
      </header>
      <dl className="grid gap-3 sm:grid-cols-2">
        {items.map(([label, value]) => (
          <div key={label} className="app-info-field">
            <dt className="app-stat-label">{label}</dt>
            <dd>{value || '-'}</dd>
          </div>
        ))}
      </dl>
    </section>
  )
}

export function TimelineCard({ icon: Icon, kicker, title, rows = [] }) {
  return (
    <section className="app-surface lg:col-span-2">
      <header className="app-info-card-header">
        {Icon && <Icon className="text-[var(--app-muted)]" size={18} />}
        <div>
          <span className="app-eyebrow">{kicker}</span>
          <h2>{title}</h2>
        </div>
      </header>
      <div className="grid gap-3">
        {rows.map(row => (
          <div key={row.text} className="app-timeline-row">
            {row.icon ? <row.icon className="text-[var(--success)]" size={15} /> : <span className="h-2 w-2 rounded-full bg-[var(--success)]" />}
            <span className="text-sm text-[var(--app-muted)]">{row.text}</span>
            <strong className="text-sm text-[var(--app-ink)]">{row.value || '-'}</strong>
          </div>
        ))}
      </div>
    </section>
  )
}

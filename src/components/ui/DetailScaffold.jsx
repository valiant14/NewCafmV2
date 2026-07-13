import { Printer } from 'lucide-react'
import Badge from './Badge'
import Button from './Button'
import { cn } from '../../lib/cn'

export function DetailHeader({ eyebrow, id, title, status, statusTone = 'green', onBack, backLabel = 'Back', printLabel = 'Print record' }) {
  return (
    <header className="rounded-3xl border border-[var(--app-line)] bg-white p-6 shadow-[0_14px_36px_rgba(32,55,45,.08)]">
      <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0">
          <button className="mb-4 inline-flex items-center text-xs font-bold text-[#577066] transition hover:text-[var(--app-primary)]" onClick={onBack}>
            ← {backLabel}
          </button>
          <p className="text-[9px] font-extrabold uppercase tracking-[.18em] text-[#7a8780]">{eyebrow}</p>
          <div className="mt-2 flex flex-wrap items-center gap-3">
            <h1 className="text-3xl font-extrabold leading-tight tracking-[-.045em] text-[var(--app-ink)]">{id}</h1>
            {status && <Badge tone={statusTone}>{status}</Badge>}
          </div>
          {title && <p className="mt-2 max-w-3xl text-sm text-[var(--app-muted)]">{title}</p>}
        </div>
        <Button variant="outline" onClick={() => window.print()}>
          <Printer size={15} />
          {printLabel}
        </Button>
      </div>
    </header>
  )
}

export function ProfileStrip({ icon: Icon, tone = 'default', eyebrow, title, description, stats = [] }) {
  const iconTone = {
    default: 'bg-[#edf4ef] text-[#315a47]',
    orange: 'bg-[#fff2e8] text-[#b96434]',
    blue: 'bg-[#eaf2ff] text-[#375f91]'
  }[tone] || 'bg-[#edf4ef] text-[#315a47]'

  return (
    <section className="grid gap-4 rounded-3xl border border-[var(--app-line)] bg-[#f8faf7] p-5 shadow-[0_8px_24px_rgba(32,55,45,.05)] md:grid-cols-[auto_1fr_repeat(2,minmax(150px,auto))] md:items-center">
      <div className={cn('flex h-14 w-14 items-center justify-center rounded-2xl', iconTone)}>
        {Icon ? <Icon size={25} /> : null}
      </div>
      <div className="min-w-0">
        <span className="text-[9px] font-extrabold uppercase tracking-[.16em] text-[#7b8780]">{eyebrow}</span>
        <strong className="mt-1 block text-lg font-extrabold text-[var(--app-ink)]">{title}</strong>
        <p className="mt-1 text-sm text-[var(--app-muted)]">{description}</p>
      </div>
      {stats.map(stat => (
        <div key={stat.label} className="rounded-2xl border border-[#e0e6df] bg-white p-4">
          <span className="text-[9px] font-extrabold uppercase tracking-[.14em] text-[#7b8780]">{stat.label}</span>
          <strong className="mt-1 block text-base text-[var(--app-ink)]">{stat.value || '-'}</strong>
        </div>
      ))}
    </section>
  )
}

export function DetailTabs({ tabs = ['Details'] }) {
  return (
    <nav className="flex gap-1 border-b border-[var(--app-line)]">
      {tabs.map((tab, index) => (
        <button
          key={tab}
          className={cn(
            'relative px-3 py-3 text-[11px] text-[#7a847e]',
            index === 0 && 'font-bold text-[#315a47] after:absolute after:bottom-[-1px] after:left-2 after:right-2 after:h-0.5 after:bg-[#477e63]'
          )}
        >
          {tab}
        </button>
      ))}
    </nav>
  )
}

export function FocusCard({ icon: Icon, eyebrow, title, description, progress = 100, warning = false, metrics = [] }) {
  return (
    <section className="rounded-3xl border border-[var(--app-line)] bg-white p-5 shadow-[0_8px_24px_rgba(32,55,45,.06)] lg:col-span-2">
      <div className="flex items-start justify-between gap-4">
        <div>
          <span className="text-[9px] font-extrabold uppercase tracking-[.16em] text-[#7b8780]">{eyebrow}</span>
          <h2 className="mt-1 text-xl font-extrabold tracking-[-.03em] text-[var(--app-ink)]">{title}</h2>
          <p className="mt-1 text-sm text-[var(--app-muted)]">{description}</p>
        </div>
        {Icon && <Icon className={warning ? 'text-[#c06d3f]' : 'text-[#477e63]'} size={30} />}
      </div>
      <div className="mt-5 h-2 overflow-hidden rounded-full bg-[#eef2ed]">
        <span className={cn('block h-full rounded-full', warning ? 'bg-[#d8905d]' : 'bg-[#477e63]')} style={{ width: `${progress}%` }} />
      </div>
      <div className="mt-5 grid gap-3 md:grid-cols-3">
        {metrics.map(metric => (
          <MetricCard key={metric.label} {...metric} />
        ))}
      </div>
    </section>
  )
}

export function MetricCard({ icon: Icon, label, value, note }) {
  return (
    <article className="rounded-2xl border border-[#e2e8e1] bg-[#fbfcfa] p-4">
      <div className="flex items-start gap-3">
        {Icon && <Icon className="mt-0.5 text-[#6f8278]" size={17} />}
        <div>
          <span className="text-[9px] font-extrabold uppercase tracking-[.14em] text-[#7f8a84]">{label}</span>
          <strong className="mt-1 block text-lg text-[var(--app-ink)]">{value || '-'}</strong>
          <small className="mt-1 block text-[11px] text-[var(--app-muted)]">{note}</small>
        </div>
      </div>
    </article>
  )
}

export function InfoCard({ icon: Icon, kicker, title, items = [], wide = false }) {
  return (
    <section className={cn('rounded-3xl border border-[var(--app-line)] bg-white p-5 shadow-[0_8px_24px_rgba(32,55,45,.06)]', wide && 'lg:col-span-2')}>
      <header className="mb-4 flex items-center gap-3 border-b border-[#edf0ec] pb-4">
        {Icon && <Icon className="text-[#60766b]" size={18} />}
        <div>
          <span className="text-[9px] font-extrabold uppercase tracking-[.16em] text-[#7b8780]">{kicker}</span>
          <h2 className="text-base font-extrabold text-[var(--app-ink)]">{title}</h2>
        </div>
      </header>
      <dl className="grid gap-3 sm:grid-cols-2">
        {items.map(([label, value]) => (
          <div key={label} className="rounded-2xl bg-[#f8faf7] p-3">
            <dt className="text-[9px] font-extrabold uppercase tracking-[.12em] text-[#7b8780]">{label}</dt>
            <dd className="mt-1 text-sm font-bold text-[var(--app-ink)]">{value || '-'}</dd>
          </div>
        ))}
      </dl>
    </section>
  )
}

export function TimelineCard({ icon: Icon, kicker, title, rows = [] }) {
  return (
    <section className="rounded-3xl border border-[var(--app-line)] bg-white p-5 shadow-[0_8px_24px_rgba(32,55,45,.06)] lg:col-span-2">
      <header className="mb-4 flex items-center gap-3 border-b border-[#edf0ec] pb-4">
        {Icon && <Icon className="text-[#60766b]" size={18} />}
        <div>
          <span className="text-[9px] font-extrabold uppercase tracking-[.16em] text-[#7b8780]">{kicker}</span>
          <h2 className="text-base font-extrabold text-[var(--app-ink)]">{title}</h2>
        </div>
      </header>
      <div className="grid gap-3">
        {rows.map(row => (
          <div key={row.text} className="grid gap-3 rounded-2xl border border-[#e4ebe4] bg-[#fbfcfa] p-4 md:grid-cols-[auto_1fr_auto] md:items-center">
            {row.icon ? <row.icon className="text-[#477e63]" size={15} /> : <span className="h-2 w-2 rounded-full bg-[#477e63]" />}
            <span className="text-sm text-[#536059]">{row.text}</span>
            <strong className="text-sm text-[var(--app-ink)]">{row.value || '-'}</strong>
          </div>
        ))}
      </div>
    </section>
  )
}

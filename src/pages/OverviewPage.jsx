import { useState } from 'react'
import { AlertTriangle, Boxes, CalendarClock, ChevronRight, ClipboardList, Gauge, MoreHorizontal, Plus, ShieldCheck, Sparkles } from 'lucide-react'
import Badge from '../components/ui/Badge'
import Button from '../components/ui/Button'
import DataTable from '../components/ui/DataTable'
import ExcelImportButton from '../components/ui/ExcelImportButton'
import ImportNotice from '../components/ui/ImportNotice'
import { assets, excelDate, failureCodes, pmRecords, workOrders } from '../data/cafmData'

const iconTone = {
  orange: 'bg-[var(--app-badge-orange-bg)] text-[var(--app-badge-orange-text)]',
  green: 'bg-[var(--app-badge-green-bg)] text-[var(--app-badge-green-text)]',
  blue: 'bg-[var(--app-badge-blue-bg)] text-[var(--app-badge-blue-text)]',
  purple: 'bg-[var(--app-badge-purple-bg)] text-[var(--app-badge-purple-text)]'
}

const Metric = ({ label, value, detail, icon: Icon, tone }) => (
  <article className="group rounded-3xl border border-[var(--app-line)] bg-[var(--app-panel)] p-5 shadow-[0_8px_24px_rgba(32,55,45,.06)] transition hover:-translate-y-0.5 hover:shadow-[0_18px_36px_rgba(32,55,45,.1)]">
    <div className="flex items-start gap-4">
      <div className={`flex h-11 w-11 items-center justify-center rounded-2xl ${iconTone[tone]}`}>
        <Icon size={19} />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-[10px] font-extrabold uppercase tracking-[.12em] text-[var(--app-muted)]">{label}</p>
        <strong className="mt-1 block text-2xl font-extrabold tracking-[-.04em] text-[var(--app-ink)]">{value}</strong>
        <small className="mt-1 block text-xs text-[var(--app-muted)]">{detail}</small>
      </div>
      <button className="mt-1 text-[var(--app-muted)] transition group-hover:translate-x-0.5 group-hover:text-[var(--app-primary)]" aria-label={`View ${label}`}>
        <ChevronRight size={18} />
      </button>
    </div>
  </article>
)

const Donut = ({ value, label }) => (
  <div className="mx-auto grid h-44 w-44 place-items-center rounded-full" style={{ background: `conic-gradient(var(--app-primary) ${value * 3.6}deg, var(--app-soft-bg) 0deg)` }}>
    <div className="grid h-32 w-32 place-items-center rounded-full bg-[var(--app-panel)] text-center shadow-inner">
      <div>
        <strong className="block text-3xl font-extrabold text-[var(--app-ink)]">{value}%</strong>
        <span className="text-[10px] font-extrabold uppercase tracking-[.14em] text-[var(--app-muted)]">{label}</span>
      </div>
    </div>
  </div>
)

export default function OverviewPage({ onNavigate }) {
  const [imported, setImported] = useState('')
  const operating = assets.filter(asset => asset.status === 'OPERATING').length
  const now = Date.now()
  const openOrders = workOrders.filter(order => !['COMP', 'COMPLETED', 'CLOSE', 'CLOSED'].includes(String(order.STATUS || '').toUpperCase()))
  const overdueOrders = openOrders.filter(order => {
    const target = excelDate(order['TARGET FINISH '] || order['TARGET START '])
    const due = target && target !== '-' ? new Date(target).getTime() : null
    return due && due < now
  })
  const pmCount = workOrders.filter(order => String(order['WORK TYPE '] || '').trim() === 'PM').length
  const cmCount = workOrders.filter(order => String(order['WORK TYPE '] || '').trim() === 'CM').length
  const slaCompliance = workOrders.length ? Math.round(((workOrders.length - overdueOrders.length) / workOrders.length) * 100) : 100
  const siteCompliance = [...new Set(workOrders.map(order => order.SITE).filter(Boolean))].slice(0, 4).map(site => {
    const siteRows = workOrders.filter(order => order.SITE === site)
    const siteOverdue = overdueOrders.filter(order => order.SITE === site)
    return { site, value: siteRows.length ? Math.round(((siteRows.length - siteOverdue.length) / siteRows.length) * 100) : 100 }
  })

  return (
    <>
      <section className="mb-7 flex flex-col gap-5 rounded-3xl border border-[var(--app-line)] bg-[var(--app-panel)] p-6 shadow-[0_14px_36px_rgba(32,55,45,.08)] lg:flex-row lg:items-center lg:justify-between">
        <div>
          <Badge tone="green">Live workspace</Badge>
          <h1 className="mt-3 text-4xl font-extrabold tracking-[-.05em] text-[var(--app-ink)]">Good morning, Ahmed.</h1>
          <p className="mt-2 text-sm text-[var(--app-muted)]">Here is what needs attention across your facilities today.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <ExcelImportButton fileName={imported} onFile={setImported} label="Import Excel data" />
          <Button onClick={() => onNavigate('Work Orders')}><Plus size={17} /> New work order</Button>
        </div>
      </section>

      <ImportNotice fileName={imported} subject="workspace" onClear={() => setImported('')} />

      <section className="mb-7 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Metric label="Open work orders" value={workOrders.length} detail="All awaiting approval" icon={ClipboardList} tone="orange" />
        <Metric label="Assets online" value={`${operating}/${assets.length}`} detail="100% operational" icon={Boxes} tone="green" />
        <Metric label="PM programs" value={pmRecords.length} detail="Recurring schedules" icon={CalendarClock} tone="blue" />
        <Metric label="Failure codes" value={failureCodes.length.toLocaleString()} detail="Searchable library" icon={ShieldCheck} tone="purple" />
      </section>

      <section className="mb-7 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Metric label="SLA compliance" value={`${slaCompliance}%`} detail="Based on target finish/start dates" icon={Gauge} tone="green" />
        <Metric label="SLA violations" value={overdueOrders.length} detail="Open work orders past target" icon={AlertTriangle} tone="orange" />
        <Metric label="PM vs CM" value={`${pmCount}/${cmCount}`} detail="Preventive compared with corrective" icon={CalendarClock} tone="blue" />
        <Metric label="Open workload" value={openOrders.length} detail="Waiting, assigned, or in progress" icon={ClipboardList} tone="purple" />
      </section>

      <section className="mb-7 rounded-3xl border border-[var(--app-line)] bg-[var(--app-panel)] p-5 shadow-[0_8px_24px_rgba(32,55,45,.06)]">
        <header className="mb-4">
          <p className="text-[9px] font-extrabold uppercase tracking-[.16em] text-[var(--app-muted)]">SLA BY SITE</p>
          <h2 className="text-lg font-extrabold text-[var(--app-ink)]">Site-wise SLA compliance</h2>
        </header>
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          {siteCompliance.map(item => (
            <div className="rounded-2xl border border-[var(--app-line)] bg-[var(--app-soft-bg)] p-4" key={item.site}>
              <div className="mb-3 flex items-center justify-between text-sm"><strong>{item.site}</strong><span>{item.value}%</span></div>
              <div className="h-2 overflow-hidden rounded-full bg-[var(--app-table-hover-bg)]"><span className="block h-full rounded-full bg-[var(--app-primary)]" style={{ width: `${item.value}%` }} /></div>
            </div>
          ))}
        </div>
      </section>

      <section className="mb-7 grid gap-5 xl:grid-cols-[1fr_340px]">
        <article className="overflow-hidden rounded-3xl border border-[var(--app-line)] bg-[var(--app-panel)] shadow-[0_8px_24px_rgba(32,55,45,.06)]">
          <header className="flex items-center justify-between gap-4 border-b border-[var(--app-line)] px-5 py-4">
            <div>
              <p className="text-[9px] font-extrabold uppercase tracking-[.16em] text-[var(--app-muted)]">OPERATIONS</p>
              <h2 className="text-lg font-extrabold text-[var(--app-ink)]">Active work orders</h2>
            </div>
            <Button variant="ghost" onClick={() => onNavigate('Work Orders')}>View all <ChevronRight size={16} /></Button>
          </header>
          <DataTable
            rows={workOrders}
            search=""
            pageSize={5}
            showFooter={false}
            columns={[
              { key: 'WORKORDER', label: 'Order', render: value => <strong className="mono">#{value}</strong> },
              { key: 'DESCRIPITION', label: 'Description' },
              { key: 'LOCATION PRIORTY', label: 'Location', render: value => <Badge tone={value?.trim() === 'VIP' ? 'purple' : 'orange'}>{value}</Badge> },
              { key: 'STATUS', label: 'Status', render: value => <Badge tone="orange">{value}</Badge> },
              { key: 'TARGET START ', label: 'Target', render: excelDate }
            ]}
          />
        </article>

        <aside className="grid gap-5">
          <article className="rounded-3xl border border-[var(--app-line)] bg-[var(--app-panel)] p-5 shadow-[0_8px_24px_rgba(32,55,45,.06)]">
            <header className="mb-5 flex items-center justify-between gap-4">
              <div>
                <p className="text-[9px] font-extrabold uppercase tracking-[.16em] text-[var(--app-muted)]">PORTFOLIO</p>
                <h2 className="text-lg font-extrabold text-[var(--app-ink)]">Facility health</h2>
              </div>
              <MoreHorizontal className="text-[var(--app-muted)]" />
            </header>
            <Donut value={96} label="healthy" />
            <div className="mt-5 grid gap-3">
              <div className="flex items-center justify-between rounded-2xl bg-[var(--app-soft-bg)] p-3 text-sm"><span className="flex items-center gap-2 text-[var(--app-muted)]"><i className="h-2 w-2 rounded-full bg-[var(--success)]" />Operational</span><strong>{operating}</strong></div>
              <div className="flex items-center justify-between rounded-2xl bg-[var(--app-soft-bg)] p-3 text-sm"><span className="flex items-center gap-2 text-[var(--app-muted)]"><i className="h-2 w-2 rounded-full bg-[var(--warning)]" />Open orders</span><strong>{workOrders.length}</strong></div>
            </div>
          </article>

          <article className="flex gap-4 rounded-3xl border border-[var(--app-line)] bg-[var(--app-badge-green-bg)] p-5 text-[var(--app-badge-green-text)] shadow-[0_8px_24px_rgba(32,55,45,.05)]">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-[var(--app-panel)]"><Sparkles size={18} /></div>
            <div>
              <span className="text-[9px] font-extrabold uppercase tracking-[.16em]">SMART INSIGHT</span>
              <strong className="mt-1 block text-base">All current work orders are PM-related.</strong>
              <p className="mt-1 text-sm text-[var(--app-muted)]">Bundle technician visits by site to reduce travel time.</p>
            </div>
          </article>
        </aside>
      </section>

      <section className="rounded-3xl border border-[var(--app-line)] bg-[var(--app-panel)] p-5 shadow-[0_8px_24px_rgba(32,55,45,.06)]">
        <header className="mb-4 flex items-center justify-between gap-4">
          <div>
            <p className="text-[9px] font-extrabold uppercase tracking-[.16em] text-[var(--app-muted)]">MAINTENANCE</p>
            <h2 className="text-lg font-extrabold text-[var(--app-ink)]">Preventive maintenance</h2>
          </div>
          <Button variant="ghost" onClick={() => onNavigate('Preventive Maintenance')}>Open schedule <ChevronRight size={16} /></Button>
        </header>
        <div className="grid gap-3">
          {pmRecords.slice(0, 4).map((pm, index) => (
            <div className="grid gap-3 rounded-2xl border border-[var(--app-line)] bg-[var(--app-soft-bg)] p-4 md:grid-cols-[auto_1fr_auto] md:items-center" key={pm.PMNUM}>
              <div className="grid h-12 w-12 place-items-center rounded-2xl bg-[var(--app-badge-green-bg)] text-center">
                <span className="block text-lg font-extrabold leading-none text-[var(--app-badge-green-text)]">{String(index + 14).padStart(2, '0')}</span>
                <small className="text-[9px] font-extrabold text-[var(--app-muted)]">JUL</small>
              </div>
              <div>
                <strong className="block text-sm text-[var(--app-ink)]">{pm['PM DESCRIPTION']}</strong>
                <span className="text-xs text-[var(--app-muted)]">{pm.ASSETNUM} - {pm.FREQUENCY} {pm.FREQUNIT}</span>
              </div>
              <Badge tone={index === 0 ? 'orange' : 'blue'}>{index === 0 ? 'Due soon' : 'Scheduled'}</Badge>
            </div>
          ))}
        </div>
      </section>
    </>
  )
}

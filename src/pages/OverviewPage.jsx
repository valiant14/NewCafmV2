import { useState } from 'react'
import { Boxes, CalendarClock, ChevronRight, ClipboardList, MoreHorizontal, Plus, ShieldCheck, Sparkles } from 'lucide-react'
import Badge from '../components/ui/Badge'
import Button from '../components/ui/Button'
import DataTable from '../components/ui/DataTable'
import ExcelImportButton from '../components/ui/ExcelImportButton'
import ImportNotice from '../components/ui/ImportNotice'
import { assets, excelDate, failureCodes, pmRecords, workOrders } from '../data/cafmData'

const iconTone = {
  orange: 'bg-[#fff2e8] text-[#b96434]',
  green: 'bg-[#e7f5ed] text-[#477e63]',
  blue: 'bg-[#eaf2ff] text-[#375f91]',
  purple: 'bg-[#f1eafd] text-[#7252a5]'
}

const Metric = ({ label, value, detail, icon: Icon, tone }) => (
  <article className="group rounded-3xl border border-[var(--app-line)] bg-white p-5 shadow-[0_8px_24px_rgba(32,55,45,.06)] transition hover:-translate-y-0.5 hover:shadow-[0_18px_36px_rgba(32,55,45,.1)]">
    <div className="flex items-start gap-4">
      <div className={`flex h-11 w-11 items-center justify-center rounded-2xl ${iconTone[tone]}`}>
        <Icon size={19} />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-[10px] font-extrabold uppercase tracking-[.12em] text-[#7b8780]">{label}</p>
        <strong className="mt-1 block text-2xl font-extrabold tracking-[-.04em] text-[var(--app-ink)]">{value}</strong>
        <small className="mt-1 block text-xs text-[var(--app-muted)]">{detail}</small>
      </div>
      <button className="mt-1 text-[#9aa69f] transition group-hover:translate-x-0.5 group-hover:text-[var(--app-primary)]" aria-label={`View ${label}`}>
        <ChevronRight size={18} />
      </button>
    </div>
  </article>
)

const Donut = ({ value, label }) => (
  <div className="mx-auto grid h-44 w-44 place-items-center rounded-full" style={{ background: `conic-gradient(#477e63 ${value * 3.6}deg, #edf2ee 0deg)` }}>
    <div className="grid h-32 w-32 place-items-center rounded-full bg-white text-center shadow-inner">
      <div>
        <strong className="block text-3xl font-extrabold text-[var(--app-ink)]">{value}%</strong>
        <span className="text-[10px] font-extrabold uppercase tracking-[.14em] text-[#7b8780]">{label}</span>
      </div>
    </div>
  </div>
)

export default function OverviewPage({ onNavigate }) {
  const [imported, setImported] = useState('')
  const operating = assets.filter(asset => asset.status === 'OPERATING').length

  return (
    <>
      <section className="mb-7 flex flex-col gap-5 rounded-3xl border border-[var(--app-line)] bg-white p-6 shadow-[0_14px_36px_rgba(32,55,45,.08)] lg:flex-row lg:items-center lg:justify-between">
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

      <section className="mb-7 grid gap-5 xl:grid-cols-[1fr_340px]">
        <article className="overflow-hidden rounded-3xl border border-[var(--app-line)] bg-white shadow-[0_8px_24px_rgba(32,55,45,.06)]">
          <header className="flex items-center justify-between gap-4 border-b border-[var(--app-line)] px-5 py-4">
            <div>
              <p className="text-[9px] font-extrabold uppercase tracking-[.16em] text-[#7b8780]">OPERATIONS</p>
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
          <article className="rounded-3xl border border-[var(--app-line)] bg-white p-5 shadow-[0_8px_24px_rgba(32,55,45,.06)]">
            <header className="mb-5 flex items-center justify-between gap-4">
              <div>
                <p className="text-[9px] font-extrabold uppercase tracking-[.16em] text-[#7b8780]">PORTFOLIO</p>
                <h2 className="text-lg font-extrabold text-[var(--app-ink)]">Facility health</h2>
              </div>
              <MoreHorizontal className="text-[#9aa69f]" />
            </header>
            <Donut value={96} label="healthy" />
            <div className="mt-5 grid gap-3">
              <div className="flex items-center justify-between rounded-2xl bg-[#f8faf7] p-3 text-sm"><span className="flex items-center gap-2 text-[#5e6a64]"><i className="h-2 w-2 rounded-full bg-[#477e63]" />Operational</span><strong>{operating}</strong></div>
              <div className="flex items-center justify-between rounded-2xl bg-[#f8faf7] p-3 text-sm"><span className="flex items-center gap-2 text-[#5e6a64]"><i className="h-2 w-2 rounded-full bg-[#d8905d]" />Open orders</span><strong>{workOrders.length}</strong></div>
            </div>
          </article>

          <article className="flex gap-4 rounded-3xl border border-[#dbe8df] bg-[#eef7f1] p-5 text-[#315a47] shadow-[0_8px_24px_rgba(32,55,45,.05)]">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-white"><Sparkles size={18} /></div>
            <div>
              <span className="text-[9px] font-extrabold uppercase tracking-[.16em]">SMART INSIGHT</span>
              <strong className="mt-1 block text-base">All current work orders are PM-related.</strong>
              <p className="mt-1 text-sm text-[#617268]">Bundle technician visits by site to reduce travel time.</p>
            </div>
          </article>
        </aside>
      </section>

      <section className="rounded-3xl border border-[var(--app-line)] bg-white p-5 shadow-[0_8px_24px_rgba(32,55,45,.06)]">
        <header className="mb-4 flex items-center justify-between gap-4">
          <div>
            <p className="text-[9px] font-extrabold uppercase tracking-[.16em] text-[#7b8780]">MAINTENANCE</p>
            <h2 className="text-lg font-extrabold text-[var(--app-ink)]">Preventive maintenance</h2>
          </div>
          <Button variant="ghost" onClick={() => onNavigate('Preventive Maintenance')}>Open schedule <ChevronRight size={16} /></Button>
        </header>
        <div className="grid gap-3">
          {pmRecords.slice(0, 4).map((pm, index) => (
            <div className="grid gap-3 rounded-2xl border border-[#e6ece5] bg-[#fbfcfa] p-4 md:grid-cols-[auto_1fr_auto] md:items-center" key={pm.PMNUM}>
              <div className="grid h-12 w-12 place-items-center rounded-2xl bg-[#edf4ef] text-center">
                <span className="block text-lg font-extrabold leading-none text-[#315a47]">{String(index + 14).padStart(2, '0')}</span>
                <small className="text-[9px] font-extrabold text-[#7b8780]">JUL</small>
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

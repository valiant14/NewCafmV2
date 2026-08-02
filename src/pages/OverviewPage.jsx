import { useEffect, useState } from 'react'
import { Activity, AlertOctagon, AlertTriangle, Boxes, CalendarClock, CalendarRange, CheckCircle2, ChevronRight, ClipboardList, Droplets, FileCheck2, Gauge, MoreHorizontal, PackageCheck, Plus, Printer, ShieldCheck, ShoppingCart, Sparkles, Truck, Zap } from 'lucide-react'
import Badge from '../components/ui/Badge'
import Button from '../components/ui/Button'
import DataTable from '../components/ui/DataTable'
import LineChart from '../components/ui/LineChart'
import { excelDate, excelToDate } from '../config/runtimeDefaults'
import { pmDueLabel, pmDueTone } from '../lib/pmSchedule'
import { parseLocal } from '../lib/datetime'
import { effectiveTargetTime, isOnHold } from '../lib/holdPeriods'
import { statusDescription, statusTone } from '../lib/statusMatrix'
import { printWithoutBrowserTitle } from '../lib/print'

const iconTone = {
  orange: 'bg-[var(--app-badge-orange-bg)] text-[var(--app-badge-orange-text)]',
  green: 'bg-[var(--app-badge-green-bg)] text-[var(--app-badge-green-text)]',
  blue: 'bg-[var(--app-badge-blue-bg)] text-[var(--app-badge-blue-text)]',
  purple: 'bg-[var(--app-badge-purple-bg)] text-[var(--app-badge-purple-text)]'
}

const metricCardClass = 'group rounded-3xl border border-[var(--app-line)] bg-[var(--app-panel)] p-5 text-left shadow-[0_8px_24px_rgba(32,55,45,.06)] transition hover:-translate-y-0.5 hover:shadow-[0_18px_36px_rgba(32,55,45,.1)]'

const Metric = ({ label, value, detail, icon: Icon, tone, onClick }) => {
  const body = (
    <div className="flex items-start gap-4">
      <div className={`flex h-11 w-11 items-center justify-center rounded-2xl ${iconTone[tone]}`}>
        <Icon size={19} />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-[10px] font-extrabold uppercase tracking-[.12em] text-[var(--app-muted)]">{label}</p>
        <strong className="mt-1 block text-2xl font-extrabold tracking-[-.04em] text-[var(--app-ink)]">{value}</strong>
        <small className="mt-1 block text-xs text-[var(--app-muted)]">{detail}</small>
      </div>
      {onClick && (
        <span className="print-hide mt-1 text-[var(--app-muted)] transition group-hover:translate-x-0.5 group-hover:text-[var(--app-primary)]">
          <ChevronRight size={18} />
        </span>
      )}
    </div>
  )

  if (!onClick) return <article className={metricCardClass}>{body}</article>

  return (
    <button type="button" onClick={onClick} className={`${metricCardClass} w-full`} aria-label={`View ${label}`}>
      {body}
    </button>
  )
}

const Donut = ({ value, label }) => {
  const [drawn, setDrawn] = useState(false)
  useEffect(() => {
    const frame = requestAnimationFrame(() => setDrawn(true))
    return () => cancelAnimationFrame(frame)
  }, [])
  const size = 176
  const stroke = 22
  const radius = (size - stroke) / 2
  const circumference = 2 * Math.PI * radius
  const shown = value === null || value === undefined ? null : Math.max(0, Math.min(100, value))
  const swept = drawn && shown !== null ? (shown / 100) * circumference : 0

  return (
    <div className="relative mx-auto grid h-44 w-44 place-items-center">
      <svg viewBox={`0 0 ${size} ${size}`} className="h-44 w-44 -rotate-90" role="img" aria-label={shown === null ? 'Facility health not available' : `Facility health ${shown} percent`}>
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="var(--app-soft-bg)" strokeWidth={stroke} />
        {shown !== null && (
          <circle
            className="donut-arc"
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke="var(--app-primary)"
            strokeWidth={stroke}
            strokeLinecap="round"
            strokeDasharray={`${swept} ${circumference}`}
          />
        )}
      </svg>
      <div className="absolute text-center">
        <strong className="block text-3xl font-extrabold text-[var(--app-ink)]">{shown === null ? 'N/A' : `${shown}%`}</strong>
        <span className="text-[10px] font-extrabold uppercase tracking-[.14em] text-[var(--app-muted)]">{shown === null ? 'no data' : label}</span>
      </div>
    </div>
  )
}

// Grows from zero on mount and carries its own hover readout.
const MeterBar = ({ value, tone = 'var(--app-primary)', title }) => {
  const [drawn, setDrawn] = useState(false)
  useEffect(() => {
    const frame = requestAnimationFrame(() => setDrawn(true))
    return () => cancelAnimationFrame(frame)
  }, [])
  return (
    <div className="h-2 overflow-hidden rounded-full bg-[var(--app-table-hover-bg)]" title={title}>
      <span className="meter-bar-fill block h-full rounded-full" style={{ width: `${drawn ? (value ?? 0) : 0}%`, background: tone }} />
    </div>
  )
}

const HealthRow = ({ label, weight, value, note }) => (
  <div className="grid gap-1.5 rounded-2xl bg-[var(--app-soft-bg)] p-3">
    <div className="flex items-center justify-between gap-3 text-sm">
      <span className="text-[var(--app-muted)]">{label}</span>
      <span className="flex items-center gap-2">
        <small className="text-[9px] font-extrabold uppercase tracking-[.12em] text-[var(--app-muted)]">{weight}%</small>
        <strong className="text-[var(--app-ink)]">{value === null ? 'N/A' : `${value}%`}</strong>
      </span>
    </div>
    <MeterBar value={value} title={`${label}: ${value === null ? 'no data' : `${value}%`}`} />
    <small className="text-[10px] text-[var(--app-muted)]">{note}</small>
  </div>
)

const pmPlanFromRecord = pm => ({
  pmStatus: pm.pmStatus || 'ACTIVE',
  startDate: excelToDate(pm.startDate) || pm.startDate,
  leadTime: pm.leadTime
})

const closedStatuses = ['COMP', 'COMPLETED', 'CLOSE', 'CLOSED']
const isClosed = order => closedStatuses.includes(String(order.STATUS || '').toUpperCase())

// Reported dates arrive either as an Excel serial (imported rows) or a local
// `YYYY-MM-DDTHH:mm` string (rows created in the app). `new Date('46023')` would parse
// as the year 46023, so numeric values must go through the Excel converter.
const reportedTime = order => {
  const raw = order['REPORTED DATE '] ?? order['REPORTED DATE'] ?? ''
  if (raw === '' || raw === null) return null
  if (typeof raw === 'number' || /^\d+(\.\d+)?$/.test(String(raw).trim())) {
    const converted = excelDate(raw)
    const date = converted && converted !== '-' ? new Date(converted) : null
    return date && !Number.isNaN(date.getTime()) ? date.getTime() : null
  }
  return parseLocal(raw)?.getTime() ?? null
}

export default function OverviewPage({
  onNavigate,
  onOpenWorkOrderTab,
  currentUser,
  projectName = '',
  assets: liveAssets = [],
  incidents = [],
  workOrders: liveWorkOrders = [],
  pmRecords = [],
  failureCodes = [],
  meters = [],
  purchaseRequests = [],
  purchaseOrders = [],
  reservations = []
}) {
  const assetRows = liveAssets
  const operating = assetRows.filter(asset => asset.status === 'OPERATING').length
  const now = Date.now()
  const workOrderRows = liveWorkOrders
  const openOrders = workOrderRows.filter(order => !isClosed(order))
  const closedOrders = workOrderRows.filter(isClosed)
  const overdueOrders = openOrders.filter(order => {
    // Work held for material has a stopped clock, and held time is added back onto the
    // target - so these are excluded from SLA violations rather than counted unfairly.
    if (isOnHold(order)) return false
    const target = excelDate(order['TARGET FINISH '] || order['TARGET START '])
    const due = target && target !== '-' ? new Date(target).getTime() : null
    return due && effectiveTargetTime(due, order, now) < now
  })
  const pausedOrders = openOrders.filter(isOnHold)
  const pmCount = workOrderRows.filter(order => String(order['WORK TYPE '] || '').trim() === 'PM').length
  const cmCount = workOrderRows.filter(order => String(order['WORK TYPE '] || '').trim() === 'CM').length
  const slaCompliance = workOrderRows.length ? Math.round(((workOrderRows.length - overdueOrders.length) / workOrderRows.length) * 100) : 100
  const openPurchaseRequests = purchaseRequests.filter(row => !['CLOSE', 'CAN'].includes(String(row.status || '').toUpperCase()))
  const openPurchaseOrders = purchaseOrders.filter(row => !['CLOSE', 'CAN'].includes(String(row.status || '').toUpperCase()))
  const activeReservations = reservations.filter(row => !['COMPLETE', 'CANCELLED'].includes(String(row.status || '').toUpperCase()))
  const percentage = (part, total) => total ? Math.round((part / total) * 100) : null

  const today = new Date()
  const monthStart = new Date(today.getFullYear(), today.getMonth(), 1).getTime()
  const yearStart = new Date(today.getFullYear(), 0, 1).getTime()
  const loggedSince = from => workOrderRows.filter(order => {
    const stamp = reportedTime(order)
    return stamp !== null && stamp >= from
  }).length
  const loggedThisMonth = loggedSince(monthStart)
  const loggedYtd = loggedSince(yearStart)
  const openShare = percentage(openOrders.length, workOrderRows.length)
  const closedShare = percentage(closedOrders.length, workOrderRows.length)
  const monthLabel = today.toLocaleDateString(undefined, { month: 'long' })

  const openIncidents = incidents.filter(row => !['RESOLVED', 'CLOSED'].includes(String(row.status || '').toUpperCase()))
  const permitOrders = workOrderRows.filter(order => order['PTW REQUIRED'])
  const permitFiles = permitOrders.reduce((sum, order) => sum + (order['PTW FILES']?.length || 0), 0)
  const permitsMissingDocs = permitOrders.filter(order => !(order['PTW FILES']?.length)).length

  const connectedOperations = [
    ...purchaseRequests.map(row => ({ type: 'Purchase Request', reference: row.purchaseRequest, workOrder: row.workOrder, item: row.item, status: row.status, next: row.purchaseOrder ? `Linked to ${row.purchaseOrder}` : 'Awaiting approval' })),
    ...purchaseOrders.map(row => ({ type: 'Purchase Order', reference: row.purchaseOrder, workOrder: row.workOrder, item: row.item, status: row.status, next: row.status === 'CLOSE' ? 'Received and closed' : 'Procurement follow-up' })),
    ...reservations.map(row => ({ type: row.type === 'Material' ? 'Reservation' : 'Allocation', reference: row.reservation, workOrder: row.workOrder, item: row.item, status: row.status, next: row.status === 'COMPLETE' ? 'Delivered to work order' : 'Store fulfillment' }))
  ].slice(0, 8)
  const siteCompliance = [...new Set(workOrderRows.map(order => order.SITE).filter(Boolean))].slice(0, 4).map(site => {
    const siteRows = workOrderRows.filter(order => order.SITE === site)
    const siteOverdue = overdueOrders.filter(order => order.SITE === site)
    return { site, value: siteRows.length ? Math.round(((siteRows.length - siteOverdue.length) / siteRows.length) * 100) : 100 }
  })

  const targetTime = order => {
    const target = excelDate(order['TARGET FINISH '] || order['TARGET START '])
    return target && target !== '-' ? new Date(target).getTime() : null
  }
  const missedTarget = order => {
    if (isOnHold(order)) return false
    const raw = targetTime(order)
    if (!raw) return false
    const due = effectiveTargetTime(raw, order, now)
    if (!isClosed(order)) return due < now
    const finish = excelDate(order['ACTUAL FINISH '])
    const finished = finish && finish !== '-' ? new Date(finish).getTime() : null
    return Boolean(finished && finished > due)
  }
  const scheduledPmOrders = workOrderRows.filter(order => String(order['WORK TYPE '] || '').trim() === 'PM' && targetTime(order))
  const pmMissed = scheduledPmOrders.filter(missedTarget).length
  const healthComponents = [
    { label: 'Asset availability', weight: 40, value: percentage(operating, assetRows.length), note: `${operating} of ${assetRows.length} assets operating` },
    { label: 'SLA compliance', weight: 35, value: workOrderRows.length ? slaCompliance : null, note: workOrderRows.length ? `${overdueOrders.length} of ${workOrderRows.length} work orders past target` : 'No work orders logged yet' },
    { label: 'PM compliance', weight: 25, value: percentage(scheduledPmOrders.length - pmMissed, scheduledPmOrders.length), note: scheduledPmOrders.length ? `${pmMissed} of ${scheduledPmOrders.length} PM work orders missed target` : 'No scheduled PM work orders yet' }
  ]
  const measuredHealth = healthComponents.filter(item => item.value !== null)
  const healthWeight = measuredHealth.reduce((sum, item) => sum + item.weight, 0)
  const facilityHealth = healthWeight
    ? Math.round(measuredHealth.reduce((sum, item) => sum + (item.value * item.weight), 0) / healthWeight)
    : null

  const utilityTrend = type => {
    const typeMeters = meters.filter(meter => meter.meterType === type)
    if (!typeMeters.length) return []
    const anchor = parseLocal([...typeMeters.map(meter => meter.readingDate)].sort().pop()) || new Date()
    // Mirrors the history the Meters detail page synthesises: 30 days and 85 units per step.
    return Array.from({ length: 6 }, (_, index) => {
      const stepsBack = 5 - index
      const date = new Date(anchor)
      date.setDate(date.getDate() - stepsBack * 30)
      return {
        label: date.toLocaleDateString(undefined, { month: 'short' }),
        value: typeMeters.reduce((sum, meter) => sum + Math.max(0, Number(meter.reading || 0) - stepsBack * 85), 0)
      }
    })
  }
  const waterTrend = utilityTrend('Water')
  const energyTrend = utilityTrend('Energy')
  const unitFor = type => meters.find(meter => meter.meterType === type)?.unit || ''
  const meterCount = type => meters.filter(meter => meter.meterType === type).length

  const printDashboard = () => printWithoutBrowserTitle()
  const currentHour = today.getHours()
  const greeting = currentHour < 12 ? 'Good morning' : currentHour < 18 ? 'Good afternoon' : 'Good evening'
  const displayName = currentUser?.name || currentUser?.username || 'there'

  return (
    <section className="dashboard-print">
      <header className="dashboard-print-header">
        <div>
          <span>{projectName || 'Seder CAFM'}</span>
          <strong>Facility Dashboard</strong>
        </div>
        <span>Generated {today.toLocaleDateString()}</span>
      </header>

      <div>
        <section className="print-hide mb-7 flex flex-col gap-5 rounded-3xl border border-[var(--app-line)] bg-[var(--app-panel)] p-6 shadow-[0_14px_36px_rgba(32,55,45,.08)] lg:flex-row lg:items-center lg:justify-between">
          <div>
            <Badge tone="green">Live workspace</Badge>
            <h1 className="mt-3 text-4xl font-extrabold tracking-[-.05em] text-[var(--app-ink)]">{greeting}, {displayName}.</h1>
            <p className="mt-2 text-sm text-[var(--app-muted)]">Here is what needs attention across {projectName || 'your facilities'} today.</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="outline" onClick={printDashboard}><Printer size={16} /> Export dashboard</Button>
            <Button onClick={() => onNavigate('Work Orders')}><Plus size={17} /> New work order</Button>
          </div>
        </section>

        <section className="print-grid-4 mb-7 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <Metric label={`Logged in ${monthLabel}`} value={loggedThisMonth} detail="Work orders raised this month" icon={CalendarRange} tone="blue" onClick={() => onNavigate('Work Orders')} />
          <Metric label="Logged year to date" value={loggedYtd} detail={`${workOrderRows.length} on record in total`} icon={Activity} tone="purple" onClick={() => onNavigate('Work Orders')} />
          <Metric label="Open" value={openOrders.length} detail={openShare === null ? 'No work orders logged yet' : `${openShare}% of all work orders`} icon={ClipboardList} tone="orange" onClick={() => onNavigate('Work Orders')} />
          <Metric label="Closed" value={closedOrders.length} detail={closedShare === null ? 'No work orders logged yet' : `${closedShare}% of all work orders`} icon={CheckCircle2} tone="green" onClick={() => onNavigate('Work Orders')} />
        </section>

        <section className="print-grid-4 mb-7 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <Metric label="Incidents" value={openIncidents.length} detail={`${incidents.length} logged, ${incidents.length - openIncidents.length} resolved`} icon={AlertOctagon} tone="orange" onClick={() => onNavigate('Incidents')} />
          <Metric label="Permits to work" value={permitOrders.length} detail={permitsMissingDocs ? `${permitsMissingDocs} awaiting documentation` : `${permitFiles} permit document${permitFiles === 1 ? '' : 's'} on file`} icon={FileCheck2} tone="purple" onClick={() => onNavigate('Work Orders')} />
          <Metric label="Assets online" value={`${operating}/${assetRows.length}`} detail={`${percentage(operating, assetRows.length) ?? 0}% operational`} icon={Boxes} tone="green" onClick={() => onNavigate('Assets')} />
          <Metric label="PM programs" value={pmRecords.length} detail="Recurring schedules" icon={CalendarClock} tone="blue" onClick={() => onNavigate('Preventive Maintenance')} />
        </section>

        <section className="print-grid-3 mb-7 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          <Metric label="PM vs CM" value={`${pmCount}/${cmCount}`} detail="Preventive compared with corrective" icon={CalendarClock} tone="blue" onClick={() => onNavigate('Work Orders')} />
          <Metric label="Failure codes" value={failureCodes.length.toLocaleString()} detail="Searchable library" icon={ShieldCheck} tone="purple" onClick={() => onNavigate('Failure Library')} />
          <Metric label="Meters" value={meters.length} detail="Utility and runtime meters tracked" icon={Gauge} tone="green" onClick={() => onNavigate('Meters')} />
        </section>

        <section className="mb-7 rounded-3xl border border-[var(--app-line)] bg-[var(--app-panel)] p-5 shadow-[0_8px_24px_rgba(32,55,45,.06)]">
          <header className="mb-4">
            <p className="text-[9px] font-extrabold uppercase tracking-[.16em] text-[var(--app-muted)]">SLA BY SITE</p>
            <h2 className="text-lg font-extrabold text-[var(--app-ink)]">Service level performance</h2>
          </header>

          <div className="mb-5 grid gap-4 md:grid-cols-2">
            <Metric label="SLA compliance" value={`${slaCompliance}%`} detail="Based on target finish/start dates" icon={Gauge} tone="green" onClick={() => onNavigate('Work Orders')} />
            <Metric label="SLA violations" value={overdueOrders.length} detail="Open work orders past target" icon={AlertTriangle} tone="orange" onClick={() => onNavigate('Work Orders')} />
          </div>

          {siteCompliance.length ? (
            <div className="print-grid-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
              {siteCompliance.map(item => (
                <div className="rounded-2xl border border-[var(--app-line)] bg-[var(--app-soft-bg)] p-4" key={item.site}>
                  <div className="mb-3 flex items-center justify-between text-sm"><strong>{item.site}</strong><span>{item.value}%</span></div>
                  <MeterBar value={item.value} title={`Site ${item.site}: ${item.value}% SLA compliance`} />
                </div>
              ))}
            </div>
          ) : (
            <div className="grid min-h-24 place-items-center rounded-2xl border border-dashed border-[var(--app-line)] px-4 text-center text-xs text-[var(--app-muted)]">
              Site-level SLA appears once work orders carry a site and target date.
            </div>
          )}
        </section>

        <section className="print-grid-3 mb-7 grid gap-4 md:grid-cols-3">
          <Metric label="Open purchase requisitions" value={openPurchaseRequests.length} detail="Material shortages awaiting approval" icon={ShoppingCart} tone="orange" onClick={() => onNavigate('Purchase Requisitions')} />
          <Metric label="Open purchase orders" value={openPurchaseOrders.length} detail="Approved procurement still in process" icon={PackageCheck} tone="blue" onClick={() => onNavigate('Purchase Orders')} />
          <Metric label="Store fulfillment" value={activeReservations.length} detail="Reservations or allocations not yet delivered" icon={Truck} tone="green" onClick={() => onNavigate('Reservations')} />
        </section>

        <section className="mb-7 rounded-3xl border border-[var(--app-line)] bg-[var(--app-panel)] p-5 shadow-[0_8px_24px_rgba(32,55,45,.06)]">
          <header className="mb-4 flex items-center justify-between gap-4">
            <div>
              <p className="text-[9px] font-extrabold uppercase tracking-[.16em] text-[var(--app-muted)]">UTILITIES</p>
              <h2 className="text-lg font-extrabold text-[var(--app-ink)]">Consumption trend</h2>
              <p className="mt-1 text-xs text-[var(--app-muted)]">Totalled across all metered assets, last six reading cycles.</p>
            </div>
            <Button className="print-hide" variant="ghost" onClick={() => onNavigate('Meters')}>Open meters <ChevronRight size={16} /></Button>
          </header>
          <div className="grid gap-4 lg:grid-cols-2">
            <LineChart
              title="Water"
              subtitle={`${meterCount('Water')} water meter${meterCount('Water') === 1 ? '' : 's'}`}
              unit={unitFor('Water')}
              color="var(--app-chart-water)"
              points={waterTrend}
              emptyText="No water meters configured yet"
            />
            <LineChart
              title="Electricity"
              subtitle={`${meterCount('Energy')} energy meter${meterCount('Energy') === 1 ? '' : 's'}`}
              unit={unitFor('Energy')}
              color="var(--app-chart-energy)"
              points={energyTrend}
              emptyText="No energy meters configured yet"
            />
          </div>
          <div className="mt-4 grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
            {meters.slice(0, 4).map(meter => (
              <div className="rounded-2xl border border-[var(--app-line)] bg-[var(--app-soft-bg)] p-3" key={meter.meterId}>
                <div className="flex items-center gap-2 text-[10px] font-extrabold uppercase tracking-[.12em] text-[var(--app-muted)]">
                  {meter.meterType === 'Water' ? <Droplets size={13} /> : <Zap size={13} />}
                  {meter.meterId}
                </div>
                <strong className="mt-1 block text-sm text-[var(--app-ink)]">{Number(meter.reading || 0).toLocaleString()} {meter.unit}</strong>
                <small className="text-[10px] text-[var(--app-muted)]">{meter.asset} · {meter.readingDate}</small>
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
              <Button className="print-hide" variant="ghost" onClick={() => onNavigate('Work Orders')}>View all <ChevronRight size={16} /></Button>
            </header>
            <DataTable
              rows={workOrderRows}
              search=""
              pageSize={5}
              showFooter={false}
              columns={[
                { key: 'WORKORDER', label: 'Order', render: value => <strong className="mono">#{value}</strong> },
                { key: 'DESCRIPITION ', label: 'Description' },
                { key: 'LOCATION PRIORTY', label: 'Location', render: value => <Badge tone={String(value ?? '').trim() === 'VIP' ? 'purple' : 'orange'}>{value ?? '-'}</Badge> },
                { key: 'STATUS', label: 'Status', render: value => <Badge tone={statusTone(value)}>{statusDescription('workOrder', value) || value}</Badge> },
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
                  <p className="mt-1 text-xs text-[var(--app-muted)]">Weighted score across asset availability, SLA and PM compliance.</p>
                </div>
                <MoreHorizontal className="text-[var(--app-muted)]" />
              </header>
              <Donut value={facilityHealth} label="healthy" />
              <div className="mt-5 grid gap-2">
                {healthComponents.map(item => <HealthRow key={item.label} {...item} />)}
              </div>
              {measuredHealth.length < healthComponents.length && (
                <p className="mt-3 text-[10px] leading-relaxed text-[var(--app-muted)]">
                  Criteria without data are excluded and the remaining weights are rebalanced, so the score is never inflated by missing records.
                </p>
              )}
            </article>

            <article className="print-hide flex gap-4 rounded-3xl border border-[var(--app-line)] bg-[var(--app-badge-green-bg)] p-5 text-[var(--app-badge-green-text)] shadow-[0_8px_24px_rgba(32,55,45,.05)]">
              <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-[var(--app-panel)]"><Sparkles size={18} /></div>
              <div>
                <span className="text-[9px] font-extrabold uppercase tracking-[.16em]">SMART INSIGHT</span>
                <strong className="mt-1 block text-base">{pmCount >= cmCount ? 'Preventive work is leading corrective.' : 'Corrective work is outpacing preventive.'}</strong>
                <p className="mt-1 text-sm text-[var(--app-muted)]">Bundle technician visits by site to reduce travel time.</p>
              </div>
            </article>
          </aside>
        </section>

        <section className="mb-7 rounded-3xl border border-[var(--app-line)] bg-[var(--app-panel)] p-5 shadow-[0_8px_24px_rgba(32,55,45,.06)]">
          <header className="mb-4">
            <p className="text-[9px] font-extrabold uppercase tracking-[.16em] text-[var(--app-muted)]">COMPLIANCE</p>
            <h2 className="text-lg font-extrabold text-[var(--app-ink)]">Permits to work</h2>
            <p className="mt-1 text-xs text-[var(--app-muted)]">Open a work order directly on its permit documentation.</p>
          </header>
          {permitOrders.length ? (
            <div className="grid gap-2">
              {permitOrders.slice(0, 6).map(order => {
                const files = order['PTW FILES']?.length || 0
                return (
                  <button
                    type="button"
                    key={order.WORKORDER}
                    onClick={() => onOpenWorkOrderTab?.(order.WORKORDER, 'PTW & Files')}
                    className="grid gap-2 rounded-2xl border border-[var(--app-line)] bg-[var(--app-soft-bg)] p-3 text-left transition hover:bg-[var(--app-table-hover-bg)] md:grid-cols-[130px_1fr_auto] md:items-center"
                  >
                    <strong className="mono text-sm text-[var(--app-ink)]">#{order.WORKORDER}</strong>
                    <span className="truncate text-sm text-[var(--app-muted)]">{order['DESCRIPITION '] || 'Work order'}</span>
                    <span className="flex items-center gap-2">
                      <Badge tone={files ? 'green' : 'orange'}>{files ? `${files} document${files === 1 ? '' : 's'}` : 'Permit missing'}</Badge>
                      <ChevronRight size={16} className="text-[var(--app-muted)]" />
                    </span>
                  </button>
                )
              })}
            </div>
          ) : (
            <div className="grid min-h-24 place-items-center rounded-2xl border border-dashed border-[var(--app-line)] px-4 text-center text-xs text-[var(--app-muted)]">
              No work order currently requires a permit to work.
            </div>
          )}
        </section>

        {connectedOperations.length > 0 && (
          <section className="print-hide mb-7 overflow-hidden rounded-3xl border border-[var(--app-line)] bg-[var(--app-panel)] shadow-[0_8px_24px_rgba(32,55,45,.06)]">
            <header className="flex items-center justify-between gap-4 border-b border-[var(--app-line)] px-5 py-4">
              <div>
                <p className="text-[9px] font-extrabold uppercase tracking-[.16em] text-[var(--app-muted)]">CONNECTED OPERATIONS</p>
                <h2 className="text-lg font-extrabold text-[var(--app-ink)]">Work order supply chain</h2>
              </div>
              <Button className="print-hide" variant="ghost" onClick={() => onNavigate('Purchase Requisitions')}>Open requisitions <ChevronRight size={16} /></Button>
            </header>
            <DataTable
              rows={connectedOperations}
              rowKey="reference"
              pageSize={8}
              showFooter={false}
              columns={[
                { key: 'type', label: 'Operation' },
                { key: 'reference', label: 'Reference', render: value => <strong className="mono">{value}</strong> },
                { key: 'workOrder', label: 'Work Order' },
                { key: 'item', label: 'Item' },
                { key: 'status', label: 'Status', render: value => <Badge tone={value === 'CLOSE' || value === 'COMPLETE' ? 'green' : 'orange'}>{value}</Badge> },
                { key: 'next', label: 'Current Link' }
              ]}
            />
          </section>
        )}

        <section className="print-hide rounded-3xl border border-[var(--app-line)] bg-[var(--app-panel)] p-5 shadow-[0_8px_24px_rgba(32,55,45,.06)]">
          <header className="mb-4 flex items-center justify-between gap-4">
            <div>
              <p className="text-[9px] font-extrabold uppercase tracking-[.16em] text-[var(--app-muted)]">MAINTENANCE</p>
              <h2 className="text-lg font-extrabold text-[var(--app-ink)]">Preventive maintenance</h2>
            </div>
            <Button className="print-hide" variant="ghost" onClick={() => onNavigate('Preventive Maintenance')}>Open schedule <ChevronRight size={16} /></Button>
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
                <Badge tone={pmDueTone(pmPlanFromRecord(pm))}>{pmDueLabel(pmPlanFromRecord(pm))}</Badge>
              </div>
            ))}
          </div>
        </section>
      </div>
    </section>
  )
}

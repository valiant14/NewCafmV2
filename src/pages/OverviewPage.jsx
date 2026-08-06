import { useEffect, useState } from 'react'
import { Activity, AlertOctagon, AlertTriangle, Boxes, CalendarClock, CalendarRange, CheckCircle2, ChevronRight, ClipboardList, Droplets, FileCheck2, Gauge, MoreHorizontal, PackageCheck, Plus, Printer, ShieldCheck, ShoppingCart, Sparkles, Truck, Zap } from 'lucide-react'
import Badge from '../components/ui/Badge'
import Button from '../components/ui/Button'
import DataTable from '../components/ui/DataTable'
import LineChart from '../components/ui/LineChart'
import PageHeader from '../components/ui/PageHeader'
import RecordLink from '../components/ui/RecordLink'
import StatCard from '../components/ui/StatCard'
import Surface, { SurfaceHeader } from '../components/ui/Surface'
import { excelDate, excelToDate } from '../config/runtimeDefaults'
import { pmDueLabel, pmDueTone } from '../lib/pmSchedule'
import { parseLocal } from '../lib/datetime'
import { effectiveTargetTime, isOnHold } from '../lib/holdPeriods'
import { statusDescription, statusTone } from '../lib/statusMatrix'
import { printWithoutBrowserTitle } from '../lib/print'
import { openInventoryItem } from '../lib/recordNavigation'

const Metric = props => <StatCard {...props} />

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
  reservations = [],
  snapshot = null
}) {
  const assetRows = liveAssets
  const assetTotal = snapshot ? Number(snapshot.assets?.total || 0) : assetRows.length
  const operating = snapshot ? Number(snapshot.assets?.operating || 0) : assetRows.filter(asset => asset.status === 'OPERATING').length
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
  const workOrderStats = snapshot?.workOrders || null
  const totalWorkOrders = workOrderStats ? Number(workOrderStats.total || 0) : workOrderRows.length
  const openOrderCount = workOrderStats ? Number(workOrderStats.open || 0) : openOrders.length
  const closedOrderCount = workOrderStats ? Number(workOrderStats.closed || 0) : closedOrders.length
  const overdueOrderCount = workOrderStats ? Number(workOrderStats.overdue || 0) : overdueOrders.length
  const pausedOrderCount = workOrderStats ? Number(workOrderStats.paused || 0) : pausedOrders.length
  const pmCount = workOrderStats ? Number(workOrderStats.pm || 0) : workOrderRows.filter(order => String(order['WORK TYPE '] || '').trim() === 'PM').length
  const cmCount = workOrderStats ? Number(workOrderStats.cm || 0) : workOrderRows.filter(order => String(order['WORK TYPE '] || '').trim() === 'CM').length
  const slaCompliance = totalWorkOrders ? Math.round(((totalWorkOrders - overdueOrderCount) / totalWorkOrders) * 100) : 100
  const openPurchaseRequests = purchaseRequests.filter(row => !['CLOSE', 'CAN'].includes(String(row.status || '').toUpperCase()))
  const openPurchaseOrders = purchaseOrders.filter(row => !['CLOSE', 'CAN'].includes(String(row.status || '').toUpperCase()))
  const activeReservations = reservations.filter(row => !['COMPLETE', 'CANCELLED'].includes(String(row.status || '').toUpperCase()))
  const openPurchaseRequestCount = snapshot ? Number(snapshot.supply?.openPurchaseRequests || 0) : openPurchaseRequests.length
  const openPurchaseOrderCount = snapshot ? Number(snapshot.supply?.openPurchaseOrders || 0) : openPurchaseOrders.length
  const activeReservationCount = snapshot ? Number(snapshot.supply?.activeReservations || 0) : activeReservations.length
  const percentage = (part, total) => total ? Math.round((part / total) * 100) : null

  const today = new Date()
  const monthStart = new Date(today.getFullYear(), today.getMonth(), 1).getTime()
  const yearStart = new Date(today.getFullYear(), 0, 1).getTime()
  const loggedSince = from => workOrderRows.filter(order => {
    const stamp = reportedTime(order)
    return stamp !== null && stamp >= from
  }).length
  const loggedThisMonth = workOrderStats ? Number(workOrderStats.loggedThisMonth || 0) : loggedSince(monthStart)
  const loggedYtd = workOrderStats ? Number(workOrderStats.loggedYtd || 0) : loggedSince(yearStart)
  const openShare = percentage(openOrderCount, totalWorkOrders)
  const closedShare = percentage(closedOrderCount, totalWorkOrders)
  const monthLabel = today.toLocaleDateString(undefined, { month: 'long' })

  const openIncidents = incidents.filter(row => !['RESOLVED', 'CLOSED'].includes(String(row.status || '').toUpperCase()))
  const incidentTotal = snapshot ? Number(snapshot.incidents?.total || 0) : incidents.length
  const openIncidentCount = snapshot ? Number(snapshot.incidents?.open || 0) : openIncidents.length
  const recentPermitOrders = snapshot?.permitOrders || workOrderRows.filter(order => order['PTW REQUIRED']).map(order => ({
    workOrder: order.WORKORDER,
    description: order['DESCRIPITION '],
    status: order.STATUS,
    fileCount: order['PTW FILES']?.length || 0
  }))
  const permitCount = workOrderStats ? Number(workOrderStats.permits || 0) : recentPermitOrders.length
  const permitsMissingDocs = workOrderStats ? Number(workOrderStats.permitsMissing || 0) : recentPermitOrders.filter(order => !order.fileCount).length
  const permitsDocumented = Math.max(0, permitCount - permitsMissingDocs)

  // The server snapshot sends only the operation label, reference, work order and item text -
  // enough to work out where each of those points, which is done here rather than per column.
  const operationPage = type => (
    type === 'Purchase Request' ? 'Purchase Requisitions'
      : type === 'Purchase Order' ? 'Purchase Orders'
        : 'Reservations'
  )
  const connectedOperations = (snapshot?.supply?.operations || [
    ...purchaseRequests.map(row => ({ type: 'Purchase Request', page: 'Purchase Requisitions', reference: row.purchaseRequest, workOrder: row.workOrder, item: row.item, itemCode: row.itemCode, itemType: row.type, status: row.status, next: row.purchaseOrder ? `Linked to ${row.purchaseOrder}` : 'Awaiting approval' })),
    ...purchaseOrders.map(row => ({ type: 'Purchase Order', page: 'Purchase Orders', reference: row.purchaseOrder, workOrder: row.workOrder, item: row.item, itemCode: row.itemCode, itemType: row.type, status: row.status, next: row.status === 'CLOSE' ? 'Received and closed' : 'Procurement follow-up' })),
    ...reservations.map(row => ({ type: row.type === 'Material' ? 'Reservation' : 'Allocation', page: 'Reservations', reference: row.reservation, workOrder: row.workOrder, item: row.item, itemCode: row.itemCode, itemType: row.type, status: row.status, next: row.status === 'COMPLETE' ? 'Delivered to work order' : 'Store fulfillment' }))
  ]).slice(0, 8).map(row => ({
    ...row,
    page: row.page || operationPage(row.type),
    // An allocation is always a tool; everything else is stocked as a material unless the row
    // says otherwise. Materials hands an unknown description over to Tools, so a wrong guess
    // still lands on the right record.
    itemType: row.itemType || (row.type === 'Allocation' ? 'Tool' : 'Material')
  }))
  const calculatedSiteCompliance = [...new Set(workOrderRows.map(order => order.SITE).filter(Boolean))].slice(0, 4).map(site => {
    const siteRows = workOrderRows.filter(order => order.SITE === site)
    const siteOverdue = overdueOrders.filter(order => order.SITE === site)
    return { site, value: siteRows.length ? Math.round(((siteRows.length - siteOverdue.length) / siteRows.length) * 100) : 100 }
  })
  const siteCompliance = snapshot?.siteCompliance || calculatedSiteCompliance

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
  const scheduledPmCount = workOrderStats ? Number(workOrderStats.scheduledPm || 0) : scheduledPmOrders.length
  const pmMissed = workOrderStats ? Number(workOrderStats.pmMissed || 0) : scheduledPmOrders.filter(missedTarget).length
  const pmRows = snapshot?.preventiveMaintenance?.rows || pmRecords
  const pmProgramCount = snapshot ? Number(snapshot.preventiveMaintenance?.total || 0) : pmRecords.length
  const meterRows = snapshot?.meters?.rows || meters
  const meterHistoryRows = snapshot?.meters?.history || meterRows
  const meterTotal = snapshot ? Number(snapshot.meters?.total || 0) : meters.length
  const failureCodeTotal = snapshot ? Number(snapshot.failureCodes?.total || 0) : failureCodes.length
  const healthComponents = [
    { label: 'Asset availability', weight: 40, value: percentage(operating, assetTotal), note: `${operating} of ${assetTotal} assets operating` },
    { label: 'SLA compliance', weight: 35, value: totalWorkOrders ? slaCompliance : null, note: totalWorkOrders ? `${overdueOrderCount} of ${totalWorkOrders} work orders past target` : 'No work orders logged yet' },
    { label: 'PM compliance', weight: 25, value: percentage(scheduledPmCount - pmMissed, scheduledPmCount), note: scheduledPmCount ? `${pmMissed} of ${scheduledPmCount} PM work orders missed target` : 'No scheduled PM work orders yet' }
  ]
  const measuredHealth = healthComponents.filter(item => item.value !== null)
  const healthWeight = measuredHealth.reduce((sum, item) => sum + item.weight, 0)
  const facilityHealth = healthWeight
    ? Math.round(measuredHealth.reduce((sum, item) => sum + (item.value * item.weight), 0) / healthWeight)
    : null

  const utilityTrend = type => {
    const typeMeters = meterHistoryRows
      .filter(meter => meter.meterType === type && parseLocal(meter.readingDate))
      .sort((left, right) => parseLocal(left.readingDate).getTime() - parseLocal(right.readingDate).getTime())
      .slice(-6)
    if (!typeMeters.length) return []
    return typeMeters.map(meter => ({
      label: parseLocal(meter.readingDate).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }),
      value: Number(meter.reading || 0)
    }))
  }
  const waterTrend = utilityTrend('Water')
  const energyTrend = utilityTrend('Energy')
  const unitFor = type => meterRows.find(meter => meter.meterType === type)?.unit || ''
  const meterCount = type => meterRows.filter(meter => meter.meterType === type).length

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
        <PageHeader
          className="print-hide"
          eyebrow="Live workspace"
          title={`${greeting}, ${displayName}.`}
          description={`Here is what needs attention across ${projectName || 'your facilities'} today.`}
          actions={(
            <>
              <Button variant="outline" onClick={printDashboard}><Printer size={16} /> Export dashboard</Button>
              <Button onClick={() => onNavigate('Work Orders')}><Plus size={17} /> New work order</Button>
            </>
          )}
        />

        <section className="print-grid-4 mb-7 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <Metric label={`Logged in ${monthLabel}`} value={loggedThisMonth} detail="Work orders raised this month" icon={CalendarRange} tone="blue" onClick={() => onNavigate('Work Orders')} />
          <Metric label="Logged year to date" value={loggedYtd} detail={`${totalWorkOrders} on record in total`} icon={Activity} tone="purple" onClick={() => onNavigate('Work Orders')} />
          <Metric label="Open" value={openOrderCount} detail={openShare === null ? 'No work orders logged yet' : `${openShare}% of all work orders, ${pausedOrderCount} on hold`} icon={ClipboardList} tone="orange" onClick={() => onNavigate('Work Orders')} />
          <Metric label="Closed" value={closedOrderCount} detail={closedShare === null ? 'No work orders logged yet' : `${closedShare}% of all work orders`} icon={CheckCircle2} tone="green" onClick={() => onNavigate('Work Orders')} />
        </section>

        <section className="print-grid-4 mb-7 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <Metric label="Incidents" value={openIncidentCount} detail={`${incidentTotal} logged, ${Math.max(0, incidentTotal - openIncidentCount)} resolved`} icon={AlertOctagon} tone="orange" onClick={() => onNavigate('Incidents')} />
          <Metric label="Permits to work" value={permitCount} detail={permitsMissingDocs ? `${permitsMissingDocs} awaiting documentation` : `${permitsDocumented} documented permit${permitsDocumented === 1 ? '' : 's'}`} icon={FileCheck2} tone="purple" onClick={() => onNavigate('Work Orders')} />
          <Metric label="Assets online" value={`${operating}/${assetTotal}`} detail={`${percentage(operating, assetTotal) ?? 0}% operational`} icon={Boxes} tone="green" onClick={() => onNavigate('Assets')} />
          <Metric label="PM programs" value={pmProgramCount} detail="Recurring schedules" icon={CalendarClock} tone="blue" onClick={() => onNavigate('Preventive Maintenance')} />
        </section>

        <section className="print-grid-3 mb-7 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          <Metric label="PM vs CM" value={`${pmCount}/${cmCount}`} detail="Preventive compared with corrective" icon={CalendarClock} tone="blue" onClick={() => onNavigate('Work Orders')} />
          <Metric label="Failure codes" value={failureCodeTotal.toLocaleString()} detail="Searchable library" icon={ShieldCheck} tone="purple" onClick={() => onNavigate('Failure Library')} />
          <Metric label="Meters" value={meterTotal} detail="Utility and runtime meters tracked" icon={Gauge} tone="green" onClick={() => onNavigate('Meters')} />
        </section>

        <Surface tone="green" className="mb-7">
          <SurfaceHeader inset eyebrow="SLA by site" title="Service level performance" />

          <div className="mb-5 grid gap-4 md:grid-cols-2">
            <Metric label="SLA compliance" value={`${slaCompliance}%`} detail="Based on target finish/start dates" icon={Gauge} tone="green" onClick={() => onNavigate('Work Orders')} />
            <Metric label="SLA violations" value={overdueOrderCount} detail="Open work orders past target" icon={AlertTriangle} tone="orange" onClick={() => onNavigate('Work Orders')} />
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
        </Surface>

        <section className="print-grid-3 mb-7 grid gap-4 md:grid-cols-3">
          <Metric label="Open purchase requisitions" value={openPurchaseRequestCount} detail="Material shortages awaiting approval" icon={ShoppingCart} tone="orange" onClick={() => onNavigate('Purchase Requisitions')} />
          <Metric label="Open purchase orders" value={openPurchaseOrderCount} detail="Approved procurement still in process" icon={PackageCheck} tone="blue" onClick={() => onNavigate('Purchase Orders')} />
          <Metric label="Store fulfillment" value={activeReservationCount} detail="Reservations or allocations not yet delivered" icon={Truck} tone="green" onClick={() => onNavigate('Reservations')} />
        </section>

        <Surface tone="blue" className="mb-7">
          <SurfaceHeader
            inset
            eyebrow="Utilities"
            title="Consumption trend"
            description="Totalled across all metered assets, last six reading cycles."
            actions={<Button className="print-hide" variant="ghost" onClick={() => onNavigate('Meters')}>Open meters <ChevronRight size={16} /></Button>}
          />
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
            {meterRows.slice(0, 4).map(meter => (
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
        </Surface>

        <section className="mb-7 grid gap-5 xl:grid-cols-[1fr_340px]">
          <Surface as="article" flush tone="blue">
            <SurfaceHeader eyebrow="Operations" title="Active work orders" actions={<Button className="print-hide" variant="ghost" onClick={() => onNavigate('Work Orders')}>View all <ChevronRight size={16} /></Button>} />
            <DataTable
              rows={openOrders}
              search=""
              pageSize={5}
              showFooter={false}
              columns={[
                { key: 'WORKORDER', label: 'Order', render: value => <RecordLink value={`#${value}`} mono onClick={() => onOpenWorkOrderTab?.(value, 'Overview')} title={`Open work order ${value}`} /> },
                { key: 'DESCRIPITION ', label: 'Description' },
                { key: 'LOCATION PRIORTY', label: 'Location', render: value => <Badge tone={String(value ?? '').trim() === 'VIP' ? 'purple' : 'orange'}>{value ?? '-'}</Badge> },
                { key: 'STATUS', label: 'Status', render: value => <Badge tone={statusTone(value)}>{statusDescription('workOrder', value) || value}</Badge> },
                { key: 'TARGET START ', label: 'Target', render: excelDate }
              ]}
            />
          </Surface>

          <aside className="grid gap-5">
            <Surface as="article" tone="purple">
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
            </Surface>

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

        <Surface tone="orange" className="mb-7">
          <SurfaceHeader inset eyebrow="Compliance" title="Permits to work" description="Open a work order directly on its permit documentation." />
          {recentPermitOrders.length ? (
            <div className="grid gap-2">
              {recentPermitOrders.slice(0, 6).map(order => {
                const files = Number(order.fileCount || 0)
                return (
                  <button
                    type="button"
                    key={order.workOrder}
                    onClick={() => onOpenWorkOrderTab?.(order.workOrder, 'PTW & Files')}
                    className="grid gap-2 rounded-2xl border border-[var(--app-line)] bg-[var(--app-soft-bg)] p-3 text-left transition hover:bg-[var(--app-table-hover-bg)] md:grid-cols-[130px_1fr_auto] md:items-center"
                  >
                    <strong className="mono text-sm text-[var(--app-ink)]">#{order.workOrder}</strong>
                    <span className="truncate text-sm text-[var(--app-muted)]">{order.description || 'Work order'}</span>
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
        </Surface>

        {connectedOperations.length > 0 && (
          <Surface tone="purple" className="print-hide mb-7" flush>
            <SurfaceHeader eyebrow="Connected operations" title="Work order supply chain" actions={<Button className="print-hide" variant="ghost" onClick={() => onNavigate('Purchase Requisitions')}>Open requisitions <ChevronRight size={16} /></Button>} />
            <DataTable
              rows={connectedOperations}
              rowKey="reference"
              pageSize={8}
              showFooter={false}
              columns={[
                { key: 'type', label: 'Operation' },
                { key: 'reference', label: 'Reference', render: (value, row) => <RecordLink value={value} mono onClick={row.page ? () => onNavigate(row.page, { reference: value }) : undefined} title={`Open ${value} on ${row.page || 'its page'}`} /> },
                { key: 'workOrder', label: 'Work Order', render: value => <RecordLink value={value} mono onClick={value ? () => onOpenWorkOrderTab?.(value, 'Overview') : undefined} /> },
                { key: 'item', label: 'Item', render: (value, row) => <RecordLink value={value} icon={Boxes} onClick={row.itemCode || value ? () => openInventoryItem({ type: row.itemType, itemCode: row.itemCode, item: value }) : undefined} /> },
                { key: 'status', label: 'Status', render: value => <Badge tone={value === 'CLOSE' || value === 'COMPLETE' ? 'green' : 'orange'}>{value}</Badge> },
                { key: 'next', label: 'Current Link' }
              ]}
            />
          </Surface>
        )}

        <Surface tone="green" className="print-hide">
          <SurfaceHeader inset eyebrow="Maintenance" title="Preventive maintenance" actions={<Button className="print-hide" variant="ghost" onClick={() => onNavigate('Preventive Maintenance')}>Open schedule <ChevronRight size={16} /></Button>} />
          <div className="grid gap-3">
            {pmRows.slice(0, 4).map(pm => {
              const dueDate = parseLocal(pm.startDate)
              return (
                <button
                  type="button"
                  onClick={() => onNavigate('Preventive Maintenance')}
                  title={`Open the schedule for ${pm.pmNumber}`}
                  className="grid w-full gap-3 rounded-2xl border border-[var(--app-line)] bg-[var(--app-soft-bg)] p-4 text-left transition hover:bg-[var(--app-table-hover-bg)] md:grid-cols-[auto_1fr_auto] md:items-center"
                  key={pm.pmNumber}
                >
                  <div className="grid h-12 w-12 place-items-center rounded-2xl bg-[var(--app-badge-green-bg)] text-center">
                    <span className="block text-lg font-extrabold leading-none text-[var(--app-badge-green-text)]">{dueDate ? String(dueDate.getDate()).padStart(2, '0') : '--'}</span>
                    <small className="text-[9px] font-extrabold text-[var(--app-muted)]">{dueDate ? dueDate.toLocaleDateString(undefined, { month: 'short' }).toUpperCase() : 'TBD'}</small>
                  </div>
                  <div>
                    <strong className="block text-sm text-[var(--app-ink)]">{pm.description || pm.pmNumber}</strong>
                    <span className="text-xs text-[var(--app-muted)]">{pm.asset || 'No asset'} - Every {pm.frequency} {pm.freqUnit}</span>
                  </div>
                  <Badge tone={pmDueTone(pmPlanFromRecord(pm))}>{pmDueLabel(pmPlanFromRecord(pm))}</Badge>
                </button>
              )
            })}
          </div>
        </Surface>
      </div>
    </section>
  )
}

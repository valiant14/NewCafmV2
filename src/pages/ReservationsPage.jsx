import Badge from '../components/ui/Badge'
import Button from '../components/ui/Button'
import DataTable from '../components/ui/DataTable'
import EmptyState from '../components/ui/EmptyState'
import IndexTabs from '../components/ui/IndexTabs'
import PageHeader from '../components/ui/PageHeader'
import StandardFilters from '../components/ui/StandardFilters'
import { ClipboardCheck, ClipboardList, PackageOpen, Truck, X } from 'lucide-react'
import { useState } from 'react'
import { applyStandardFilters, emptyStandardFilters, optionsFromRows } from '../lib/standardFilters'
import { statusDescription, statusTone } from '../lib/statusMatrix'

const nextQuantity = row => {
  const requested = Number(row.quantity || 0)
  const available = Number(row.availableQuantity ?? requested)
  const arranged = Number(row.arrangedQuantity || 0)
  const released = Number(row.releasedQuantity || 0)
  const delivered = Number(row.deliveredQuantity || 0)
  return {
    requested,
    available,
    arranged,
    released,
    delivered,
    remainingToArrange: Math.max(0, Math.min(requested, available) - arranged),
    remainingToRelease: Math.max(0, arranged - released),
    remainingToDeliver: Math.max(0, released - delivered)
  }
}

const reservationStatuses = ['ENTERED', 'STAGED', 'COMPLETE', 'CANCELLED']
const cleanKey = value => String(value || '').trim().toLowerCase()
const numericBalance = value => {
  const number = Number(value)
  return Number.isFinite(number) ? number : null
}

export default function ReservationsPage({ rows = [], stockRows = [], onUpdate }) {
  const [filters, setFilters] = useState(emptyStandardFilters)
  const [status, setStatus] = useState('All')
  const [releaseRow, setReleaseRow] = useState(null)
  const [releaseQuantity, setReleaseQuantity] = useState('')
  const statusRows = status === 'All' ? rows : rows.filter(row => row.status === status)
  const visibleRows = applyStandardFilters(statusRows, filters, {
    site: ['site'],
    department: ['department'],
    status: ['status'],
    date: ['createdAt']
  })

  const arrange = row => {
    const q = nextQuantity(row)
    const liveBalance = numericBalance(stockBalanceFor(row))
    const available = liveBalance === null ? q.available : liveBalance + q.released
    const arrangedQuantity = Math.min(q.requested, available)
    onUpdate?.(row.reservation, { arrangedQuantity, status: 'STAGED', statusDescription: statusDescription('inventoryUsage', 'STAGED') })
  }
  const stockBalanceFor = row => {
    const store = cleanKey(row.source)
    const item = cleanKey(row.itemCode || row.item)
    const stock = stockRows.find(entry => cleanKey(entry.storeroom) === store && cleanKey(entry.itemNumber) === item)
    if (stock) return Number(stock.balance || 0)
    return row.availableQuantity ?? '-'
  }
  const openRelease = row => {
    const q = nextQuantity(row)
    const stockBalance = numericBalance(stockBalanceFor(row))
    const maxRelease = Math.min(q.remainingToRelease, stockBalance === null ? q.remainingToRelease : stockBalance)
    setReleaseRow(row)
    setReleaseQuantity(String(maxRelease || q.remainingToRelease || 0))
  }
  const closeRelease = () => {
    setReleaseRow(null)
    setReleaseQuantity('')
  }
  const release = () => {
    if (!releaseRow) return
    const q = nextQuantity(releaseRow)
    const stockBalance = numericBalance(stockBalanceFor(releaseRow))
    const maxRelease = Math.max(0, Math.min(q.remainingToRelease, stockBalance === null ? q.remainingToRelease : stockBalance))
    const actualRelease = Math.max(0, Math.min(Number(releaseQuantity || 0), maxRelease))
    if (!actualRelease) return
    const releasedQuantity = q.released + actualRelease
    const done = releasedQuantity >= q.requested
    onUpdate?.(releaseRow.reservation, {
      releasedQuantity,
      status: done && Number(releaseRow.deliveredQuantity || 0) >= q.requested ? 'COMPLETE' : 'STAGED',
      statusDescription: statusDescription('inventoryUsage', done && Number(releaseRow.deliveredQuantity || 0) >= q.requested ? 'COMPLETE' : 'STAGED')
    })
    closeRelease()
  }
  const deliver = row => {
    const q = nextQuantity(row)
    const deliveredQuantity = q.released || q.arranged || Math.min(q.requested, q.available)
    onUpdate?.(row.reservation, { deliveredQuantity, status: deliveredQuantity >= q.requested ? 'COMPLETE' : 'STAGED', statusDescription: statusDescription('inventoryUsage', deliveredQuantity >= q.requested ? 'COMPLETE' : 'STAGED') })
  }

  const actionFor = row => {
    if (row.status === 'COMPLETE') return <Badge tone="green">Complete</Badge>
    if (Number(row.releasedQuantity || 0) > Number(row.deliveredQuantity || 0)) return <Button className="h-8 px-3 text-xs" onClick={() => deliver(row)}><Truck size={14} />Deliver</Button>
    if (Number(row.arrangedQuantity || 0) > Number(row.releasedQuantity || 0)) return <Button className="h-8 px-3 text-xs" onClick={() => openRelease(row)}><PackageOpen size={14} />Release from store</Button>
    return <Button className="h-8 px-3 text-xs" onClick={() => arrange(row)}><ClipboardCheck size={14} />Arrange</Button>
  }
  const releaseInfo = releaseRow ? nextQuantity(releaseRow) : null
  const currentStockBalance = releaseRow ? stockBalanceFor(releaseRow) : '-'
  const releaseStockLimit = numericBalance(currentStockBalance)
  const releaseMax = releaseInfo ? Math.max(0, Math.min(releaseInfo.remainingToRelease, releaseStockLimit === null ? releaseInfo.remainingToRelease : releaseStockLimit)) : 0

  return (
    <section>
      <PageHeader
        eyebrow="INVENTORY CONTROL"
        title="Reservations & Allocations"
        description="For available stock only: reserve or allocate, arrange stock, release from store, then deliver to the Work Order."
      />
      <IndexTabs
        active={status}
        onChange={setStatus}
        tabs={[
          { key: 'All', label: 'All Reservations', count: rows.length },
          ...reservationStatuses.map(item => ({
            key: item,
            label: item,
            count: rows.filter(row => row.status === item).length
          }))
        ]}
      />
      <StandardFilters
        filters={filters}
        setFilters={setFilters}
        siteOptions={optionsFromRows(rows, ['site'])}
        departmentOptions={optionsFromRows(rows, ['department'])}
        statusOptions={reservationStatuses}
      />
      <section className="overflow-hidden rounded-2xl border border-[var(--app-line)] bg-[var(--app-table-bg)] shadow-[0_8px_24px_rgba(32,55,45,.06)]">
        {visibleRows.length ? (
          <DataTable
            rows={visibleRows}
            rowKey="reservation"
            pagination
            columns={[
              { key: 'reservation', label: 'Reference', render: value => <strong className="mono text-[var(--app-ink)]">{value}</strong> },
              { key: 'workOrder', label: 'Work Order' },
              { key: 'type', label: 'Type' },
              { key: 'item', label: 'Item / Description' },
              { key: 'quantity', label: 'Requested' },
              { key: 'availableQuantity', label: 'Balance', render: (_, row) => stockBalanceFor(row) },
              { key: 'arrangedQuantity', label: 'Arranged', render: value => value || 0 },
              { key: 'releasedQuantity', label: 'Released', render: value => value || 0 },
              { key: 'deliveredQuantity', label: 'Delivered', render: value => value || 0 },
              { key: 'source', label: 'Store / Source' },
              { key: 'status', label: 'Status', render: value => <Badge tone={statusTone(value)}>{value} - {statusDescription('inventoryUsage', value)}</Badge> },
              { key: 'action', label: 'Next Step', sortable: false, render: (_, row) => actionFor(row) }
            ]}
          />
        ) : (
          <EmptyState
            icon={ClipboardList}
            title="No reservations or allocations yet"
            description="Click Reserve or Allocate in a Work Order Material Requests tab to create a fulfillment record."
          />
        )}
      </section>
      {releaseRow && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-[color:color-mix(in_srgb,var(--app-sidebar-bg)_68%,transparent)] p-4 backdrop-blur-sm">
          <section className="w-full max-w-2xl overflow-hidden rounded-2xl border border-[var(--app-line)] bg-[var(--app-panel)] shadow-2xl">
            <header className="flex items-start justify-between gap-4 border-b border-[var(--app-line)] p-5">
              <div>
                <p className="text-[10px] font-extrabold uppercase tracking-[.16em] text-[var(--app-muted)]">Store release</p>
                <h2 className="mt-1 text-lg font-extrabold text-[var(--app-ink)]">{releaseRow.item}</h2>
                <p className="mt-1 text-xs text-[var(--app-muted)]">{releaseRow.reservation} - Work order {releaseRow.workOrder || '-'}</p>
              </div>
              <button type="button" className="rounded-xl border border-[var(--app-line)] p-2 text-[var(--app-muted)] hover:bg-[var(--app-soft)]" onClick={closeRelease} aria-label="Close release form">
                <X size={18} />
              </button>
            </header>
            <div className="grid gap-3 p-5 sm:grid-cols-4">
              {[
                ['Requested', releaseInfo?.requested || 0],
                ['Arranged', releaseInfo?.arranged || 0],
                ['Released', releaseInfo?.released || 0],
                ['Store balance', currentStockBalance]
              ].map(([label, value]) => (
                <div key={label} className="rounded-xl border border-[var(--app-line)] bg-[var(--app-soft)] p-3">
                  <p className="text-[10px] font-extrabold uppercase tracking-[.12em] text-[var(--app-muted)]">{label}</p>
                  <p className="mt-1 text-lg font-extrabold text-[var(--app-ink)]">{value}</p>
                </div>
              ))}
            </div>
            <div className="space-y-3 px-5 pb-5">
              <label className="block">
                <span className="text-[10px] font-extrabold uppercase tracking-[.14em] text-[var(--app-muted)]">Actual quantity to release now</span>
                <input
                  type="number"
                  min="0"
                  max={releaseMax}
                  value={releaseQuantity}
                  onChange={event => setReleaseQuantity(event.target.value)}
                  className="mt-2 w-full rounded-xl border border-[var(--app-line)] bg-white px-3 py-2 text-sm font-bold text-[var(--app-ink)] outline-none focus:border-[var(--app-primary)]"
                />
              </label>
              <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs font-bold text-amber-800">
                To follow after this release: {Math.max(0, Number(releaseInfo?.remainingToRelease || 0) - Number(releaseQuantity || 0))}
              </div>
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={closeRelease}>Cancel</Button>
                <Button onClick={release} disabled={!releaseMax || Number(releaseQuantity || 0) <= 0}>
                  <PackageOpen size={14} />Confirm release
                </Button>
              </div>
            </div>
          </section>
        </div>
      )}
    </section>
  )
}

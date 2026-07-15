import Badge from '../components/ui/Badge'
import Button from '../components/ui/Button'
import DataTable from '../components/ui/DataTable'
import EmptyState from '../components/ui/EmptyState'
import PageHeader from '../components/ui/PageHeader'
import StandardFilters from '../components/ui/StandardFilters'
import { ClipboardCheck, ClipboardList, PackageOpen, Truck } from 'lucide-react'
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

export default function ReservationsPage({ rows = [], onUpdate }) {
  const [filters, setFilters] = useState(emptyStandardFilters)
  const visibleRows = applyStandardFilters(rows, filters, {
    site: ['site'],
    department: ['department'],
    status: ['status'],
    date: ['createdAt']
  })

  const arrange = row => {
    const q = nextQuantity(row)
    const arrangedQuantity = Math.min(q.requested, q.available)
    onUpdate?.(row.reservation, { arrangedQuantity, status: 'STAGED', statusDescription: statusDescription('inventoryUsage', 'STAGED') })
  }
  const release = row => {
    const q = nextQuantity(row)
    onUpdate?.(row.reservation, { releasedQuantity: q.arranged || Math.min(q.requested, q.available), status: 'STAGED', statusDescription: statusDescription('inventoryUsage', 'STAGED') })
  }
  const deliver = row => {
    const q = nextQuantity(row)
    const deliveredQuantity = q.released || q.arranged || Math.min(q.requested, q.available)
    onUpdate?.(row.reservation, { deliveredQuantity, status: deliveredQuantity >= q.requested ? 'COMPLETE' : 'STAGED', statusDescription: statusDescription('inventoryUsage', deliveredQuantity >= q.requested ? 'COMPLETE' : 'STAGED') })
  }

  const actionFor = row => {
    if (row.status === 'COMPLETE') return <Badge tone="green">Complete</Badge>
    if (Number(row.releasedQuantity || 0) > Number(row.deliveredQuantity || 0)) return <Button className="h-8 px-3 text-xs" onClick={() => deliver(row)}><Truck size={14} />Deliver</Button>
    if (Number(row.arrangedQuantity || 0) > Number(row.releasedQuantity || 0)) return <Button className="h-8 px-3 text-xs" onClick={() => release(row)}><PackageOpen size={14} />Release from store</Button>
    return <Button className="h-8 px-3 text-xs" onClick={() => arrange(row)}><ClipboardCheck size={14} />Arrange</Button>
  }

  return (
    <section>
      <PageHeader
        eyebrow="INVENTORY CONTROL"
        title="Reservations & Allocations"
        description="Amazon-style fulfillment flow: Reserve, arrange stock, release from store, then deliver to the Work Order."
      />
      <StandardFilters
        filters={filters}
        setFilters={setFilters}
        siteOptions={optionsFromRows(rows, ['site'])}
        departmentOptions={optionsFromRows(rows, ['department'])}
        statusOptions={optionsFromRows(rows, ['status'])}
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
              { key: 'availableQuantity', label: 'Balance', render: value => value ?? '-' },
              { key: 'arrangedQuantity', label: 'Arranged', render: value => value || 0 },
              { key: 'releasedQuantity', label: 'Released', render: value => value || 0 },
              { key: 'deliveredQuantity', label: 'Delivered', render: value => value || 0 },
              { key: 'source', label: 'Store / Source' },
              { key: 'status', label: 'Status', render: value => <Badge tone={statusTone(value)}>{value} · {statusDescription('inventoryUsage', value)}</Badge> },
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
    </section>
  )
}

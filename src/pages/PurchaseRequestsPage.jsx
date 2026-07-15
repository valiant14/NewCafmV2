import Badge from '../components/ui/Badge'
import DataTable from '../components/ui/DataTable'
import EmptyState from '../components/ui/EmptyState'
import PageHeader from '../components/ui/PageHeader'
import StandardFilters from '../components/ui/StandardFilters'
import { ShoppingCart } from 'lucide-react'
import { useState } from 'react'
import { applyStandardFilters, emptyStandardFilters, optionsFromRows } from '../lib/standardFilters'
import { statusDescription, statusTone } from '../lib/statusMatrix'

export default function PurchaseRequestsPage({ rows = [] }) {
  const [filters, setFilters] = useState(emptyStandardFilters)
  const visibleRows = applyStandardFilters(rows, filters, {
    site: ['site'],
    department: ['department'],
    status: ['status'],
    date: ['createdAt']
  })

  return (
    <section>
      <PageHeader
        eyebrow="PROCUREMENT"
        title="Purchase Requests"
        description="Purchase requests created from Work Order material shortages."
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
            rowKey="purchaseRequest"
            pagination
            columns={[
              { key: 'purchaseRequest', label: 'PR Number', render: value => <strong className="mono text-[var(--app-ink)]">{value}</strong> },
              { key: 'workOrder', label: 'Work Order' },
              { key: 'item', label: 'Item / Description' },
              { key: 'quantity', label: 'Quantity' },
              { key: 'source', label: 'Source' },
              { key: 'site', label: 'Site' },
              { key: 'department', label: 'Department' },
              { key: 'status', label: 'Status', render: value => <Badge tone={statusTone(value)}>{value} · {statusDescription('purchaseRequisition', value)}</Badge> },
              { key: 'createdAt', label: 'Created' }
            ]}
          />
        ) : (
          <EmptyState
            icon={ShoppingCart}
            title="No purchase requests yet"
            description="When a Work Order resource is not available, click Create purchase request in Material Requests."
          />
        )}
      </section>
    </section>
  )
}

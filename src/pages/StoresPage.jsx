import { useState } from 'react'
import { ChevronRight, Package, Warehouse } from 'lucide-react'
import Badge from '../components/ui/Badge'
import Button from '../components/ui/Button'
import DataTable from '../components/ui/DataTable'
import EmptyState from '../components/ui/EmptyState'
import ExportExcelButton from '../components/ui/ExportExcelButton'
import PageHeader from '../components/ui/PageHeader'
import { storeLocation, storeStockRows, storeSummary } from '../lib/inventory'
import { scopeRowsForUser } from '../lib/accessControl'
import { useAuth } from '../providers/AuthProvider'

const summaryColumns = [
  { key: 'code', label: 'Store' },
  { key: 'name', label: 'Store Name' },
  { key: 'location', label: 'Location Code' },
  { key: 'locationDescription', label: 'Location' },
  { key: 'site', label: 'Site' },
  { key: 'department', label: 'Department' },
  { key: 'itemCount', label: 'Items' },
  { key: 'totalQuantity', label: 'Total Quantity' }
]

const stockColumns = [
  { key: 'itemNumber', label: 'Item Number' },
  { key: 'description', label: 'Description' },
  { key: 'category', label: 'Category' },
  { key: 'unit', label: 'Unit' },
  { key: 'balance', label: 'Balance' },
  { key: 'reserved', label: 'Reserved' },
  { key: 'available', label: 'Available' },
  { key: 'reorderLevel', label: 'Reorder Level' }
]

export default function StoresPage({ materials = [], stockRows = [], storeRows = [], locationRows = [], scopeUser }) {
  const { user } = useAuth()
  const routeId = decodeURIComponent(window.location.pathname.split('/stores/')[1] || '')
  const summary = scopeRowsForUser(storeSummary(materials, stockRows, storeRows, locationRows), scopeUser || user, ['site'])
  const [selected, setSelected] = useState(summary.find(store => store.code === routeId) || null)

  const open = store => {
    setSelected(store)
    window.history.pushState({}, '', `/stores/${encodeURIComponent(store.code)}`)
  }
  const close = () => {
    setSelected(null)
    window.history.pushState({}, '', '/stores')
  }

  if (selected) {
    const rows = storeStockRows(selected.code, materials, stockRows)
    const location = storeLocation(selected.code, storeRows, locationRows)
    return (
      <>
        <PageHeader
          eyebrow="STORE INVENTORY"
          title={selected.name}
          description={`${selected.code} · ${location ? `${location.location} — ${location.description}` : 'Location not linked'}`}
          actions={(
            <div className="flex items-center gap-2">
              <ExportExcelButton module={`Store ${selected.code}`} rows={rows} columns={stockColumns} />
              <Button variant="outline" onClick={close}>Back to stores</Button>
            </div>
          )}
        />
        <section className="overflow-hidden rounded-2xl border border-[var(--app-line)] bg-white shadow-[0_8px_24px_rgba(32,55,45,.06)]">
          {rows.length ? (
            <DataTable
              rows={rows}
              rowKey="itemNumber"
              pagination
              columns={[
                ...stockColumns.slice(0, 6),
                { key: 'available', label: 'Available', render: (value, row) => (
                  <Badge tone={value > row.reorderLevel ? 'green' : 'orange'}>{value}</Badge>
                ) },
                { key: 'reorderLevel', label: 'Reorder Level' }
              ]}
            />
          ) : (
            <EmptyState icon={Package} title="No stock held" description="This store has no material records yet." />
          )}
        </section>
      </>
    )
  }

  return (
    <>
      <PageHeader
        eyebrow="SUPPLY CHAIN"
        title="Stores"
        description="Approved store locations and the materials held in each."
        actions={<ExportExcelButton module="Stores" rows={summary} columns={summaryColumns} />}
      />
      <section className="overflow-hidden rounded-2xl border border-[var(--app-line)] bg-white shadow-[0_8px_24px_rgba(32,55,45,.06)]">
        <DataTable
          rows={summary}
          rowKey="code"
          onRowClick={open}
          pagination
          columns={[
            { key: 'code', label: 'Store', render: value => <strong className="mono">{value}</strong> },
            { key: 'name', label: 'Store Name' },
            { key: 'location', label: 'Location', render: (value, row) => (
              <span><strong className="mono">{value}</strong><small className="mt-1 block text-[9px] text-[var(--app-muted)]">{row.locationDescription}</small></span>
            ) },
            { key: 'department', label: 'Department' },
            { key: 'itemCount', label: 'Items' },
            { key: 'totalQuantity', label: 'Total Quantity' },
            { key: 'belowReorder', label: 'Below Reorder', render: value => (
              <Badge tone={value ? 'orange' : 'green'}>{value}</Badge>
            ) },
            { key: 'open', label: '', render: () => <ChevronRight size={17} /> }
          ]}
        />
      </section>
    </>
  )
}

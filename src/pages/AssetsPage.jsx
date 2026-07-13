import { useState } from 'react'
import { Plus } from 'lucide-react'
import AddAssetModal from '../components/assets/AddAssetModal'
import AssetDetailPage from '../components/assets/AssetDetailPage'
import Badge from '../components/ui/Badge'
import Button from '../components/ui/Button'
import DataTable from '../components/ui/DataTable'
import ExcelImportButton from '../components/ui/ExcelImportButton'
import ImportNotice from '../components/ui/ImportNotice'
import IndexTabs from '../components/ui/IndexTabs'
import PageHeader from '../components/ui/PageHeader'

const empty = {
  assetnum: '',
  description: '',
  location: '',
  parent: '',
  department: '',
  'sub department': '',
  prioity: 3,
  site: '1031',
  status: 'OPERATING',
  'asset short name': '',
  modelnum: '',
  serialnum: '',
  installdate: '',
  quantity: 1
}

export default function AssetsPage({ initialAssets = [], workOrders = [] }) {
  const [rows, setRows] = useState(initialAssets)
  const [adding, setAdding] = useState(false)
  const [form, setForm] = useState(empty)
  const [imported, setImported] = useState('')
  const [tab, setTab] = useState('All')
  const routeId = decodeURIComponent(window.location.pathname.split('/assets/')[1] || '')
  const [selected, setSelected] = useState(rows.find(row => row.assetnum === routeId) || null)
  const visibleRows = tab === 'All' ? rows : rows.filter(row => row.status === tab)

  const open = row => {
    setSelected(row)
    window.history.pushState({}, '', `/assets/${encodeURIComponent(row.assetnum)}`)
  }

  const close = () => {
    setSelected(null)
    window.history.pushState({}, '', '/assets')
  }

  const save = () => {
    if (!form.assetnum || !form.description || !form.site || !form.location) return
    const row = { ...form, quantity: Number(form.quantity || 1), prioity: Number(form.prioity || 3) }
    setRows(current => [...current, row])
    setAdding(false)
    setForm(empty)
    open(row)
  }

  if (selected) {
    return <AssetDetailPage asset={selected} workOrders={workOrders} onBack={close} />
  }

  return (
    <>
      <PageHeader
        eyebrow="PORTFOLIO"
        title="Asset register"
        description="A complete view of maintainable equipment across every site."
        actions={(
          <div className="flex items-center gap-2">
            <ExcelImportButton fileName={imported} onFile={setImported} />
            <Button onClick={() => setAdding(true)}><Plus size={17} />Add asset</Button>
          </div>
        )}
      />

      <ImportNotice fileName={imported} subject="asset register" onClear={() => setImported('')} />

      <IndexTabs
        active={tab}
        onChange={setTab}
        tabs={[
          { key: 'All', label: 'All Assets', count: rows.length },
          { key: 'OPERATING', label: 'Operating', count: rows.filter(row => row.status === 'OPERATING').length },
          { key: 'BROKEN', label: 'Broken', count: rows.filter(row => row.status === 'BROKEN').length },
          { key: 'NOT READY', label: 'Not Ready', count: rows.filter(row => row.status === 'NOT READY').length }
        ]}
      />

      <section className="overflow-hidden rounded-2xl border border-[var(--app-line)] bg-white shadow-[0_8px_24px_rgba(32,55,45,.06)]">
        <DataTable
          rows={visibleRows}
          rowKey="assetnum"
          onRowClick={open}
          pagination
          columns={[
            { key: 'assetnum', label: 'Asset ID', render: value => <strong className="mono">{value}</strong> },
            { key: 'description', label: 'Description' },
            { key: 'location', label: 'Location' },
            { key: 'site', label: 'Site' },
            { key: 'department', label: 'Department' },
            { key: 'modelnum', label: 'Model' },
            { key: 'status', label: 'Status', render: value => <Badge tone={value === 'OPERATING' ? 'green' : 'orange'}>{value || 'UNKNOWN'}</Badge> }
          ]}
        />
      </section>

      {adding && <AddAssetModal form={form} setForm={setForm} onClose={() => setAdding(false)} onSave={save} />}
    </>
  )
}

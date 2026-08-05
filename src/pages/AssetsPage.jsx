import { useEffect, useState } from 'react'
import { Plus } from 'lucide-react'
import AddAssetModal from '../components/assets/AddAssetModal'
import AssetDetailPage from '../components/assets/AssetDetailPage'
import Badge from '../components/ui/Badge'
import Button from '../components/ui/Button'
import DataTable from '../components/ui/DataTable'
import ExcelImportButton from '../components/ui/ExcelImportButton'
import ExcelTemplateButton from '../components/ui/ExcelTemplateButton'
import ExportExcelButton from '../components/ui/ExportExcelButton'
import ImportNotice from '../components/ui/ImportNotice'
import IndexTabs from '../components/ui/IndexTabs'
import PageHeader from '../components/ui/PageHeader'
import PriorityBadge from '../components/ui/PriorityBadge'
import StatusBadge from '../components/ui/StatusBadge'
import TablePanel from '../components/ui/TablePanel'
import StandardFilters from '../components/ui/StandardFilters'
import { applyStandardFilters, optionsFromRows, scopedStandardFilters, useScopedFilters } from '../lib/standardFilters'
import { normalizeStatus } from '../lib/statusMatrix'
import { conformsToAssetCode, validateAssetCode } from '../lib/coding'
import { mergeImportedRows } from '../lib/importRows'
import { useAuth } from '../providers/AuthProvider'
import useModuleAccess from '../hooks/useModuleAccess'
import useRelatedWorkOrders from '../hooks/useRelatedWorkOrders'

const empty = {
  assetnum: '',
  description: '',
  location: '',
  parent: '',
  department: '',
  'sub department': '',
  system: '',
  prioity: 3,
  site: '',
  status: 'OPERATING',
  'asset short name': '',
  modelnum: '',
  serialnum: '',
  installdate: '',
  quantity: 1
}
const templateHeaders = Object.keys(empty)

const exportColumns = [
  { key: 'assetnum', label: 'Asset Number' },
  { key: 'description', label: 'Description' },
  { key: 'asset short name', label: 'Short Name' },
  { key: 'parent', label: 'Parent Asset' },
  { key: 'location', label: 'Location' },
  { key: 'site', label: 'Site' },
  { key: 'department', label: 'Department' },
  { key: 'sub department', label: 'Sub Department' },
  { key: 'system', label: 'System' },
  { key: 'prioity', label: 'Priority' },
  { key: 'status', label: 'Status' },
  { key: 'modelnum', label: 'Model Number' },
  { key: 'serialnum', label: 'Serial Number' },
  { key: 'installdate', label: 'Install Date' },
  { key: 'quantity', label: 'Quantity' }
]

export default function AssetsPage({ rows: controlledRows, setRows: setControlledRows, initialAssets = [], workOrders = [], siteRecords = [], departmentRecords = [], locationRows = [] }) {
  const { user } = useAuth()
  const access = useModuleAccess('Assets')
  const [localRows, setLocalRows] = useState(initialAssets)
  const rows = controlledRows || localRows
  const setRows = setControlledRows || setLocalRows
  const [adding, setAdding] = useState(false)
  const [codeError, setCodeError] = useState('')
  const [form, setForm] = useState(empty)
  const [imported, setImported] = useState('')
  const [tab, setTab] = useState('All')
  const [filters, setFilters] = useScopedFilters(user, rows)
  const routeId = decodeURIComponent(window.location.pathname.split('/assets/')[1] || '')
  const [selected, setSelected] = useState(rows.find(row => row.assetnum === routeId) || null)
  const relatedWorkOrders = useRelatedWorkOrders(selected ? { asset_num: selected.assetnum } : null, { enabled: Boolean(selected) })
  useEffect(() => {
    if (!routeId) {
      setSelected(null)
      return
    }
    setSelected(rows.find(row => row.assetnum === routeId) || null)
  }, [rows, routeId])
  const tabRows = tab === 'All' ? rows : rows.filter(row => row.status === tab)
  const visibleRows = applyStandardFilters(tabRows, filters, { date: ['installdate'] })

  const open = row => {
    setSelected(row)
    window.history.pushState({}, '', `/assets/${encodeURIComponent(row.assetnum)}`)
  }

  const close = () => {
    setSelected(null)
    window.history.pushState({}, '', '/assets')
  }
  const updateAsset = (assetnum, patch) => {
    setRows(current => current.map(row => row.assetnum === assetnum ? { ...row, ...patch } : row))
    setSelected(current => current?.assetnum === assetnum ? { ...current, ...patch } : current)
  }

  const save = () => {
    const missing = [!form.description && 'Description', !form.site && 'Site', !form.location && 'Location'].filter(Boolean)
    if (missing.length) return setCodeError(`Complete ${missing.join(', ')} before saving.`)
    const check = validateAssetCode(form.assetnum, { rows, parentCode: form.parent })
    if (!check.valid) return setCodeError(check.reason)
    const { assetType, ...record } = form
    const row = { ...record, quantity: Number(form.quantity || 1), prioity: Number(form.prioity || 3) }
    setRows(current => [...current, row])
    setAdding(false)
    setForm(empty)
    setCodeError('')
    open(row)
  }

  if (selected) {
    return <AssetDetailPage asset={selected} workOrders={relatedWorkOrders.rows} onBack={close} onUpdate={updateAsset} />
  }

  return (
    <>
      <PageHeader
        eyebrow="PORTFOLIO"
        title="Asset register"
        description="A complete view of maintainable equipment across every site."
        actions={(
          <div className="flex items-center gap-2">
            <ExcelTemplateButton headers={templateHeaders} fileName="Assets_Template.xlsx" />
            <ExportExcelButton module="Assets" rows={visibleRows} columns={exportColumns} />
            {access.import && <ExcelImportButton fileName={imported} onFile={setImported} onImport={rows => setRows(current => mergeImportedRows(current, rows.map(row => ({ ...row, status: normalizeStatus('asset', row.status, 'OPERATING') })), 'assetnum'))} />}
            {access.create && <Button onClick={() => setAdding(true)}><Plus size={17} />Add asset</Button>}
          </div>
        )}
      />

      <ImportNotice fileName={imported} subject="asset register" onClear={() => setImported('')} />

      <IndexTabs
        active={tab}
        onChange={value => { setTab(value); setFilters(scopedStandardFilters(user, rows)) }}
        tabs={[
          { key: 'All', label: 'All Assets', count: rows.length },
          { key: 'OPERATING', label: 'Operating', count: rows.filter(row => row.status === 'OPERATING').length },
          { key: 'BROKEN', label: 'Broken', count: rows.filter(row => row.status === 'BROKEN').length },
          { key: 'NOT READY', label: 'Not Ready', count: rows.filter(row => row.status === 'NOT READY').length },
          { key: 'DECOMMISSIONED', label: 'Decommissioned', count: rows.filter(row => row.status === 'DECOMMISSIONED').length },
          { key: 'RETIRED', label: 'Retired', count: rows.filter(row => row.status === 'RETIRED').length }
        ]}
      />
      <StandardFilters
        filters={filters}
        setFilters={setFilters}
        siteOptions={optionsFromRows(rows, ['site'])}
        departmentOptions={optionsFromRows(rows, ['department'])}
        statusOptions={optionsFromRows(rows, ['status'])}
      />

      <TablePanel>
        <DataTable
          rows={visibleRows}
          rowKey="assetnum"
          onRowClick={open}
          pagination
          columns={[
            { key: 'assetnum', label: 'Asset ID', render: value => (
              <span className="flex items-center gap-2">
                <strong className="mono">{value}</strong>
                {value && !conformsToAssetCode(value) && <Badge tone="orange">Code</Badge>}
              </span>
            ) },
            { key: 'description', label: 'Description' },
            { key: 'location', label: 'Location' },
            { key: 'site', label: 'Site' },
            { key: 'department', label: 'Department' },
            { key: 'system', label: 'System' },
            { key: 'modelnum', label: 'Model' },
            { key: 'prioity', label: 'Priority', render: value => <PriorityBadge value={value} /> },
            { key: 'status', label: 'Status', render: value => <StatusBadge application="asset" value={value} /> }
          ]}
        />
      </TablePanel>

      {adding && <AddAssetModal form={form} setForm={setForm} rows={rows} error={codeError} siteRecords={siteRecords} departmentRecords={departmentRecords} locationRows={locationRows} onClose={() => { setAdding(false); setCodeError('') }} onSave={save} />}
    </>
  )
}


import { useState } from 'react'
import { Plus } from 'lucide-react'
import AddToolModal from '../components/tools/AddToolModal'
import ToolDetailPage from '../components/tools/ToolDetailPage'
import Badge from '../components/ui/Badge'
import Button from '../components/ui/Button'
import DataTable from '../components/ui/DataTable'
import ExcelImportButton from '../components/ui/ExcelImportButton'
import ExcelTemplateButton from '../components/ui/ExcelTemplateButton'
import ImportNotice from '../components/ui/ImportNotice'
import IndexTabs from '../components/ui/IndexTabs'
import PageHeader from '../components/ui/PageHeader'
import StandardFilters from '../components/ui/StandardFilters'
import { applyStandardFilters, emptyStandardFilters, optionsFromRows } from '../lib/standardFilters'

const empty = {
  toolNumber: '',
  description: '',
  category: '',
  location: '',
  quantity: 1,
  status: 'Available',
  inspectionDue: ''
}
const templateHeaders = Object.keys(empty)
const toolUsageMap = {
  'TOOL-0001': [
    { workOrder: '56545132', quantity: 1, type: 'CM', status: 'INPRG' },
    { workOrder: 'PM-ALS-HV-00001-2026-01', quantity: 1, type: 'PM', status: 'COMP' }
  ],
  'TOOL-0002': [
    { workOrder: 'PM-MS-MEC-FCU-001-2026-01', quantity: 1, type: 'PM', status: 'CLOSE' }
  ],
  'TOOL-0003': [
    { workOrder: 'PM-MS-MEC-SAU-001-2026-01', quantity: 1, type: 'PM', status: 'APPR' }
  ],
  'TOOL-0004': [
    { workOrder: 'PM-MS-MEC-FDA-001-2026-01', quantity: 1, type: 'PM', status: 'WAPPR' }
  ],
  'TOOL-0005': [
    { workOrder: 'PMKG-L00-19-2026-01', quantity: 2, type: 'PM', status: 'COMP' }
  ]
}

const toolUsage = (tool, workOrders = []) => (toolUsageMap[tool.toolNumber] || []).map((usage, index) => {
  const findWorkOrder = reference => workOrders.find(order => String(order.WORKORDER || order['WORK ORDER']) === String(reference))
  const order = findWorkOrder(usage.workOrder)
  return {
    reference: usage.workOrder,
    description: order?.['DESCRIPITION '] || order?.DESCRIPTION || `${tool.description} usage`,
    workType: usage.type,
    quantity: usage.quantity,
    status: order?.STATUS || usage.status,
    site: order?.SITE || '1031',
    department: order?.['DEPARTMENT '] || tool.category,
    source: index === 0 ? 'Actual tool use' : 'Planned / allocated'
  }
})

export default function ToolsPage({ rows = [], setRows, workOrders = [], onUpdateTool }) {
  const [adding, setAdding] = useState(false)
  const [form, setForm] = useState(empty)
  const [imported, setImported] = useState('')
  const [tab, setTab] = useState('All')
  const [filters, setFilters] = useState(emptyStandardFilters)
  const routeId = decodeURIComponent(window.location.pathname.split('/tools/')[1] || '')
  const [selected, setSelected] = useState(rows.find(row => row.toolNumber === routeId) || null)
  const tabRows = tab === 'All' ? rows : rows.filter(row => row.status === tab)
  const visibleRows = applyStandardFilters(tabRows, filters, {
    site: ['site', 'location'],
    department: ['department', 'category'],
    status: ['status'],
    date: ['inspectionDue']
  })

  const open = row => {
    setSelected(row)
    window.history.pushState({}, '', `/tools/${row.toolNumber}`)
  }

  const close = () => {
    setSelected(null)
    window.history.pushState({}, '', '/tools')
  }

  const updateTool = (toolNumber, patch) => {
    if (onUpdateTool) onUpdateTool(toolNumber, patch)
    else setRows?.(current => current.map(row => row.toolNumber === toolNumber ? { ...row, ...patch } : row))
    setSelected(current => current?.toolNumber === toolNumber ? { ...current, ...patch } : current)
  }

  const save = () => {
    if (!form.toolNumber || !form.description) return
    const row = { ...form, quantity: Number(form.quantity) }
    setRows?.(current => [...current, row])
    setAdding(false)
    setForm(empty)
    open(row)
  }

  if (selected) {
    return <ToolDetailPage tool={selected} usageRows={toolUsage(selected, workOrders)} onBack={close} onUpdate={updateTool} />
  }

  return (
    <>
      <PageHeader
        eyebrow="RESOURCE MASTER DATA"
        title="Tools & Equipment"
        description="Maintain tools, equipment locations, quantities, status, and inspections."
        actions={(
          <div className="flex items-center gap-2">
            <ExcelTemplateButton headers={templateHeaders} fileName="Tools_Equipment_Template.xlsx" />
            <ExcelImportButton fileName={imported} onFile={setImported} onImport={rows => setRows(rows)} />
            <Button onClick={() => setAdding(true)}><Plus size={17} />Add tool or equipment</Button>
          </div>
        )}
      />

      <ImportNotice fileName={imported} subject="tools and equipment" onClear={() => setImported('')} />

      <IndexTabs
        active={tab}
        onChange={value => { setTab(value); setFilters(emptyStandardFilters) }}
        tabs={[
          { key: 'All', label: 'All Tools', count: rows.length },
          { key: 'Available', label: 'Available', count: rows.filter(row => row.status === 'Available').length },
          { key: 'Allocated', label: 'Allocated', count: rows.filter(row => row.status === 'Allocated').length },
          { key: 'Maintenance', label: 'Maintenance', count: rows.filter(row => row.status === 'Maintenance').length }
        ]}
      />
      <StandardFilters
        filters={filters}
        setFilters={setFilters}
        siteOptions={optionsFromRows(rows, ['site', 'location'])}
        departmentOptions={optionsFromRows(rows, ['department', 'category'])}
        statusOptions={optionsFromRows(rows, ['status'])}
      />

      <section className="overflow-hidden rounded-2xl border border-[var(--app-line)] bg-white shadow-[0_8px_24px_rgba(32,55,45,.06)]">
        <DataTable
          rows={visibleRows}
          rowKey="toolNumber"
          onRowClick={open}
          pagination
          columns={[
            { key: 'toolNumber', label: 'Tool number', render: value => <strong className="mono">{value}</strong> },
            { key: 'description', label: 'Description' },
            { key: 'category', label: 'Category' },
            { key: 'location', label: 'Location' },
            { key: 'quantity', label: 'Quantity' },
            { key: 'status', label: 'Status', render: value => <Badge tone={value === 'Available' ? 'green' : 'orange'}>{value}</Badge> },
            { key: 'inspectionDue', label: 'Inspection due' }
          ]}
        />
      </section>

      {adding && <AddToolModal form={form} setForm={setForm} onClose={() => setAdding(false)} onSave={save} />}
    </>
  )
}

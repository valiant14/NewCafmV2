import { useEffect, useMemo, useState } from 'react'
import { Plus } from 'lucide-react'
import AddToolModal from '../components/tools/AddToolModal'
import ToolDetailPage from '../components/tools/ToolDetailPage'
import Badge from '../components/ui/Badge'
import Button from '../components/ui/Button'
import DataTable from '../components/ui/DataTable'
import ExcelImportButton from '../components/ui/ExcelImportButton'
import ExcelTemplateButton from '../components/ui/ExcelTemplateButton'
import ExportExcelButton from '../components/ui/ExportExcelButton'
import ImportNotice from '../components/ui/ImportNotice'
import IndexTabs from '../components/ui/IndexTabs'
import PageHeader from '../components/ui/PageHeader'
import TablePanel from '../components/ui/TablePanel'
import StandardFilters from '../components/ui/StandardFilters'
import { applyStandardFilters, emptyStandardFilters, optionsFromRows } from '../lib/standardFilters'
import { mergeImportedRows } from '../lib/importRows'
import useModuleAccess from '../hooks/useModuleAccess'

const empty = {
  toolNumber: '',
  description: '',
  category: '',
  location: '',
  quantity: 1,
  lowLevel: 0,
  status: 'Available',
  inspectionDue: ''
}
const templateHeaders = Object.keys(empty)
const exportColumns = [
  { key: 'toolNumber', label: 'Tool Number' },
  { key: 'description', label: 'Description' },
  { key: 'category', label: 'Category' },
  { key: 'unit', label: 'Unit' },
  { key: 'stores', label: 'Stores' },
  { key: 'balance', label: 'Balance' },
  { key: 'reservedQuantity', label: 'Reserved' },
  { key: 'availableQuantity', label: 'Available' },
  { key: 'lowLevel', label: 'Low Level' },
  { key: 'availability', label: 'Availability' },
  { key: 'toolStatus', label: 'Tool Status' }
]
const sameTool = (row, id) => String(row.toolNumber || '').trim().toLowerCase() === String(id || '').trim().toLowerCase()
const cleanCode = value => String(value || '').trim().toLowerCase()
const toolStatusTone = value => value === 'Available' ? 'green' : 'orange'
const matchesTool = (tool, value, description) =>
  cleanCode(tool.toolNumber) === cleanCode(value) ||
  cleanCode(tool.description) === cleanCode(value) ||
  cleanCode(tool.description) === cleanCode(description)

const toolUsage = (tool, workOrders, resourceRequests = []) => {
  const nested = workOrders.flatMap(order => {
  const resources = Array.isArray(order['PLANNED RESOURCES']) ? order['PLANNED RESOURCES'] : []
  return resources
    .filter(resource => ['Tool', 'Equipment'].includes(resource.type))
    .filter(resource => String(resource.itemCode || resource.item || '').trim() === String(tool.toolNumber || tool.description || '').trim() || String(resource.item || '').trim() === String(tool.description || '').trim())
    .map((resource, index) => ({
      reference: `${order.WORKORDER}-${resource.transactionRef || resource.item || index}`,
      workOrder: order.WORKORDER,
      description: order?.['DESCRIPITION '] || order?.DESCRIPTION || `${tool.description} usage`,
      workType: String(order['WORK TYPE '] || order['WORK TYPE  '] || 'CM').trim(),
      quantity: resource.quantity || resource.requestedQuantity || 0,
      status: order?.STATUS || resource.requestStatus || '',
      site: order?.SITE || '',
      department: order?.['DEPARTMENT '] || '',
      source: resource.transactionRef || resource.supplyChainStatus || resource.requestStatus || 'Planned resource'
    }))
  })
  const direct = resourceRequests
    .filter(resource => ['Tool', 'Equipment'].includes(resource.type))
    .filter(resource => matchesTool(tool, resource.itemCode || resource.item, resource.item))
    .map(resource => ({
      reference: resource.resourceRequestId || `${resource.workOrder}-${resource.transactionRef || resource.item}`,
      workOrder: resource.workOrder,
      description: resource.item || tool.description,
      workType: '',
      quantity: resource.quantity || resource.requestedQuantity || 0,
      status: resource.requestStatus || '',
      site: resource.site || '',
      department: resource.department || '',
      source: resource.transactionRef || resource.supplyChainStatus || resource.requestStatus || 'Planned resource'
    }))
  return [...new Map([...nested, ...direct].map(row => [String(row.reference), row])).values()]
}
const activeAllocationsFor = (tool, allocations = []) => allocations.filter(allocation => {
  if (allocation.type === 'Material') return false
  if (String(allocation.reservation || '').startsWith('RSV-')) return false
  if (['CANCELLED', 'CAN'].includes(allocation.status)) return false
  return matchesTool(tool, allocation.itemCode || allocation.item, allocation.item)
})

const storeCodeFor = (value, storeRows = []) => {
  const raw = String(value || '').trim()
  const matched = storeRows
    .filter(store => !/^\d+$/.test(String(store.code || '').trim()) && !/^\d+$/.test(String(store.name || '').trim()))
    .find(store => [store.code, store.name].some(item => cleanCode(item) === cleanCode(raw)))
  return matched?.code || ''
}

const defaultToolLocation = (storeRows = []) => {
  const validStores = storeRows.filter(store => !/^\d+$/.test(String(store.code || '').trim()) && !/^\d+$/.test(String(store.name || '').trim()))
  const store = validStores.find(row => row.status !== 'Inactive') || validStores[0]
  return store?.code || store?.name || ''
}

const normalizedToolLocation = (value, storeRows = [], activeAllocations = []) => {
  const raw = String(value || '').trim()
  const allocationSource = String(activeAllocations.find(allocation => allocation.source)?.source || '').trim()
  const candidate = raw && !/^\d+$/.test(raw) ? raw : allocationSource
  return storeCodeFor(candidate, storeRows) || (candidate && !/^\d+$/.test(candidate) ? candidate : defaultToolLocation(storeRows))
}

const withToolUsage = (row, workOrders, allocations = [], storeRows = []) => {
  const activeAllocations = activeAllocationsFor(row, allocations)
  const quantity = Number(row.quantity) || 1
  const reservedQuantity = row.status === 'Maintenance' ? 0 : activeAllocations.reduce((total, allocation) => total + Math.max(0, Number(allocation.quantity || 0) - Number(allocation.deliveredQuantity || 0)), 0)
  const allocatedQuantity = row.status === 'Maintenance' ? 0 : activeAllocations.reduce((total, allocation) => total + (Number(allocation.deliveredQuantity || 0) || Number(allocation.releasedQuantity || 0) || Number(allocation.arrangedQuantity || 0) || 0), 0)
  const committedQuantity = allocatedQuantity + reservedQuantity
  const availableQuantity = row.status === 'Maintenance' ? 0 : Math.max(0, quantity - committedQuantity)
  const status = row.status === 'Maintenance' ? 'Maintenance' : allocatedQuantity > 0 ? 'Allocated' : reservedQuantity > 0 ? 'Reserved' : availableQuantity <= 0 ? 'Allocated' : 'Available'
  const lowLevel = Number(row.lowLevel || 0)
  const availability = status === 'Maintenance' ? 'Maintenance' : availableQuantity <= 0 ? 'No Stock' : availableQuantity <= lowLevel ? 'Low Stock' : 'Available'
  const location = normalizedToolLocation(row.location, storeRows, activeAllocations)
  return {
    ...row,
    unit: row.unit || 'EA',
    location,
    stores: location,
    balance: quantity,
    quantity,
    lowLevel,
    allocatedQuantity,
    reservedQuantity,
    availableQuantity,
    availability,
    toolStatus: status,
    status,
    inspectionDue: row.inspectionDue || '',
    inspectionDueLabel: row.inspectionDue || 'Not scheduled'
  }
}

export default function ToolsPage({ rows = [], setRows, workOrders = [], resourceRequests = [], allocations = [], storeRows = [], purchaseRequests = [], purchaseOrders = [], onCreateRequest }) {
  const access = useModuleAccess('Tools & Equipment')
  const [adding, setAdding] = useState(false)
  const [form, setForm] = useState(empty)
  const [imported, setImported] = useState('')
  const [tab, setTab] = useState('All')
  const [filters, setFilters] = useState(emptyStandardFilters)
  const routeId = decodeURIComponent(window.location.pathname.split('/tools/')[1] || '')
  const [selected, setSelected] = useState(rows.find(row => sameTool(row, routeId)) || null)
  const enrichedRows = useMemo(() => rows.map(row => withToolUsage(row, workOrders, allocations, storeRows)), [rows, workOrders, allocations, storeRows])
  const selectedTool = selected ? withToolUsage(rows.find(row => sameTool(row, selected.toolNumber)) || selected, workOrders, allocations, storeRows) : null
  useEffect(() => {
    if (!routeId) {
      setSelected(null)
      return
    }
    setSelected(rows.find(row => sameTool(row, routeId)) || null)
  }, [rows, routeId])
  const tabRows = tab === 'All' ? enrichedRows : enrichedRows.filter(row => row.status === tab)
  const visibleRows = applyStandardFilters(tabRows, filters, {
    site: ['site', 'location'],
    department: ['department', 'category'],
    status: ['status'],
    date: ['inspectionDue']
  })

  const open = row => {
    setSelected(row)
    window.history.pushState({}, '', `/tools/${encodeURIComponent(row.toolNumber)}`)
  }

  const close = () => {
    setSelected(null)
    window.history.pushState({}, '', '/tools')
  }

  const updateTool = (toolNumber, patch) => {
    setRows?.(current => current.map(row => sameTool(row, toolNumber) ? { ...row, ...patch } : row))
    setSelected(current => sameTool(current || {}, toolNumber) ? { ...current, ...patch } : current)
  }

  const save = () => {
    if (!form.toolNumber || !form.description) return
    const row = { ...form, quantity: Number(form.quantity), lowLevel: Number(form.lowLevel || 0) }
    setRows?.(current => [...current, row])
    setAdding(false)
    setForm(empty)
    open(row)
  }

  if (selectedTool) {
    return <ToolDetailPage tool={selectedTool} usageRows={toolUsage(selectedTool, workOrders, resourceRequests)} purchaseRequests={purchaseRequests} purchaseOrders={purchaseOrders} onBack={close} onUpdate={updateTool} onCreateRequest={onCreateRequest} />
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
            <ExportExcelButton module="Tools_Equipment" rows={visibleRows} columns={exportColumns} />
            {access.import && <ExcelImportButton fileName={imported} onFile={setImported} onImport={rows => setRows(current => mergeImportedRows(current, rows, 'toolNumber'))} />}
            {access.create && <Button onClick={() => setAdding(true)}><Plus size={17} />Add tool or equipment</Button>}
          </div>
        )}
      />

      <ImportNotice fileName={imported} subject="tools and equipment" onClear={() => setImported('')} />

      <IndexTabs
        active={tab}
        onChange={value => { setTab(value); setFilters(emptyStandardFilters) }}
        tabs={[
          { key: 'All', label: 'All Tools', count: rows.length },
          { key: 'Available', label: 'Available', count: enrichedRows.filter(row => row.status === 'Available').length },
          { key: 'Allocated', label: 'Allocated', count: enrichedRows.filter(row => row.status === 'Allocated').length },
          { key: 'Maintenance', label: 'Maintenance', count: enrichedRows.filter(row => row.status === 'Maintenance').length }
        ]}
      />
      <StandardFilters
        filters={filters}
        setFilters={setFilters}
        siteOptions={optionsFromRows(enrichedRows, ['site', 'location'])}
        departmentOptions={optionsFromRows(rows, ['department', 'category'])}
        statusOptions={optionsFromRows(enrichedRows, ['status'])}
      />

      <TablePanel>
        <DataTable
          rows={visibleRows}
          rowKey="toolNumber"
          onRowClick={open}
          pagination
          columns={[
            { key: 'toolNumber', label: 'Tool number', render: value => <strong className="mono">{value}</strong> },
            { key: 'description', label: 'Description' },
            { key: 'category', label: 'Category' },
            { key: 'unit', label: 'Unit' },
            { key: 'stores', label: 'Stores' },
            { key: 'balance', label: 'Balance' },
            { key: 'reservedQuantity', label: 'Reserved' },
            { key: 'availableQuantity', label: 'Available' },
            { key: 'lowLevel', label: 'Low level' },
            { key: 'availability', label: 'Availability', render: value => <Badge tone={toolStatusTone(value)}>{value}</Badge> },
            { key: 'toolStatus', label: 'Tool Status', render: value => <Badge tone={toolStatusTone(value)}>{value}</Badge> }
          ]}
        />
      </TablePanel>

      {adding && <AddToolModal form={form} setForm={setForm} onClose={() => setAdding(false)} onSave={save} />}
    </>
  )
}


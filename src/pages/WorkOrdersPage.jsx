import { useState } from 'react'
import { Plus, Printer } from 'lucide-react'
import CreateWorkOrderModal from '../components/work-orders/CreateWorkOrderModal'
import WorkOrdersTable from '../components/work-orders/WorkOrdersTable'
import Button from '../components/ui/Button'
import ExcelImportButton from '../components/ui/ExcelImportButton'
import ExcelTemplateButton from '../components/ui/ExcelTemplateButton'
import ImportNotice from '../components/ui/ImportNotice'
import IndexTabs from '../components/ui/IndexTabs'
import PageHeader from '../components/ui/PageHeader'

const workOrderTemplateHeaders = ['WORKORDER', 'DESCRIPITION ', 'LONG DESCRIPTION', 'STATUS', 'WORK TYPE ', 'PRIORTY', 'SITE', 'DEPARTMENT ', 'SUB DEPARTMENT  NAME', 'LOCATION ', 'ASSET', 'TARGET START ', 'TARGET FINISH ', 'ACTUAL START ', 'ACTUAL FINISH ', 'FAILURE CODE', 'PROBLEM CODE']

export default function WorkOrdersPage({ rows, assets, onCreate, onImportRows, EditorComponent, excelDate }) {
  const [selected, setSelected] = useState(() => {
    const id = decodeURIComponent(window.location.pathname.split('/work-orders/')[1] || '')
    return rows.find(order => String(order.WORKORDER) === id) || null
  })
  const [typeFilter, setTypeFilter] = useState('All')
  const [creating, setCreating] = useState(() => window.location.pathname === '/work-orders/new')
  const [imported, setImported] = useState('')
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)
  const [sort, setSort] = useState({ key: 'WORKORDER', direction: 'asc' })

  const orderType = order => (order['WORK TYPE '] || order['WORK TYPE  '] || 'PM').trim()
  const filtered = rows.filter(order => typeFilter === 'All' || orderType(order) === typeFilter)
  const sortValue = (order, key) => {
    if (key === 'WORK TYPE') return orderType(order)
    if (key === 'DESCRIPITION') return order['DESCRIPITION ']
    if (key === 'LOCATION') return order['LOCATION ']
    if (key === 'DEPARTMENT') return order['DEPARTMENT ']
    if (key === 'TARGET START') return order['TARGET START ']
    if (key === 'TARGET FINISH') return order['TARGET FINISH ']
    if (key === 'ACTUAL START') return order['ACTUAL START ']
    if (key === 'ACTUAL FINISH') return order['ACTUAL FINISH ']
    if (key === 'REPORTED DATE') return order['REPORTED DATE ']
    return order[key]
  }
  const sorted = [...filtered].sort((a, b) => {
    const left = sortValue(a, sort.key) ?? ''
    const right = sortValue(b, sort.key) ?? ''
    const result = String(left).localeCompare(String(right), undefined, { numeric: true, sensitivity: 'base' })
    return sort.direction === 'asc' ? result : -result
  })
  const toggleSort = key => {
    setSort(current => current.key === key ? { key, direction: current.direction === 'asc' ? 'desc' : 'asc' } : { key, direction: 'asc' })
    setPage(1)
  }
  const pageCount = Math.max(1, Math.ceil(sorted.length / pageSize))
  const currentPage = Math.min(page, pageCount)
  const paginated = sorted.slice((currentPage - 1) * pageSize, currentPage * pageSize)
  const count = type => rows.filter(order => type === 'All' || orderType(order) === type).length

  const openOrder = order => {
    setSelected(order)
    window.history.pushState({}, '', `/work-orders/${order.WORKORDER || 'new'}`)
  }
  const closeOrder = () => {
    setSelected(null)
    window.history.pushState({}, '', '/work-orders')
  }
  const openCreate = () => {
    setCreating(true)
    window.history.pushState({}, '', '/work-orders/new')
  }
  const closeCreate = () => {
    setCreating(false)
    window.history.pushState({}, '', '/work-orders')
  }
  const create = form => {
    const created = onCreate(form)
    setCreating(false)
    setSelected(created)
    window.history.replaceState({}, '', `/work-orders/${created.WORKORDER}`)
  }

  const listView = (
    <div>
      <PageHeader
        eyebrow="MAINTENANCE OPERATIONS"
        title="Work Orders"
        description="Track, plan, execute, and close every maintenance work order."
        actions={<div className="flex items-center gap-2"><ExcelTemplateButton headers={workOrderTemplateHeaders} fileName="Work_Orders_Template.xlsx" /><ExcelImportButton fileName={imported} onFile={setImported} onImport={importedRows => onImportRows?.(importedRows)} /><Button variant="outline"><Printer size={16} /> Print list</Button><Button onClick={openCreate}><Plus size={17} />New work order</Button></div>}
      />
      <ImportNotice fileName={imported} subject="work order" onClear={() => setImported('')} />
      <IndexTabs
        active={typeFilter}
        onChange={type => { setTypeFilter(type); setPage(1) }}
        tabs={['All', 'PM', 'CM', 'Incident'].map(type => ({ key: type, label: type === 'All' ? 'All Work Orders' : type, count: count(type) }))}
      />
      <WorkOrdersTable
        rows={paginated}
        currentPage={currentPage}
        pageSize={pageSize}
        pageCount={pageCount}
        total={filtered.length}
        onOpen={openOrder}
        onPageChange={setPage}
        onPageSizeChange={value => { setPageSize(value); setPage(1) }}
        orderType={orderType}
        excelDate={excelDate}
        sort={sort}
        onSort={toggleSort}
      />
    </div>
  )

  if (selected?.WORKORDER) return <EditorComponent page order={selected} onClose={closeOrder} />
  if (creating) return <>{listView}<CreateWorkOrderModal rows={rows} assets={assets} onCancel={closeCreate} onCreate={create} /></>
  return listView
}

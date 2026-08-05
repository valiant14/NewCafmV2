import { useEffect, useState } from 'react'
import { Plus, Printer } from 'lucide-react'
import CreateWorkOrderModal from '../components/work-orders/CreateWorkOrderModal'
import WorkOrdersTable from '../components/work-orders/WorkOrdersTable'
import Button from '../components/ui/Button'
import ExcelImportButton from '../components/ui/ExcelImportButton'
import ExcelTemplateButton from '../components/ui/ExcelTemplateButton'
import GenericPrintReport from '../components/ui/GenericPrintReport'
import ImportNotice from '../components/ui/ImportNotice'
import IndexTabs from '../components/ui/IndexTabs'
import PageHeader from '../components/ui/PageHeader'
import ExportExcelButton from '../components/ui/ExportExcelButton'
import StandardFilters from '../components/ui/StandardFilters'
import TableSearch from '../components/ui/TableSearch'
import { printWithoutBrowserTitle } from '../lib/print'
import { applyStandardFilters, optionsFromRows, useScopedFilters } from '../lib/standardFilters'
import { statusDescription } from '../lib/statusMatrix'
import { workflowStatusLabel } from '../lib/workOrderWorkflow'
import { filterRows } from '../lib/tableSearch'
import { mergeImportedRows } from '../lib/importRows'
import { useAuth } from '../providers/AuthProvider'

// Restricted to text columns: matching every value would hit Excel date serials and the
// internal task/resource arrays, which produce meaningless results.
const searchKeys = ['WORKORDER', 'DESCRIPITION ', 'LONG DESCRIPTION', 'STATUS', 'STATUS DESCRIPITION', 'WORK TYPE ', 'SITE', 'DEPARTMENT ', 'SUB DEPARTMENT  NAME', 'ASSIGNED DEPARTMENT', 'WORK GROUP', 'SYSTEM', 'LOCATION ', 'ASSET', 'ASSET DESCRIPTION', 'SUPERVISOR', 'SOURCE SR', 'FAILURE CODE', 'PROBLEM CODE']

// excelDate renders a falsy value as an em dash, which is fine on screen but wrong in a
// spreadsheet cell - blank should stay blank.
const exportColumns = excelDate => {
  const asDate = value => (value === null || value === undefined || value === '' ? '' : excelDate(value))
  return [
    { key: 'WORKORDER', label: 'Work Order' },
    { key: 'DESCRIPITION ', label: 'Description' },
    { key: 'WORK TYPE ', label: 'Type' },
    { key: 'STATUS', label: 'Status' },
    { key: 'STATUS DESCRIPITION', label: 'Status Description' },
    { key: 'PRIORTY', label: 'Priority' },
    { key: 'SITE', label: 'Site' },
    { key: 'DEPARTMENT ', label: 'Department' },
    { key: 'SUB DEPARTMENT  NAME', label: 'Sub Department' },
    { key: 'ASSIGNED DEPARTMENT', label: 'Assigned Department' },
    { key: 'WORK GROUP', label: 'Work Group' },
    { key: 'SYSTEM', label: 'System' },
    { key: 'LOCATION ', label: 'Location' },
    { key: 'ASSET', label: 'Asset' },
    { key: 'ASSET DESCRIPTION', label: 'Asset Description' },
    { key: 'TARGET START ', label: 'Target Start', exportValue: asDate },
    { key: 'TARGET FINISH ', label: 'Target Finish', exportValue: asDate },
    { key: 'ACTUAL START ', label: 'Actual Start', exportValue: asDate },
    { key: 'ACTUAL FINISH ', label: 'Actual Finish', exportValue: asDate },
    { key: 'REPORTED DATE ', label: 'Reported Date', exportValue: asDate },
    { key: 'SOURCE SR', label: 'Source Job Request' },
    { key: 'REPORTED BY', label: 'Reported By' },
    { key: 'FAILURE CODE', label: 'Failure Code' },
    { key: 'PROBLEM CODE', label: 'Problem Code' },
    { key: 'CAUSE CODE', label: 'Cause Code' },
    { key: 'REMEDY CODE', label: 'Remedy Code' }
  ]
}

const workOrderTemplateHeaders = ['WORKORDER', 'DESCRIPITION ', 'LONG DESCRIPTION', 'STATUS', 'WORK TYPE ', 'PRIORTY', 'SITE', 'DEPARTMENT ', 'SUB DEPARTMENT  NAME', 'LOCATION ', 'ASSET', 'TARGET START ', 'TARGET FINISH ', 'ACTUAL START ', 'ACTUAL FINISH ', 'FAILURE CODE', 'PROBLEM CODE']

export default function WorkOrdersPage({ rows, assets, locationRows = [], siteRecords = [], departmentRecords = [], onCreate, onImportRows, EditorComponent, excelDate, workflow, access = {} }) {
  const { user } = useAuth()
  const routeId = decodeURIComponent(window.location.pathname.split('/work-orders/')[1] || '')
  const [selected, setSelected] = useState(() => {
    return rows.find(order => String(order.WORKORDER) === routeId) || null
  })
  const [typeFilter, setTypeFilter] = useState('All')
  const [creating, setCreating] = useState(() => window.location.pathname === '/work-orders/new')
  const [imported, setImported] = useState('')
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)
  const [sort, setSort] = useState({ key: 'WORKORDER', direction: 'asc' })
  const [filters, setFilters] = useScopedFilters(user, rows, ['SITE'])
  const [search, setSearch] = useState('')

  useEffect(() => {
    if (routeId === 'new') {
      setCreating(true)
      setSelected(null)
      return
    }
    setCreating(false)
    if (!routeId) {
      setSelected(null)
      return
    }
    setSelected(rows.find(order => String(order.WORKORDER) === routeId) || null)
  }, [rows, routeId])

  const orderType = order => (order['WORK TYPE'] || order['WORK TYPE '] || order['WORK TYPE  '] || 'CM').trim()
  const typedRows = rows.filter(order => typeFilter === 'All' || orderType(order) === typeFilter)
  const scoped = applyStandardFilters(typedRows, filters, {
    site: ['SITE'],
    department: ['DEPARTMENT ', 'ASSIGNED DEPARTMENT', 'SUB DEPARTMENT  NAME'],
    status: ['STATUS'],
    date: ['TARGET START ', 'TARGET FINISH ', 'ACTUAL START ', 'ACTUAL FINISH ', 'REPORTED DATE ']
  })
  const filtered = filterRows(scoped, search, searchKeys)
  const sortValue = (order, key) => {
    if (key === 'WORK TYPE') return orderType(order)
    if (key === 'DESCRIPITION') return order['DESCRIPITION ']
    if (key === 'LOCATION') return order['LOCATION ']
    if (key === 'DEPARTMENT') return order['DEPARTMENT ']
    if (key === 'ASSIGNED DEPARTMENT') return order['ASSIGNED DEPARTMENT']
    if (key === 'SUB DEPARTMENT NAME') return order['SUB DEPARTMENT  NAME']
    if (key === 'SOURCE SR') return order['SOURCE SR']
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
  const create = async form => {
    if (!access.create) return
    const created = await onCreate(form)
    if (!created) return
    setCreating(false)
    setSelected(created)
    window.history.replaceState({}, '', `/work-orders/${created.WORKORDER}`)
  }
  const importRows = importedRows => {
    const importedAt = Date.now()
    const normalized = importedRows.map((row, index) => row.WORKORDER
      ? row
      : { ...row, WORKORDER: `WO-PENDING-${importedAt}-${index + 1}`, __isNew: true })
    return onImportRows?.(current => mergeImportedRows(current, normalized, 'WORKORDER'))
  }
  const printList = () => printWithoutBrowserTitle()

  const listView = (
    <div>
      <div className="print-report-screen">
        <PageHeader
          eyebrow="MAINTENANCE OPERATIONS"
          title="Work Orders"
          description="Track, plan, execute, and close every maintenance work order."
          actions={<div className="flex items-center gap-2"><ExcelTemplateButton headers={workOrderTemplateHeaders} fileName="Work_Orders_Template.xlsx" /><ExportExcelButton module="Work Orders" rows={sorted} columns={exportColumns(excelDate)} />{access.import && <ExcelImportButton fileName={imported} onFile={setImported} onImport={importRows} />}<Button variant="outline" onClick={printList}><Printer size={16} /> Print list</Button>{access.create && <Button onClick={openCreate}><Plus size={17} />New work order</Button>}</div>}
        />
        <ImportNotice fileName={imported} subject="work order" onClear={() => setImported('')} />
        <IndexTabs
          active={typeFilter}
          onChange={type => { setTypeFilter(type); setPage(1) }}
          tabs={['All', 'PM', 'CM', 'Incident'].map(type => ({ key: type, label: type === 'All' ? 'All Work Orders' : type, count: count(type) }))}
          search={(
            <TableSearch
              value={search}
              onChange={value => { setSearch(value); setPage(1) }}
              placeholder="Search work order, asset, location, status"
            />
          )}
        />
        <StandardFilters
          filters={filters}
          setFilters={value => { setFilters(value); setPage(1) }}
          siteOptions={optionsFromRows(rows, ['SITE'])}
          departmentOptions={optionsFromRows(rows, ['DEPARTMENT ', 'ASSIGNED DEPARTMENT', 'SUB DEPARTMENT  NAME'])}
          statusOptions={optionsFromRows(rows, ['STATUS'])}
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
          workflow={workflow}
          sort={sort}
          onSort={toggleSort}
        />
      </div>
      <GenericPrintReport
        reportTitle="Work Order List"
        reportSubtitle="Seder CAFM work order tracking"
        number={`${filtered.length} records`}
        status={typeFilter}
        description="Filtered work order tracking list"
        summary={[['Site Filter', filters.site || 'All'], ['Department Filter', filters.department || 'All'], ['Status Filter', filters.status || 'All']]}
        tables={[{
          title: 'Work Orders',
          columns: [
            { key: 'workOrder', label: 'WO Number' },
            { key: 'description', label: 'Description' },
            { key: 'type', label: 'Type' },
            { key: 'status', label: 'Status' },
            { key: 'site', label: 'Site' },
            { key: 'department', label: 'Department' },
            { key: 'targetStart', label: 'Target Start' }
          ],
          rows: sorted.map(order => ({
            key: order.WORKORDER,
            workOrder: order.WORKORDER,
            description: order['DESCRIPITION '],
            type: orderType(order),
            status: workflowStatusLabel(workflow, order.STATUS) || statusDescription('workOrder', order.STATUS) || order.STATUS,
            site: order.SITE,
            department: order['DEPARTMENT '],
            targetStart: excelDate(order['TARGET START '])
          })),
          emptyText: 'No work orders match the selected filters.'
        }]}
        signatures={['Printed By', 'Reviewed By']}
      />
    </div>
  )

  if (selected?.WORKORDER) return EditorComponent({ page: true, order: selected, onClose: closeOrder })
  if (creating && access.create) return <>{listView}<CreateWorkOrderModal rows={rows} assets={assets} locationRows={locationRows} siteRecords={siteRecords} departmentRecords={departmentRecords} onCancel={closeCreate} onCreate={create} /></>
  return listView
}

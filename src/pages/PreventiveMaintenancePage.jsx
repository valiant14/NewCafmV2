import { useMemo, useState } from 'react'
import { Plus, Sparkles, X } from 'lucide-react'
import PmScheduleDetail from '../components/preventive-maintenance/PmScheduleDetail'
import PmScheduleForm from '../components/preventive-maintenance/PmScheduleForm'
import PmScheduleTable from '../components/preventive-maintenance/PmScheduleTable'
import Button from '../components/ui/Button'
import Alert from '../components/ui/Alert'
import ExcelImportButton from '../components/ui/ExcelImportButton'
import ExcelTemplateButton from '../components/ui/ExcelTemplateButton'
import IndexTabs from '../components/ui/IndexTabs'
import { ModalOverlay } from '../components/ui/ModalFrame'
import PageHeader from '../components/ui/PageHeader'
import StandardFilters from '../components/ui/StandardFilters'
import TableSearch from '../components/ui/TableSearch'
import { applyStandardFilters, optionsFromRows, scopedStandardFilters, useScopedFilters } from '../lib/standardFilters'
import { normalizeStatus, statusDescription, statusTone } from '../lib/statusMatrix'
import { useAuth } from '../providers/AuthProvider'
import { parseLocal, toLocalDateTimeInput } from '../lib/datetime'
import { countPmDueState, pmDueState } from '../lib/pmSchedule'
import { generatePmWorkOrders } from '../lib/pmGeneration'
import { filterRows } from '../lib/tableSearch'
import { scopeRowsForUser } from '../lib/accessControl'

const emptyPlan = {
  pmNumber: '',
  description: '',
  asset: '',
  route: '',
  location: '',
  site: '',
  jobPlan: '',
  startDate: '',
  leadTime: 0,
  frequency: 1,
  freqUnit: 'MONTHS',
  scheduleRule: '',
  pmCounter: 0,
  workType: 'PM',
  woStatus: 'WSCH',
  storeLocation: '',
  supervisor: '',
  lead: '',
  personGroup: '',
  department: '',
  subDepartment: '',
  pmStatus: 'ACTIVE',
  lastGeneratedCycle: ''
}
const searchKeys = ['pmNumber', 'description', 'jobPlan', 'asset', 'location', 'route', 'department', 'subDepartment', 'supervisor', 'personGroup', 'storeLocation', 'workType']

const pmTemplateHeaders = ['PMNUM', 'PM DESCRIPTION', 'ASSETNUM', 'ROUTE', 'LOCATION', 'JPNUM', 'PM RULE', 'NEXTDATE', 'PMCOUNTER', 'WORKTYPE', 'STORELOC', 'SUPERVISOR', 'LEAD', 'PERSONGROUP', 'department', 'sub department']

const normalizeDate = value => {
  if (!value) return ''
  if (parseLocal(value)) return toLocalDateTimeInput(value)
  const match = String(value).match(/^(\d{1,2})-([A-Za-z]{3})-(\d{2,4})$/)
  if (!match) return String(value)
  const months = { Jan: 0, Feb: 1, Mar: 2, Apr: 3, May: 4, Jun: 5, Jul: 6, Aug: 7, Sep: 8, Oct: 9, Nov: 10, Dec: 11 }
  const year = Number(match[3].length === 2 ? `20${match[3]}` : match[3])
  return toLocalDateTimeInput(new Date(year, months[match[2]] ?? 0, Number(match[1])))
}

const findPmRule = (rules = [], name = '') => rules.find(rule => String(rule.name || '').trim().toLowerCase() === String(name || '').trim().toLowerCase())

const mapPmImportRows = (rows, rules = []) => rows.map(row => {
  const scheduleRule = row['PM RULE'] || row.SCHEDULE_RULE || ''
  const rule = findPmRule(rules, scheduleRule)
  return {
    pmNumber: row.PMNUM || '',
    description: row['PM DESCRIPTION'] || '',
    asset: row.ASSETNUM || '',
    route: row.ROUTE || '',
    location: row.LOCATION || '',
    site: row.SITE || '',
    jobPlan: row.JPNUM || '',
    startDate: normalizeDate(row.NEXTDATE),
    leadTime: Number(rule?.leadTimeDays ?? row['LEAD TIME (DAYS)'] ?? 0),
    frequency: Number(rule?.frequency ?? row.FREQUENCY ?? 1),
    freqUnit: rule?.freqUnit || row.FREQUNIT || 'MONTHS',
    scheduleRule,
    pmCounter: Number(row.PMCOUNTER || 0),
    workType: row.WORKTYPE || 'PM',
    woStatus: rule?.defaultWoStatus || row.WOSTATUS || 'WSCH',
    storeLocation: row.STORELOC || '',
    supervisor: row.SUPERVISOR || '',
    lead: row.LEAD || '',
    personGroup: row.PERSONGROUP || '',
    department: row.department || row.DEPARTMENT || '',
    subDepartment: row['sub department'] || row['SUB DEPARTMENT'] || '',
    pmStatus: normalizeStatus('preventiveMaintenance', row['PM Status'] || row.PMSTATUS, 'ACTIVE'),
    lastGeneratedCycle: ''
  }
}).filter(plan => plan.pmNumber && plan.description)

export default function PreventiveMaintenancePage({ rows = [], setRows, pmRules = [], assets = [], jobTasks = [], workOrders = [], departmentRecords = [], locationRows = [], storeRows = [], laborRows = [], scopeUser, onGenerate, onOpenWorkOrder }) {
  const { user } = useAuth()
  const routeId = window.location.pathname.match(/^\/preventive-maintenance\/([^/]+)$/)?.[1]
  const plans = rows.map(plan => ({ ...plan, pmStatus: normalizeStatus('preventiveMaintenance', plan.pmStatus, 'ACTIVE') }))
  const scopedPlans = scopeRowsForUser(plans, scopeUser || user, ['site'], ['department', 'subDepartment', 'personGroup'])
  const [mode, setMode] = useState('list')
  const [selectedId, setSelectedId] = useState(routeId ? decodeURIComponent(routeId) : '')
  const [form, setForm] = useState(emptyPlan)
  const [generation, setGeneration] = useState(null)
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)
  const [pmTab, setPmTab] = useState('All')
  const [sort, setSort] = useState({ key: 'pmNumber', direction: 'asc' })
  const [search, setSearch] = useState('')
  const [filters, setFilters] = useScopedFilters(user, plans, ['site'])

  const jobPlans = useMemo(() => [
    ...new Map(jobTasks
      .filter(task => task.JPNUM)
      .map(task => [task.JPNUM, {
        number: task.JPNUM,
        description: task.DESCRIPTION,
        duration: jobTasks.filter(item => item.JPNUM === task.JPNUM).reduce((sum, item) => sum + Number(item['TASK DURATION IN HOUR'] || 0), 0) * 24
      }])
    ).values()
  ], [jobTasks])

  const selected = scopedPlans.find(plan => plan.pmNumber === selectedId)
  const matchesTab = plan => {
    if (pmTab === 'All') return true
    if (pmTab === 'OVERDUE' || pmTab === 'DUE_SOON') return pmDueState(plan, new Date(), pmRules) === pmTab
    return plan.pmStatus === pmTab
  }
  const tabRows = scopedPlans.filter(matchesTab)
  const searched = filterRows(tabRows, search, searchKeys)
  const visible = applyStandardFilters(searched, filters, {
    site: ['site'],
    department: ['department', 'personGroup'],
    status: ['pmStatus', 'woStatus'],
    date: ['startDate']
  })
  const sorted = [...visible].sort((a, b) => {
    const left = a[sort.key] ?? ''
    const right = b[sort.key] ?? ''
    const result = String(left).localeCompare(String(right), undefined, { numeric: true, sensitivity: 'base' })
    return sort.direction === 'asc' ? result : -result
  })
  const toggleSort = key => {
    setSort(current => current.key === key ? { key, direction: current.direction === 'asc' ? 'desc' : 'asc' } : { key, direction: 'asc' })
    setPage(1)
  }
  const pageCount = Math.max(1, Math.ceil(sorted.length / pageSize))
  const currentPage = Math.min(page, pageCount)
  const visiblePage = sorted.slice((currentPage - 1) * pageSize, currentPage * pageSize)

  const valid = Boolean(form.pmNumber && form.description && (form.asset || form.location) && form.jobPlan && form.startDate && form.frequency && form.freqUnit)
  const save = () => {
    if (!valid) return
    setRows?.(rows => [...rows, form])
    setForm(emptyPlan)
    setMode('list')
  }
  const openPlan = id => {
    setSelectedId(id)
    window.history.pushState({}, '', `/preventive-maintenance/${encodeURIComponent(id)}`)
  }
  const closePlan = () => {
    setSelectedId('')
    window.history.pushState({}, '', '/preventive-maintenance')
  }
  const updatePlan = (pmNumber, patch) => {
    setRows?.(rows => rows.map(plan => plan.pmNumber === pmNumber ? { ...plan, ...patch } : plan))
  }
  const generate = () => setGeneration(generatePmWorkOrders({ plans, rules: pmRules, jobTasks, setRows, onGenerate }))

  if (selected) {
    return <PmScheduleDetail plan={selected} assets={assets} jobTasks={jobTasks} jobPlans={jobPlans} pmRules={pmRules} workOrders={workOrders} onBack={closePlan} onOpenWorkOrder={onOpenWorkOrder} onUpdate={updatePlan} />
  }

  return (
    <section>
      <PageHeader
        eyebrow="PREVENTIVE MAINTENANCE"
        title="PM Schedule"
        description="Maximo-aligned PM masters and automatic work-order generation."
        actions={<div className="flex items-center gap-2"><ExcelTemplateButton headers={pmTemplateHeaders} fileName="PM_Master_Upload_Template.xlsx" /><ExcelImportButton onImport={rows => { const imported = mapPmImportRows(rows, pmRules); if (imported.length) setRows?.(imported) }} /><Button variant="outline" onClick={generate}><Sparkles size={16} />Generate WOs</Button><Button onClick={() => setMode('new')}><Plus size={16} />New PM schedule</Button></div>}
      />

      {generation && (
        <Alert
          className="mb-4"
          tone={generation.length ? 'success' : 'warning'}
          title={generation.length ? `${generation.length} work orders generated` : 'No eligible PM plans'}
          actions={<button className="app-icon-button" onClick={() => setGeneration(null)} aria-label="Dismiss generation result"><X size={16} /></button>}
        >
          Duplicate generation is prevented by PM number and NEXTDATE cycle.
        </Alert>
      )}

      <IndexTabs
        active={pmTab}
        onChange={value => { setPmTab(value); setFilters(scopedStandardFilters(user, plans, ['site'])); setPage(1) }}
        tabs={[
          { key: 'All', label: 'All PM Schedules', count: scopedPlans.length },
          { key: 'OVERDUE', label: 'Overdue', count: countPmDueState(scopedPlans, 'OVERDUE', pmRules) },
          { key: 'DUE_SOON', label: 'Due Soon', count: countPmDueState(scopedPlans, 'DUE_SOON', pmRules) },
          { key: 'ACTIVE', label: 'Active', count: scopedPlans.filter(plan => plan.pmStatus === 'ACTIVE').length },
          { key: 'INACTIVE', label: 'Inactive', count: scopedPlans.filter(plan => plan.pmStatus === 'INACTIVE').length },
          { key: 'DRAFT', label: 'Draft', count: scopedPlans.filter(plan => plan.pmStatus === 'DRAFT').length }
        ]}
      />

      <StandardFilters
        filters={filters}
        setFilters={value => { setFilters(value); setPage(1) }}
        siteOptions={optionsFromRows(scopedPlans, ['site'])}
        departmentOptions={optionsFromRows(scopedPlans, ['department', 'personGroup'])}
        statusOptions={optionsFromRows(scopedPlans, ['pmStatus', 'woStatus'])}
      />

      <TableSearch
        value={search}
        onChange={value => { setSearch(value); setPage(1) }}
        placeholder="Search PM plan, job plan, asset, location"
        resultCount={visible.length}
        totalCount={tabRows.length}
      />

      <PmScheduleTable
        rows={visiblePage}
        currentPage={currentPage}
        pageSize={pageSize}
        pageCount={pageCount}
        total={visible.length}
        onOpen={openPlan}
        onPageChange={setPage}
        onPageSizeChange={value => { setPageSize(value); setPage(1) }}
        sort={sort}
        onSort={toggleSort}
        pmRules={pmRules}
      />
      {mode === 'new' && (
        <ModalOverlay>
          <PmScheduleForm modal form={form} setForm={setForm} assets={assets} jobPlans={jobPlans} departments={departmentRecords} pmRules={pmRules} locations={locationRows} stores={storeRows} labor={laborRows} onCancel={() => setMode('list')} onSave={save} />
        </ModalOverlay>
      )}
    </section>
  )
}

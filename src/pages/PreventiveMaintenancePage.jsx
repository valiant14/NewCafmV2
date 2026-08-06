import { useEffect, useMemo, useState } from 'react'
import { Plus } from 'lucide-react'
import PmScheduleDetail from '../components/preventive-maintenance/PmScheduleDetail'
import PmScheduleForm from '../components/preventive-maintenance/PmScheduleForm'
import PmScheduleTable from '../components/preventive-maintenance/PmScheduleTable'
import Button from '../components/ui/Button'
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
import { filterRows } from '../lib/tableSearch'
import { scopeRowsForUser } from '../lib/accessControl'
import { normalizeWorkOrderWorkflow, workflowStatusOptions } from '../lib/workOrderWorkflow'
import { normalizePmFrequencyUnit, pmWorkOrderStatusLabel } from '../lib/pmGeneration'
import { mergeImportedRows } from '../lib/importRows'
import useModuleAccess from '../hooks/useModuleAccess'
import useRelatedWorkOrders from '../hooks/useRelatedWorkOrders'

const emptyPlan = initialStatus => ({
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
  woStatus: initialStatus,
  storeLocation: '',
  supervisor: '',
  lead: '',
  personGroup: '',
  department: '',
  subDepartment: '',
  pmStatus: 'ACTIVE',
  lastGeneratedCycle: ''
})
const searchKeys = ['pmNumber', 'description', 'jobPlan', 'asset', 'location', 'route', 'department', 'subDepartment', 'supervisor', 'personGroup', 'storeLocation', 'workType']

const pmTemplateHeaders = ['PMNUM', 'PM DESCRIPTION', 'ASSETNUM', 'LOCATION', 'SITE', 'JPNUM', 'PM RULE', 'START DATE', 'LEAD TIME (DAYS)', 'FREQUENCY', 'FREQUNIT', 'WOSTATUS', 'DEPARTMENT', 'SUB DEPARTMENT', 'PM STATUS', 'ROUTE', 'STORELOC', 'SUPERVISOR', 'LEAD', 'PERSONGROUP']

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

const pmInitialStatusOptions = workflow => [
  ...workflowStatusOptions(workflow),
  { value: 'ON_HOLD_MATERIAL', label: pmWorkOrderStatusLabel('ON_HOLD_MATERIAL') },
  { value: 'ON_HOLD_PERMIT', label: pmWorkOrderStatusLabel('ON_HOLD_PERMIT') }
]

const validWorkflowStatus = (value, workflow) => {
  const code = String(value || '').trim().toUpperCase()
  const options = pmInitialStatusOptions(workflow)
  const waiting = options.some(option => option.value === 'WSCH') ? 'WSCH' : workflow.initialStatus
  const alias = ({ WAITING: 'WSCH', ASSIGNED: 'SCHED', 'IN PROGRESS': 'INPRG', COMPLETED: 'COMP', CLOSED: 'CLOSE', 'WAITING FOR MATERIAL': 'ON_HOLD_MATERIAL', 'WAITING FOR PERMIT': 'ON_HOLD_PERMIT' })[code] || code
  return options.some(option => option.value === alias) ? alias : waiting
}

const mapPmImportRows = (rows, rules = [], workflow) => rows.map(row => {
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
    startDate: normalizeDate(row['START DATE'] || row.NEXTDATE),
    leadTime: Number(rule?.leadTimeDays ?? row['LEAD TIME (DAYS)'] ?? 0),
    frequency: Number(rule?.frequency ?? (Number(row.FREQUENCY) || 1)),
    freqUnit: normalizePmFrequencyUnit(rule?.freqUnit || row.FREQUNIT || (!Number(row.FREQUENCY) ? row.FREQUENCY : '') || 'MONTHS'),
    scheduleRule,
    pmCounter: Number(row.PMCOUNTER || 0),
    workType: row.WORKTYPE || 'PM',
    woStatus: validWorkflowStatus(rule?.defaultWoStatus || row.WOSTATUS, workflow),
    storeLocation: row.STORELOC || '',
    supervisor: row.SUPERVISOR || '',
    lead: row.LEAD || '',
    personGroup: row.PERSONGROUP || '',
    department: row.department || row.DEPARTMENT || '',
    subDepartment: row['sub department'] || row['SUB DEPARTMENT'] || '',
    pmStatus: normalizeStatus('preventiveMaintenance', row['PM STATUS'] || row['PM Status'] || row.PMSTATUS, 'ACTIVE'),
    lastGeneratedCycle: ''
  }
})

const validatePmImportRows = (plans, rules = []) => {
  const seen = new Set()
  plans.forEach((plan, index) => {
    const missing = [
      !plan.pmNumber && 'PMNUM',
      !plan.description && 'PM DESCRIPTION',
      !plan.asset && !plan.location && 'ASSETNUM or LOCATION',
      !plan.site && 'SITE',
      !plan.jobPlan && 'JPNUM',
      !parseLocal(plan.startDate) && 'START DATE',
      !(Number(plan.frequency) > 0) && 'FREQUENCY',
      !plan.freqUnit && 'FREQUNIT',
      !plan.department && 'DEPARTMENT',
      !plan.subDepartment && 'SUB DEPARTMENT'
    ].filter(Boolean)
    if (missing.length) throw new Error(`PM import row ${index + 2} is incomplete: ${missing.join(', ')}.`)
    if (!Number.isFinite(Number(plan.leadTime)) || Number(plan.leadTime) < 0) {
      throw new Error(`PM import row ${index + 2} has an invalid LEAD TIME (DAYS).`)
    }
    if (plan.scheduleRule && !findPmRule(rules, plan.scheduleRule)) {
      throw new Error(`PM import row ${index + 2} references an unknown PM RULE: ${plan.scheduleRule}.`)
    }
    const key = String(plan.pmNumber).trim().toUpperCase()
    if (seen.has(key)) throw new Error(`PM import row ${index + 2} repeats PMNUM ${plan.pmNumber}.`)
    seen.add(key)
  })
}

export default function PreventiveMaintenancePage({ rows = [], setRows, onImport, pmRules = [], assets = [], jobPlans: jobPlanMasters = [], jobTasks = [], workOrders = [], departmentRecords = [], locationRows = [], storeRows = [], laborRows = [], workflow, scopeUser, onOpenWorkOrder }) {
  const { user } = useAuth()
  const access = useModuleAccess('Preventive Maintenance')
  const activeWorkflow = useMemo(() => normalizeWorkOrderWorkflow(workflow), [workflow])
  const routeId = window.location.pathname.match(/^\/preventive-maintenance\/([^/]+)$/)?.[1]
  const plans = rows.map(plan => ({
    ...plan,
    pmStatus: normalizeStatus('preventiveMaintenance', plan.pmStatus, 'ACTIVE'),
    woStatus: validWorkflowStatus(plan.woStatus, activeWorkflow)
  }))
  const scopedPlans = scopeRowsForUser(plans, scopeUser || user, ['site'], ['department', 'subDepartment', 'personGroup'])
  const [mode, setMode] = useState('list')
  const [selectedId, setSelectedId] = useState(routeId ? decodeURIComponent(routeId) : '')
  const relatedWorkOrders = useRelatedWorkOrders(selectedId ? { pm_num: selectedId } : null, { enabled: Boolean(selectedId) })
  const waitingStatus = validWorkflowStatus('WSCH', activeWorkflow)
  const [form, setForm] = useState(() => emptyPlan(waitingStatus))
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)
  const [pmTab, setPmTab] = useState('All')
  const [sort, setSort] = useState({ key: 'pmNumber', direction: 'asc' })
  const [search, setSearch] = useState('')
  const [filters, setFilters] = useScopedFilters(user, plans, ['site'])

  useEffect(() => {
    setSelectedId(routeId ? decodeURIComponent(routeId) : '')
  }, [routeId])

  const jobPlans = useMemo(() => [
    ...new Map([...jobPlanMasters, ...jobTasks]
      .filter(row => row.JPNUM)
      .map(row => {
        const master = jobPlanMasters.find(item => item.JPNUM === row.JPNUM)
        const taskDuration = jobTasks.filter(item => item.JPNUM === row.JPNUM).reduce((sum, item) => sum + Number(item['TASK DURATION IN HOUR'] || 0), 0)
        const masterDuration = Number(master?.estimatedDurationMinutes || 0) / 60
        return [row.JPNUM, {
          ...master,
          number: row.JPNUM,
          description: master?.DESCRIPTION || row.DESCRIPTION,
          duration: masterDuration || taskDuration
        }]
      })
    ).values()
  ], [jobPlanMasters, jobTasks])

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

  const valid = Boolean(form.pmNumber && form.description && (form.asset || form.location) && form.site && form.jobPlan && form.startDate && form.frequency && form.freqUnit && form.department && form.subDepartment)
  const save = async () => {
    if (!valid) return
    const result = await setRows?.(rows => [...rows, form])
    if (!result || result.__saveError) return
    setForm(emptyPlan(waitingStatus))
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
  if (selected) {
    return <PmScheduleDetail plan={selected} assets={assets} jobTasks={jobTasks} jobPlans={jobPlans} pmRules={pmRules} workOrders={relatedWorkOrders.rows} workflow={activeWorkflow} onBack={closePlan} onOpenWorkOrder={onOpenWorkOrder} onUpdate={updatePlan} />
  }

  return (
    <section>
      <PageHeader
        eyebrow="PREVENTIVE MAINTENANCE"
        title="PM Schedule"
        description="Maximo-aligned PM masters and automatic work-order generation."
          actions={<div className="flex items-center gap-2"><ExcelTemplateButton headers={pmTemplateHeaders} fileName="PM_Master_Upload_Template.xlsx" />{access.import && <ExcelImportButton onImport={async importedRows => {
            const imported = mapPmImportRows(importedRows, pmRules, activeWorkflow)
            validatePmImportRows(imported, pmRules)
            const result = onImport
              ? await onImport(imported)
              : await setRows?.(current => mergeImportedRows(current, imported, 'pmNumber'))
            if (!result || result.__saveError) throw result?.error || new Error('Unable to save the PM master import.')
          }} />}{access.create && <Button onClick={() => { setForm(emptyPlan(waitingStatus)); setMode('new') }}><Plus size={16} />New PM schedule</Button>}</div>}
      />

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
        search={(
          <TableSearch
            value={search}
            onChange={value => { setSearch(value); setPage(1) }}
            placeholder="Search PM plan, job plan, asset, location"
          />
        )}
      />

      <StandardFilters
        filters={filters}
        setFilters={value => { setFilters(value); setPage(1) }}
        siteOptions={optionsFromRows(scopedPlans, ['site'])}
        departmentOptions={optionsFromRows(scopedPlans, ['department', 'personGroup'])}
        statusOptions={optionsFromRows(scopedPlans, ['pmStatus', 'woStatus'])}
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
        workflow={activeWorkflow}
      />
      {mode === 'new' && (
        <ModalOverlay>
          <PmScheduleForm modal form={form} setForm={setForm} assets={assets} jobPlans={jobPlans} departments={departmentRecords} pmRules={pmRules} workflow={activeWorkflow} locations={locationRows} stores={storeRows} labor={laborRows} onCancel={() => setMode('list')} onSave={save} />
        </ModalOverlay>
      )}
    </section>
  )
}

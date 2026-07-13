import { useMemo, useState } from 'react'
import { AlertTriangle, Check, Plus, Search, Sparkles, X } from 'lucide-react'
import PmScheduleDetail from '../components/preventive-maintenance/PmScheduleDetail'
import PmScheduleForm from '../components/preventive-maintenance/PmScheduleForm'
import PmScheduleTable from '../components/preventive-maintenance/PmScheduleTable'
import Button from '../components/ui/Button'
import ExcelImportButton from '../components/ui/ExcelImportButton'
import IndexTabs from '../components/ui/IndexTabs'
import { ModalOverlay } from '../components/ui/ModalFrame'
import PageHeader from '../components/ui/PageHeader'
import departments from '../data/departments.json'
import pmSeed from '../data/pmSchedules.json'

const emptyPlan = {
  pmNumber: '',
  description: '',
  asset: '',
  route: '',
  location: '',
  site: '1031',
  jobPlan: '',
  startDate: '',
  leadTime: 0,
  frequency: 1,
  freqUnit: 'MONTHS',
  pmCounter: 0,
  workType: 'PM',
  woStatus: 'WSCH',
  storeLocation: '',
  supervisor: '',
  lead: '',
  personGroup: '',
  department: '',
  subDepartment: '',
  pmStatus: 'Active',
  lastGeneratedCycle: ''
}

const cycleKey = plan => `${plan.pmNumber}-${plan.startDate}`

const addFrequency = plan => {
  const date = new Date(plan.startDate)
  const amount = Number(plan.frequency) || 1
  if (plan.freqUnit === 'DAYS') date.setDate(date.getDate() + amount)
  if (plan.freqUnit === 'WEEKS') date.setDate(date.getDate() + amount * 7)
  if (plan.freqUnit === 'MONTHS') date.setMonth(date.getMonth() + amount)
  if (plan.freqUnit === 'YEARS') date.setFullYear(date.getFullYear() + amount)
  return date.toISOString().slice(0, 10)
}

export default function PreventiveMaintenancePage({ assets = [], jobTasks = [], workOrders = [], onGenerate, onOpenWorkOrder }) {
  const routeId = window.location.pathname.match(/^\/preventive-maintenance\/([^/]+)$/)?.[1]
  const [plans, setPlans] = useState(pmSeed)
  const [mode, setMode] = useState('list')
  const [selectedId, setSelectedId] = useState(routeId ? decodeURIComponent(routeId) : '')
  const [form, setForm] = useState(emptyPlan)
  const [query, setQuery] = useState('')
  const [generation, setGeneration] = useState(null)
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)
  const [pmTab, setPmTab] = useState('All')
  const [sort, setSort] = useState({ key: 'pmNumber', direction: 'asc' })

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

  const selected = plans.find(plan => plan.pmNumber === selectedId)
  const visible = plans.filter(plan => (pmTab === 'All' || plan.pmStatus === pmTab) && Object.values(plan).some(value => String(value).toLowerCase().includes(query.toLowerCase())))
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
    setPlans(rows => [...rows, form])
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
  const generate = () => {
    const cutoff = new Date('2026-08-31')
    const due = plans.filter(plan => plan.pmStatus === 'Active' && new Date(plan.startDate) <= cutoff && plan.lastGeneratedCycle !== cycleKey(plan))
    const made = due.map((plan, index) => ({ ...plan, workOrder: `PMWO-${20260801 + index}`, cycle: cycleKey(plan), nextDue: addFrequency(plan) }))
    setPlans(rows => rows.map(plan => {
      const generated = made.find(item => item.pmNumber === plan.pmNumber)
      return generated ? { ...plan, startDate: generated.nextDue, lastGeneratedCycle: generated.cycle, pmCounter: Number(plan.pmCounter) + 1 } : plan
    }))
    made.forEach(plan => onGenerate?.(plan, jobTasks.filter(task => task.JPNUM === plan.jobPlan)))
    setGeneration(made)
  }

  if (selected) {
    return <PmScheduleDetail plan={selected} assets={assets} jobTasks={jobTasks} jobPlans={jobPlans} workOrders={workOrders} onBack={closePlan} onOpenWorkOrder={onOpenWorkOrder} />
  }

  return (
    <section>
      <PageHeader
        eyebrow="PREVENTIVE MAINTENANCE"
        title="PM Schedule"
        description="Maximo-aligned PM masters and automatic work-order generation."
        actions={<div className="flex items-center gap-2"><ExcelImportButton onFile={() => setPlans(pmSeed)} /><Button onClick={() => setMode('new')}><Plus size={16} />New PM schedule</Button></div>}
      />

      {generation && (
        <div className={`mb-4 flex items-center justify-between gap-3 rounded-2xl border p-4 ${generation.length ? 'border-[#dce8df] bg-[#f1f8f3] text-[#315a47]' : 'border-[#f0d4bd] bg-[#fff7ef] text-[#9a5a2f]'}`}>
          <div className="flex items-center gap-3">{generation.length ? <Check /> : <AlertTriangle />}<div><strong>{generation.length ? `${generation.length} work orders generated` : 'No eligible PM plans'}</strong><span className="block text-xs">Duplicate generation is prevented by PM number and NEXTDATE cycle.</span></div></div>
          <button onClick={() => setGeneration(null)}><X /></button>
        </div>
      )}

      <IndexTabs
        active={pmTab}
        onChange={value => { setPmTab(value); setPage(1) }}
        tabs={[
          { key: 'All', label: 'All PM Schedules', count: plans.length },
          { key: 'Active', label: 'Active', count: plans.filter(plan => plan.pmStatus === 'Active').length },
          { key: 'Inactive', label: 'Inactive', count: plans.filter(plan => plan.pmStatus === 'Inactive').length }
        ]}
      />

      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <label className="flex h-10 min-w-[320px] flex-1 items-center gap-2 rounded-xl border border-[#dfe5df] bg-white px-3 text-sm">
          <Search size={16} className="text-[#7b8780]" />
          <input className="w-full bg-transparent outline-none" value={query} onChange={event => { setQuery(event.target.value); setPage(1) }} placeholder="Search PMNUM, asset, location, JPNUM, or person group" />
        </label>
        <Button variant="outline" onClick={generate}><Sparkles size={16} />Run generation preview</Button>
      </div>

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
      />
      {mode === 'new' && (
        <ModalOverlay>
          <PmScheduleForm modal form={form} setForm={setForm} assets={assets} jobPlans={jobPlans} departments={departments} onCancel={() => setMode('list')} onSave={save} />
        </ModalOverlay>
      )}
    </section>
  )
}

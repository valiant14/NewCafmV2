import { Boxes, Building2, CalendarClock, Check, ClipboardList, Clock, FileText, Gauge, Hash, MapPin, Repeat, Route, ShieldCheck, Store, User, Users, Workflow } from 'lucide-react'
import Button from '../ui/Button'
import { Field } from '../ui/FormControls'
import { ModalFooter, ModalHeader, ModalPanel } from '../ui/ModalFrame'
import { sameDepartment } from '../../lib/departments'
import { craftCodeOptions, laborNameOptions, locationOptions, storeOptions } from '../../lib/masterOptions'
import PageHeader from '../ui/PageHeader'
import Section from '../ui/Section'
import { normalizeWorkOrderWorkflow, workflowStatusOptions } from '../../lib/workOrderWorkflow'
import { pmWorkOrderStatusLabel } from '../../lib/pmGeneration'

export default function PmScheduleForm({ form, setForm, assets, jobPlans, departments, pmRules = [], workflow, locations = [], stores = [], labor = [], onCancel, onSave, modal = false }) {
  const activeWorkflow = normalizeWorkOrderWorkflow(workflow)
  const woStatusOptions = [
    ...workflowStatusOptions(activeWorkflow).map(option => ({ ...option, label: pmWorkOrderStatusLabel(option.value, option.label) })),
    { value: 'ON_HOLD_MATERIAL', label: pmWorkOrderStatusLabel('ON_HOLD_MATERIAL') },
    { value: 'ON_HOLD_PERMIT', label: pmWorkOrderStatusLabel('ON_HOLD_PERMIT') }
  ]
  const locationChoices = locationOptions(locations)
  const storeChoices = storeOptions(stores)
  const peopleChoices = laborNameOptions(labor)
  const groupChoices = craftCodeOptions(labor)
  const departmentOptions = [...new Map(departments
    .filter(department => department.status !== 'Inactive' && department.department)
    .map(department => [department.department, department.department])
  ).values()]
  const subDepartmentOptions = departments
    .filter(department => department.status !== 'Inactive' && sameDepartment(department.department, form.department))
    .map(department => ({ value: department.subDepartmentCode, label: department.description }))
  const siteChoices = [...new Set([...assets.map(asset => String(asset.site || '')), ...locations.map(location => String(location.site || ''))].filter(Boolean))]
  const valid = Boolean(form.pmNumber && form.description && (form.asset || form.location) && form.site && form.jobPlan && form.startDate && form.frequency && form.freqUnit && form.department && form.subDepartment)
  const ruleLocked = Boolean(form.scheduleRule)
  const set = (key, value) => setForm(current => ({ ...current, [key]: value }))
  const chooseRule = event => {
    const value = event.target.value
    const rule = pmRules.find(item => String(item.name || '').trim().toLowerCase() === String(value || '').trim().toLowerCase())
    setForm(current => ({
      ...current,
      scheduleRule: value,
      ...(rule ? {
        leadTime: Number(rule.leadTimeDays) || 0,
        frequency: Number(rule.frequency) || 1,
        freqUnit: rule.freqUnit || 'MONTHS',
        woStatus: woStatusOptions.some(option => option.value === rule.defaultWoStatus)
          ? rule.defaultWoStatus
          : activeWorkflow.initialStatus
      } : {})
    }))
  }
  const chooseAsset = event => {
    const value = event.target.value
    const asset = assets.find(item => item.assetnum === value)
    setForm(current => ({ ...current, asset: value, location: asset?.location || current.location, site: String(asset?.site || current.site), department: asset?.department || current.department, subDepartment: asset?.['sub department'] || asset?.subDepartment || current.subDepartment }))
  }
  const chooseLocation = event => {
    const value = event.target.value
    const location = locations.find(item => item.location === value)
    setForm(current => ({ ...current, location: value, site: String(location?.site || current.site), department: location?.department || current.department }))
  }
  const pairClass = 'grid gap-3 md:grid-cols-2'
  const wideClass = 'grid gap-3 md:grid-cols-2 xl:grid-cols-4'
  const formFields = (
    <div className="grid items-start gap-3 lg:grid-cols-2">
      <Section compact icon={ClipboardList} title="Schedule" note="What this PM master is called and whether it is live">
        <div className={pairClass}>
          <Field label="PMNUM" icon={Hash} value={form.pmNumber} required onChange={event => set('pmNumber', event.target.value)} />
          <Field label="PM Description" icon={FileText} value={form.description} required onChange={event => set('description', event.target.value)} />
          <Field label="PM Status" icon={ShieldCheck} value={form.pmStatus} options={['ACTIVE', 'INACTIVE', 'DRAFT']} onChange={event => set('pmStatus', event.target.value)} />
          <Field label="WORKTYPE" icon={Workflow} value="PM" locked />
        </div>
      </Section>

      <Section compact tone="green" icon={MapPin} title="Target" note="The asset or location serviced, and the plan followed">
        <div className={pairClass}>
          <Field label="ASSETNUM" icon={Boxes} value={form.asset} onChange={chooseAsset} suggestions={assets.map(asset => ({ value: asset.assetnum, label: asset.description }))} placeholder="Search asset" />
          <Field label="LOCATION" icon={MapPin} value={form.location} onChange={chooseLocation} suggestions={locationChoices} placeholder="Use when PM is location-based" />
          <Field label="SITE" icon={Building2} value={form.site} required onChange={event => set('site', event.target.value)} suggestions={siteChoices} placeholder="Select site" />
          <Field label="ROUTE" icon={Route} value={form.route} onChange={event => set('route', event.target.value)} />
          <Field label="JPNUM" icon={ClipboardList} value={form.jobPlan} required onChange={event => set('jobPlan', event.target.value)} suggestions={jobPlans.map(job => ({ value: job.number, label: job.description }))} />
        </div>
      </Section>

      {/* A generation rule supplies lead time, frequency and the starting status, so those
          fields lock once one is chosen - the rule is the single source for them. */}
      <Section compact tone="orange" icon={CalendarClock} title="Timing" note={ruleLocked ? 'Lead time, frequency and status come from the selected rule' : 'When the first work order is raised and how often it repeats'} className="lg:col-span-2">
        <div className={wideClass}>
          <Field label="PM Rule" icon={Repeat} value={form.scheduleRule || ''} onChange={chooseRule} suggestions={pmRules.filter(rule => rule.status === 'Active').map(rule => ({ value: rule.name, label: `${rule.frequency} ${rule.freqUnit} @ ${String(rule.triggerHour || 0).padStart(2, '0')}:00` }))} placeholder="Select generation rule" />
          <Field label="Start Date" icon={CalendarClock} type="datetime-local" value={form.startDate} required onChange={event => set('startDate', event.target.value)} />
          <Field label="LEAD TIME (DAYS)" icon={Clock} type="number" value={form.leadTime} disabled={ruleLocked} onChange={event => set('leadTime', Number(event.target.value))} />
          <Field label="FREQUENCY" icon={Repeat} type="number" value={form.frequency} required disabled={ruleLocked} onChange={event => set('frequency', Number(event.target.value))} />
          <Field label="FREQUNIT" icon={Clock} value={form.freqUnit} required disabled={ruleLocked} options={['MINUTES', 'HOURS', 'DAYS', 'WEEKS', 'MONTHS', 'QUARTERS', 'YEARS']} onChange={event => set('freqUnit', event.target.value)} />
          <Field label="Generated Work Orders" icon={Gauge} value={form.pmCounter} locked />
          <Field label="WOSTATUS" icon={Workflow} value={form.woStatus || activeWorkflow.initialStatus} disabled={ruleLocked} options={woStatusOptions} onChange={event => set('woStatus', event.target.value)} />
        </div>
      </Section>

      <Section compact tone="purple" icon={Users} title="Ownership" note="Who the generated work orders are routed to" className="lg:col-span-2">
        <div className={wideClass}>
          <Field label="Department" icon={Users} value={form.department} required onChange={event => setForm(current => ({ ...current, department: event.target.value, subDepartment: '' }))} suggestions={departmentOptions} placeholder="Search department" />
          <Field label="Sub Department" icon={Users} value={form.subDepartment} required onChange={event => set('subDepartment', event.target.value)} suggestions={subDepartmentOptions} placeholder={form.department ? 'Search sub department' : 'Select department first'} />
          <Field label="SUPERVISOR" icon={User} value={form.supervisor} onChange={event => set('supervisor', event.target.value)} suggestions={peopleChoices} placeholder="Select a supervisor" />
          <Field label="LEAD" icon={User} value={form.lead} onChange={event => set('lead', event.target.value)} suggestions={peopleChoices} placeholder="Select a lead" />
          <Field label="PERSONGROUP" icon={Users} value={form.personGroup} onChange={event => set('personGroup', event.target.value)} suggestions={groupChoices} placeholder="Select a person group" />
          <Field label="STORELOC" icon={Store} value={form.storeLocation} onChange={event => set('storeLocation', event.target.value)} suggestions={storeChoices} placeholder="Select a store" />
        </div>
      </Section>
    </div>
  )

  const content = (
    <>
      {modal ? (
        <ModalHeader
          eyebrow="NEW MAXIMO PM MASTER"
          title="Create PM schedule"
          titleId="create-pm-schedule-title"
          description="Fields follow the uploaded PM workbook structure."
          onClose={onCancel}
        />
      ) : (
        <PageHeader
          eyebrow="New PM master"
          title="Create PM schedule"
          description="Fields follow the uploaded PM workbook structure."
          backLabel="Back to PM Schedule"
          onBack={onCancel}
          actions={<Button disabled={!valid} onClick={onSave}><Check size={16} />Create schedule</Button>}
        />
      )}

      {/* The sections are cards in their own right, so the page version needs no extra surface. */}
      {modal ? <div className="overflow-auto px-4 py-4 sm:px-6">{formFields}</div> : formFields}

      {modal && (
        <ModalFooter>
          <Button variant="outline" onClick={onCancel}>Cancel</Button>
          <Button disabled={!valid} onClick={onSave}><Check size={16} />Create schedule</Button>
        </ModalFooter>
      )}
    </>
  )

  if (modal) {
    return <ModalPanel className="max-w-6xl" labelledBy="create-pm-schedule-title">{content}</ModalPanel>
  }

  return <section className="space-y-5">{content}</section>
}

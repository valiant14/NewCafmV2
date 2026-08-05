import { Check } from 'lucide-react'
import Button from '../ui/Button'
import { Field } from '../ui/FormControls'
import { ModalFooter, ModalHeader, ModalPanel } from '../ui/ModalFrame'
import { sameDepartment } from '../../lib/departments'
import { craftCodeOptions, laborNameOptions, locationOptions, storeOptions } from '../../lib/masterOptions'
import PageHeader from '../ui/PageHeader'
import Surface from '../ui/Surface'
import { normalizeWorkOrderWorkflow, workflowStatusOptions } from '../../lib/workOrderWorkflow'

export default function PmScheduleForm({ form, setForm, assets, jobPlans, departments, pmRules = [], workflow, locations = [], stores = [], labor = [], onCancel, onSave, modal = false }) {
  const activeWorkflow = normalizeWorkOrderWorkflow(workflow)
  const woStatusOptions = workflowStatusOptions(activeWorkflow)
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
    .map(department => ({ value: department.description, label: department.subDepartmentCode }))
  const valid = Boolean(form.pmNumber && form.description && (form.asset || form.location) && form.jobPlan && form.startDate && form.frequency && form.freqUnit)
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
    setForm(current => ({ ...current, asset: value, location: asset?.location || current.location, site: String(asset?.site || current.site) }))
  }
  const formFields = (
    <div className="grid gap-4 md:grid-cols-2">
      <Field label="PMNUM" value={form.pmNumber} required onChange={event => set('pmNumber', event.target.value)} />
      <Field label="PM Description" value={form.description} required onChange={event => set('description', event.target.value)} />
      <Field label="ASSETNUM" value={form.asset} onChange={chooseAsset} suggestions={assets.map(asset => ({ value: asset.assetnum, label: asset.description }))} placeholder="Search asset" />
      <Field label="LOCATION" value={form.location} onChange={event => set('location', event.target.value)} suggestions={locationChoices} placeholder="Use when PM is location-based" />
      <Field label="ROUTE" value={form.route} onChange={event => set('route', event.target.value)} />
      <Field label="JPNUM" value={form.jobPlan} required onChange={event => set('jobPlan', event.target.value)} suggestions={jobPlans.map(job => ({ value: job.number, label: job.description }))} />
      <Field label="PM Rule" value={form.scheduleRule || ''} onChange={chooseRule} suggestions={pmRules.filter(rule => rule.status === 'Active').map(rule => ({ value: rule.name, label: `${rule.frequency} ${rule.freqUnit} @ ${String(rule.triggerHour || 0).padStart(2, '0')}:00` }))} placeholder="Select generation rule" />
      <Field label="NEXTDATE" type="datetime-local" value={form.startDate} required onChange={event => set('startDate', event.target.value)} />
      <Field label="LEAD TIME (DAYS)" type="number" value={form.leadTime} disabled={ruleLocked} onChange={event => set('leadTime', Number(event.target.value))} />
      <Field label="FREQUENCY" type="number" value={form.frequency} required disabled={ruleLocked} onChange={event => set('frequency', Number(event.target.value))} />
      <Field label="FREQUNIT" value={form.freqUnit} required disabled={ruleLocked} options={['MINUTES', 'HOURS', 'DAYS', 'WEEKS', 'MONTHS', 'YEARS']} onChange={event => set('freqUnit', event.target.value)} />
      <Field label="PMCOUNTER" type="number" value={form.pmCounter} onChange={event => set('pmCounter', Number(event.target.value))} />
      <Field label="WORKTYPE" value="PM" locked />
      <Field label="WOSTATUS" value={form.woStatus || activeWorkflow.initialStatus} disabled={ruleLocked} options={woStatusOptions} onChange={event => set('woStatus', event.target.value)} />
      <Field label="STORELOC" value={form.storeLocation} onChange={event => set('storeLocation', event.target.value)} suggestions={storeChoices} placeholder="Select a store" />
      <Field label="SUPERVISOR" value={form.supervisor} onChange={event => set('supervisor', event.target.value)} suggestions={peopleChoices} placeholder="Select a supervisor" />
      <Field label="LEAD" value={form.lead} onChange={event => set('lead', event.target.value)} suggestions={peopleChoices} placeholder="Select a lead" />
      <Field label="PERSONGROUP" value={form.personGroup} onChange={event => set('personGroup', event.target.value)} suggestions={groupChoices} placeholder="Select a person group" />
      <Field label="PM Status" value={form.pmStatus} options={['ACTIVE', 'INACTIVE', 'DRAFT']} onChange={event => set('pmStatus', event.target.value)} />
      <Field label="Department" value={form.department} onChange={event => setForm(current => ({ ...current, department: event.target.value, subDepartment: '' }))} suggestions={departmentOptions} placeholder="Search department" />
      <Field label="Sub Department" value={form.subDepartment} onChange={event => set('subDepartment', event.target.value)} suggestions={subDepartmentOptions} placeholder={form.department ? 'Search sub department' : 'Select department first'} />
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

      {modal ? <div className="overflow-auto px-6 py-5">{formFields}</div> : <Surface>{formFields}</Surface>}

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

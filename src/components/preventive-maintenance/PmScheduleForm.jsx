import { Check } from 'lucide-react'
import Button from '../ui/Button'
import { Field } from '../ui/FormControls'
import { ModalFooter, ModalHeader, ModalPanel } from '../ui/ModalFrame'

export default function PmScheduleForm({ form, setForm, assets, jobPlans, departments, onCancel, onSave, modal = false }) {
  const selectedDepartment = departments.find(department => department.name === form.department)
  const valid = Boolean(form.pmNumber && form.description && (form.asset || form.location) && form.jobPlan && form.startDate && form.frequency && form.freqUnit)
  const set = (key, value) => setForm(current => ({ ...current, [key]: value }))
  const chooseAsset = event => {
    const value = event.target.value
    const asset = assets.find(item => item.assetnum === value)
    setForm(current => ({ ...current, asset: value, location: asset?.location || current.location, site: String(asset?.site || current.site) }))
  }

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
        <header className="flex flex-col gap-4 rounded-3xl border border-[var(--app-line)] bg-[var(--app-panel)] p-6 shadow-[0_12px_32px_rgba(32,55,45,.07)] lg:flex-row lg:items-center lg:justify-between">
          <div>
            <button className="mb-4 text-xs font-bold text-[var(--app-muted)] hover:text-[var(--app-primary)]" onClick={onCancel}>Back to PM Schedule</button>
            <span className="text-[length:var(--app-page-eyebrow-font-size)] font-extrabold uppercase tracking-[.18em] text-[var(--app-muted)]">NEW MAXIMO PM MASTER</span>
            <h1 className="mt-1 text-[clamp(24px,var(--app-page-title-font-size),34px)] font-extrabold tracking-[-.045em] text-[var(--app-ink)]">Create PM schedule</h1>
            <p className="mt-1 text-[length:var(--app-page-description-font-size)] text-[var(--app-muted)]">Fields follow the uploaded PM workbook structure.</p>
          </div>
          <Button disabled={!valid} onClick={onSave}><Check size={16} />Create schedule</Button>
        </header>
      )}

      <div className={modal ? 'overflow-auto px-6 py-5' : 'grid gap-5 rounded-3xl border border-[var(--app-line)] bg-[var(--app-panel)] p-5 shadow-[0_8px_24px_rgba(32,55,45,.06)]'}>
        <div className="grid gap-4 md:grid-cols-2">
          <Field label="PMNUM" value={form.pmNumber} required onChange={event => set('pmNumber', event.target.value)} />
          <Field label="PM Description" value={form.description} required onChange={event => set('description', event.target.value)} />
          <Field label="ASSETNUM" value={form.asset} onChange={chooseAsset} suggestions={assets.map(asset => ({ value: asset.assetnum, label: asset.description }))} placeholder="Search asset" />
          <Field label="LOCATION" value={form.location} onChange={event => set('location', event.target.value)} placeholder="Use when PM is location-based" />
          <Field label="ROUTE" value={form.route} onChange={event => set('route', event.target.value)} />
          <Field label="JPNUM" value={form.jobPlan} required onChange={event => set('jobPlan', event.target.value)} suggestions={jobPlans.map(job => ({ value: job.number, label: job.description }))} />
          <Field label="NEXTDATE" type="date" value={form.startDate} required onChange={event => set('startDate', event.target.value)} />
          <Field label="LEAD TIME (DAYS)" type="number" value={form.leadTime} onChange={event => set('leadTime', Number(event.target.value))} />
          <Field label="FREQUENCY" type="number" value={form.frequency} required onChange={event => set('frequency', Number(event.target.value))} />
          <Field label="FREQUNIT" value={form.freqUnit} required options={['DAYS', 'WEEKS', 'MONTHS', 'YEARS']} onChange={event => set('freqUnit', event.target.value)} />
          <Field label="PMCOUNTER" type="number" value={form.pmCounter} onChange={event => set('pmCounter', Number(event.target.value))} />
          <Field label="WORKTYPE" value="PM" onChange={() => {}} />
          <Field label="WOSTATUS" value={form.woStatus} options={['WSCH', 'WAPPR']} onChange={event => set('woStatus', event.target.value)} />
          <Field label="STORELOC" value={form.storeLocation} onChange={event => set('storeLocation', event.target.value)} />
          <Field label="SUPERVISOR" value={form.supervisor} onChange={event => set('supervisor', event.target.value)} />
          <Field label="LEAD" value={form.lead} onChange={event => set('lead', event.target.value)} />
          <Field label="PERSONGROUP" value={form.personGroup} onChange={event => set('personGroup', event.target.value)} placeholder="C1-HVAC" />
          <Field label="PM Status" value={form.pmStatus} options={['Active', 'Inactive']} onChange={event => set('pmStatus', event.target.value)} />
          <Field label="department" value={form.department} onChange={event => setForm(current => ({ ...current, department: event.target.value, subDepartment: '' }))} options={['', ...departments.map(department => department.name)]} />
          <Field label="sub department" value={form.subDepartment} onChange={event => set('subDepartment', event.target.value)} options={['', ...(selectedDepartment?.subDepartments || []).map(sub => sub.name)]} />
        </div>
      </div>

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

import { CalendarClock, Check, Sparkles } from 'lucide-react'
import Button from '../ui/Button'
import { Field } from '../ui/FormControls'

export default function PmScheduleForm({ form, setForm, assets, jobPlans, departments, onCancel, onSave }) {
  const selectedJobPlan = jobPlans.find(job => job.number === form.jobPlan)
  const selectedDepartment = departments.find(department => department.name === form.department)
  const valid = Boolean(form.pmNumber && form.description && (form.asset || form.location) && form.jobPlan && form.startDate && form.frequency && form.freqUnit)
  const set = (key, value) => setForm(current => ({ ...current, [key]: value }))
  const chooseAsset = event => {
    const value = event.target.value
    const asset = assets.find(item => item.assetnum === value)
    setForm(current => ({ ...current, asset: value, location: asset?.location || current.location, site: String(asset?.site || current.site) }))
  }

  return (
    <section className="space-y-5">
      <header className="flex flex-col gap-4 rounded-3xl border border-[var(--app-line)] bg-white p-6 shadow-[0_12px_32px_rgba(32,55,45,.07)] lg:flex-row lg:items-center lg:justify-between">
        <div>
          <button className="mb-4 text-xs font-bold text-[#577066]" onClick={onCancel}>← PM Schedule</button>
          <span className="text-[9px] font-extrabold uppercase tracking-[.18em] text-[#7a8780]">NEW MAXIMO PM MASTER</span>
          <h1 className="mt-1 text-3xl font-extrabold tracking-[-.045em] text-[var(--app-ink)]">Create PM schedule</h1>
          <p className="mt-1 text-sm text-[var(--app-muted)]">Fields follow the uploaded PM workbook structure.</p>
        </div>
        <Button disabled={!valid} onClick={onSave}><Check size={16} />Create schedule</Button>
      </header>

      <div className="grid gap-5 xl:grid-cols-[1fr_320px]">
        <section className="rounded-3xl border border-[var(--app-line)] bg-white p-5 shadow-[0_8px_24px_rgba(32,55,45,.06)]">
          <div className="mb-5 flex items-center gap-3 border-b border-[#edf0ec] pb-4"><CalendarClock className="text-[#60766b]" /><div><h2 className="font-extrabold text-[var(--app-ink)]">PM master data</h2><p className="text-sm text-[var(--app-muted)]">Schedule, ownership, routing, and work-order defaults.</p></div></div>
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
        </section>

        <aside className="rounded-3xl border border-[#dbe8df] bg-[#eef7f1] p-5 text-[#315a47] shadow-[0_8px_24px_rgba(32,55,45,.05)]">
          <Sparkles />
          <h3 className="mt-3 text-lg font-extrabold">Job Plan controls duration</h3>
          <p className="mt-2 text-sm text-[#617268]">Tasks, duration, labor, materials, tools, safety instructions, and checklists are copied at generation.</p>
          <div className="mt-5 grid gap-3">
            <div className="rounded-2xl bg-white p-4"><span className="text-[9px] font-extrabold uppercase tracking-[.12em]">Job Plan</span><strong className="mt-1 block">{selectedJobPlan?.description || 'Not selected'}</strong></div>
            <div className="rounded-2xl bg-white p-4"><span className="text-[9px] font-extrabold uppercase tracking-[.12em]">Estimated Duration</span><strong className="mt-1 block">{selectedJobPlan ? `${Math.max(1, Math.round(selectedJobPlan.duration * 10) / 10)} hours` : '-'}</strong></div>
            <div className="rounded-2xl bg-white p-4"><span className="text-[9px] font-extrabold uppercase tracking-[.12em]">Excel WO Status</span><strong className="mt-1 block">{form.woStatus} · Waiting</strong></div>
          </div>
        </aside>
      </div>
    </section>
  )
}

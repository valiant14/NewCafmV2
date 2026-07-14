import { PackageCheck, ShieldCheck, Wrench } from 'lucide-react'
import Badge from '../ui/Badge'
import Field from '../ui/Field'
import Section from '../ui/Section'

const lockedClass = 'mx-auto grid max-w-3xl gap-4 rounded-2xl border border-[var(--app-line)] bg-[var(--app-panel)] p-5 text-left shadow-[0_8px_24px_rgba(32,55,45,.06)] md:grid-cols-[48px_1fr]'
const lockedIconClass = 'grid h-12 w-12 place-items-center rounded-xl bg-[var(--app-badge-green-bg)] text-[var(--app-badge-green-text)]'
const timingClass = breached => [
  'flex flex-wrap items-center justify-between gap-4 overflow-hidden rounded-2xl border bg-[var(--app-panel)] p-0',
  breached ? 'border-[var(--warning)]' : 'border-[var(--app-line)]'
].join(' ')
const timingGridClass = 'grid flex-1 grid-cols-1 md:grid-cols-3'
const timingCellClass = 'grid gap-1 border-b border-[var(--app-line)] p-3 text-[9px] font-extrabold uppercase tracking-[.12em] text-[var(--app-muted)] md:border-b-0 md:border-r'
const formGridClass = 'grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4'
const twoColumnGridClass = 'grid grid-cols-1 gap-4 md:grid-cols-2'
const resourceListClass = 'grid gap-2'
const resourceRowClass = 'flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[var(--app-line)] bg-[var(--app-soft-bg)] p-3 [&>span]:flex [&>span]:items-center [&>span]:gap-2 [&>span]:text-[var(--app-primary)] [&_strong]:text-sm [&_strong]:text-[var(--app-ink)] [&_label]:flex [&_label]:items-center [&_label]:gap-2 [&_label]:text-xs [&_label]:text-[var(--app-muted)] [&_input]:h-9 [&_input]:w-24 [&_input]:rounded-lg [&_input]:border [&_input]:border-[var(--app-field-border)] [&_input]:bg-[var(--app-panel)] [&_input]:px-3 [&_input]:text-sm'
const closeoutGridClass = 'grid gap-3 md:grid-cols-4'
const closeoutCardClass = 'grid gap-1 rounded-xl border border-[var(--app-line)] bg-[var(--app-soft-bg)] p-3 [&_span]:text-[9px] [&_span]:font-extrabold [&_span]:uppercase [&_span]:tracking-[.1em] [&_span]:text-[var(--app-muted)] [&_strong]:text-sm [&_strong]:text-[var(--app-ink)]'

function formatDateTime(value, fallback = 'Not recorded') {
  return value ? new Date(value).toLocaleString() : fallback
}

function ActualResourceSection({ title, note, rows, icon: Icon, update }) {
  return (
    <Section compact title={title} note={note}>
      <div className={resourceListClass}>
        {rows.map((row, index) => (
          <div className={resourceRowClass} key={`${row.item}-${index}`}>
            <span><Icon size={15} /><strong>{row.item}</strong></span>
            <label>Actual quantity<input type="number" min="0" value={row.actualQuantity} onChange={event => update(index, event.target.value)} placeholder="0" /></label>
          </div>
        ))}
      </div>
    </Section>
  )
}

export default function WorkOrderActualTab({
  actualsEditable,
  status,
  preparationReady,
  planReady,
  setTab,
  setWorkStarted,
  completeWork,
  outlineButtonClass,
  primaryButtonClass,
  targetStart,
  targetFinish,
  actualFinish,
  setActualFinish,
  slaBreachedNow,
  slaLabel,
  technicianRemarks,
  setTechnicianRemarks,
  completionNotes,
  setCompletionNotes,
  actualLabor,
  setActualLabor,
  laborCraft,
  setLaborCraft,
  actualHours,
  setActualHours,
  actualStart,
  setActualStart,
  actualMaterials,
  setActualMaterials,
  actualTools,
  setActualTools,
  updateActualRow,
  workClosed
}) {
  if (!actualsEditable) {
    return (
      <div className={lockedClass}>
        <div className={lockedIconClass}><ShieldCheck size={22} /></div>
        <div>
          <strong>Available after work completion</strong>
          <p>{status === 'ASSIGNED' ? 'Complete Plan and Failure preparation, then select Start Work. When execution is finished, select Resolve / Complete.' : 'When physical work is finished, select Resolve / Complete in the header to unlock execution notes and actual consumption.'}</p>
          <span>Current status: {status}</span>
          {status === 'ASSIGNED' && !preparationReady && <button className={outlineButtonClass} onClick={() => setTab(planReady ? 'Failure' : 'Plan')}>Complete {planReady ? 'Failure' : 'Plan'} preparation</button>}
          {status === 'ASSIGNED' && preparationReady && <button className={primaryButtonClass} onClick={() => setWorkStarted(true)}>Start work</button>}
          {status === 'INPRG' && <button className={primaryButtonClass} onClick={completeWork}>Resolve / complete work</button>}
        </div>
      </div>
    )
  }

  return (
    <>
      <div className={timingClass(slaBreachedNow)}>
        <div className={timingGridClass}>
          <span className={timingCellClass}>Target Start<strong className="text-xs normal-case tracking-normal text-[var(--app-ink)]">{formatDateTime(targetStart, 'Not defined')}</strong></span>
          <span className={timingCellClass}>Target Finish<strong className="text-xs normal-case tracking-normal text-[var(--app-ink)]">{formatDateTime(targetFinish, 'Not defined')}</strong></span>
          <span className={timingCellClass}>Actual Finish<strong className="text-xs normal-case tracking-normal text-[var(--app-ink)]">{formatDateTime(actualFinish)}</strong></span>
        </div>
        <div className="p-3"><Badge tone={slaBreachedNow ? 'orange' : 'green'}>{slaLabel}</Badge></div>
      </div>

      <Section compact title="Execution Notes">
        <div className={twoColumnGridClass}>
          <Field label="Technician Remarks" value={technicianRemarks} onChange={event => setTechnicianRemarks(event.target.value)} type="textarea" required />
          <Field label="Completion Notes" value={completionNotes} onChange={event => setCompletionNotes(event.target.value)} type="textarea" required />
        </div>
      </Section>

      <Section compact title="Actual Labor">
        <div className={formGridClass}>
          <Field label="Technician / Labor" value={actualLabor} onChange={event => setActualLabor(event.target.value)} required />
          <Field label="Labor Craft Code" value={laborCraft} onChange={event => setLaborCraft(event.target.value)} required />
          <Field label="Actual Labor Hours" value={actualHours} onChange={event => setActualHours(event.target.value)} type="number" required />
          <Field label="Actual Start" value={actualStart} onChange={event => setActualStart(event.target.value)} type="datetime-local" />
          <Field label="Actual Finish" value={actualFinish} onChange={event => setActualFinish(event.target.value)} type="datetime-local" />
        </div>
      </Section>

      <ActualResourceSection title="Actual Materials Used" note="Required for CM closeout" rows={actualMaterials} icon={PackageCheck} update={(index, value) => updateActualRow(setActualMaterials, index, value)} />
      <ActualResourceSection title="Actual Tools and Equipment Used" note="Required for CM closeout" rows={actualTools} icon={Wrench} update={(index, value) => updateActualRow(setActualTools, index, value)} />

      <Section compact title="Automatic Closeout" note="System populated when the work order is closed">
        <div className={closeoutGridClass}>
          <div className={closeoutCardClass}><span>Completion Date</span><strong>{actualFinish ? new Date(actualFinish).toLocaleString() : 'Pending'}</strong></div>
          <div className={closeoutCardClass}><span>Closed By</span><strong>{workClosed ? 'Ahmed Faisal' : 'Pending'}</strong></div>
          <div className={closeoutCardClass}><span>Close Status</span><strong>{workClosed ? 'CLOSE' : 'Pending'}</strong></div>
          <div className={closeoutCardClass}><span>Asset History Update</span><strong>{workClosed ? 'Updated automatically' : 'Pending close'}</strong></div>
        </div>
      </Section>
    </>
  )
}

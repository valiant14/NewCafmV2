import { AlertTriangle, Search } from 'lucide-react'
import Field from '../ui/Field'
import Section from '../ui/Section'

const fieldsClass = 'grid grid-cols-1 gap-3 md:grid-cols-2'
const mapClass = 'mt-3 grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4'
const stageClass = selected => `rounded-2xl border p-3 ${selected ? 'border-[var(--success)] bg-[var(--app-badge-green-bg)]' : 'border-[var(--app-line)] bg-[var(--app-soft-bg)]'}`
const stageTopClass = 'mb-2 flex items-center justify-between gap-2 text-[9px] font-extrabold uppercase tracking-[.1em] text-[var(--app-muted)]'
const emptyClass = 'text-xs italic leading-relaxed text-[var(--app-muted)]'
const libraryNoteClass = 'mt-3 flex items-center gap-2 rounded-2xl border border-[var(--app-line)] bg-[var(--app-soft-bg)] p-3 text-xs text-[var(--app-muted)]'

function FailureStage({ item, index }) {
  return (
    <div className={stageClass(Boolean(item.code))}>
      <div className={stageTopClass}>
        <span>{item.step}</span>
        <strong>{item.label}</strong>
        <em>{item.required ? 'Required' : 'Optional'}</em>
      </div>
      {item.code ? (
        <>
          <b className="block text-sm font-extrabold text-[var(--app-ink)]">{item.code}</b>
          <p className="mt-1 text-xs leading-relaxed text-[var(--app-muted)]">{item.description || 'Description not available for this code.'}</p>
        </>
      ) : (
        <p className={emptyClass}>{index === 0 ? 'Select a failure class to begin' : `No ${item.label.toLowerCase()} selected`}</p>
      )}
    </div>
  )
}

export default function WorkOrderFailureTab({
  readOnly = false,
  isCM,
  causeApplicable = false,
  remedyApplicable = false,
  failureClass,
  changeFailure,
  failureClassOptions,
  problemCode,
  setProblemCode,
  setCauseCode,
  setRemedyCode,
  problemOptions,
  causeCode,
  causeOptions,
  remedyCode,
  remedyOptions,
  failureDescription,
  problemDescription,
  causeDescription,
  remedyDescription,
  failureCount
}) {
  return (
    <Section compact tone="orange" icon={AlertTriangle} title="Failure Classification" note={isCM ? 'Failure Class and Problem are required for corrective maintenance' : 'Optional for this work order type'}>
      <div className={fieldsClass}>
        <Field label="Failure Code" value={failureClass} required={isCM} locked={readOnly} onChange={changeFailure} suggestions={failureClassOptions} placeholder="Search code or description" />
        <Field label="Problem Code" value={problemCode} required={isCM} locked={readOnly} onChange={event => { setProblemCode(event.target.value); setCauseCode(''); setRemedyCode('') }} suggestions={problemOptions} placeholder={failureClass ? 'Search matching problems' : 'Select failure code first'} />
        <Field label={causeApplicable ? 'Cause Code' : 'Cause Code (Optional)'} required={causeApplicable} value={causeCode} locked={readOnly} onChange={event => { setCauseCode(event.target.value); setRemedyCode('') }} suggestions={causeOptions} placeholder={problemCode ? 'Search cause code or description' : 'Select problem code first'} />
        <Field label={remedyApplicable ? 'Remedy Code' : 'Remedy Code (Optional)'} required={remedyApplicable} value={remedyCode} locked={readOnly} onChange={event => setRemedyCode(event.target.value)} suggestions={remedyOptions} placeholder={problemCode ? 'Search remedy code or description' : 'Select problem code first'} />
      </div>

      <div className={mapClass}>
        {[
          { step: '01', label: 'Failure class', code: failureClass, description: failureDescription, required: true },
          { step: '02', label: 'Problem', code: problemCode, description: problemDescription, required: true },
          { step: '03', label: 'Cause', code: causeCode, description: causeDescription, required: causeApplicable },
          { step: '04', label: 'Remedy', code: remedyCode, description: remedyDescription, required: remedyApplicable }
        ].map((item, index) => <FailureStage item={item} index={index} key={item.label} />)}
      </div>

      <div className={libraryNoteClass}>
        <Search size={15} />
        <span>{failureCount.toLocaleString()} Excel failure records available · codes and descriptions are filtered by hierarchy</span>
      </div>
    </Section>
  )
}

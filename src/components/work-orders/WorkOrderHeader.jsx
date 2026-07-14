import { Check, Printer, RotateCcw, Users, Wrench } from 'lucide-react'
import Badge from '../ui/Badge'

const headerClass = 'grid gap-3 border-b border-[var(--app-line)] bg-transparent pb-3'
const headerTopClass = 'flex flex-wrap items-start justify-between gap-3'
const backClass = 'inline-flex text-[length:var(--app-topbar-font-size)] font-bold text-[var(--app-muted)] transition hover:text-[var(--app-primary)]'
const titleClass = 'text-[clamp(24px,var(--app-page-title-font-size),34px)] font-extrabold tracking-[-.045em] text-[var(--app-ink)]'
const descriptionClass = 'mt-1 text-[length:var(--app-page-description-font-size)] text-[var(--app-muted)]'
const actionsClass = 'flex flex-wrap items-center justify-end gap-2'
const autoStatusClass = 'inline-flex h-9 items-center gap-2 rounded-xl bg-[var(--app-soft-bg)] px-3 text-xs text-[var(--app-muted)] [&_strong]:text-[var(--app-ink)]'
const autosaveClass = state => `inline-flex h-9 items-center gap-2 rounded-xl px-3 text-xs font-bold ${state === 'Saving' ? 'bg-[var(--app-soft-bg)] text-[var(--app-muted)]' : 'bg-[var(--app-badge-green-bg)] text-[var(--app-badge-green-text)]'}`
const primaryButtonClass = 'inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-transparent bg-[var(--app-primary)] px-4 text-xs font-bold text-white shadow-[0_8px_20px_rgba(49,90,71,.18)] transition hover:brightness-95 disabled:cursor-not-allowed disabled:opacity-50'
const outlineButtonClass = 'inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-[var(--app-line)] bg-[var(--app-panel)] px-4 text-xs font-bold text-[var(--app-muted)] transition hover:bg-[var(--app-soft-bg-hover)] disabled:cursor-not-allowed disabled:opacity-50'

export { primaryButtonClass as workOrderPrimaryButtonClass, outlineButtonClass as workOrderOutlineButtonClass }

export default function WorkOrderHeader({
  number,
  workType,
  status,
  description,
  isPM,
  autoSaveState,
  overviewReady,
  preparationReady,
  failureReady,
  actualReady,
  close,
  reroute,
  printWorkOrder,
  setWorkAssigned,
  setWorkStarted,
  completeWork,
  setWorkClosed
}) {
  return (
    <header className={headerClass}>
      <div className={headerTopClass}>
        <div>
          <button className={backClass} onClick={close}>Back to Work Order Tracking</button>
          <div className="mt-2 flex flex-wrap items-center gap-3">
            <h2 className={titleClass}>{number === 'AUTO' ? 'New work order' : `Work order #${number}`}</h2>
            <Badge tone={isPM ? 'blue' : 'purple'}>{workType}</Badge>
            <Badge tone="orange">{status}</Badge>
          </div>
          <p className={descriptionClass}>{description || 'Enter work order information'}</p>
        </div>
        <div className={`${actionsClass} self-center`}>
          <div className={autosaveClass(autoSaveState)}>
            {autoSaveState === 'Saving' ? <span className="h-2 w-2 animate-spin rounded-full border-2 border-[var(--app-muted)] border-t-[var(--app-primary)]" /> : <Check size={13} />}
            <span>{autoSaveState === 'Saving' ? 'Saving…' : 'All changes saved'}</span>
          </div>
          <div className={autoStatusClass}><span>Automatic status</span><strong>{status}</strong></div>
          {status === 'Waiting' && <button className={primaryButtonClass} disabled={!overviewReady} onClick={() => setWorkAssigned(true)}><Users size={15} />Assign department</button>}
          {status === 'ASSIGNED' && <button className={primaryButtonClass} disabled={!preparationReady} onClick={() => setWorkStarted(true)}><Wrench size={15} />Start work</button>}
          {status === 'INPRG' && <button className={primaryButtonClass} disabled={!failureReady} onClick={completeWork} title={!failureReady ? 'Failure Code and Problem Code are required before completion' : ''}><Check size={15} />Resolve / complete</button>}
          {status === 'COMP' && <button className={primaryButtonClass} disabled={!actualReady} onClick={() => setWorkClosed(true)}><Check size={15} />Close work order</button>}
          <button className={outlineButtonClass} onClick={reroute}><RotateCcw size={15} /> Re-route</button>
          <button className={outlineButtonClass} onClick={printWorkOrder}><Printer size={15} /> Print</button>
        </div>
      </div>
    </header>
  )
}

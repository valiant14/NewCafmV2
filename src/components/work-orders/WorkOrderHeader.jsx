import { Check, Printer, RotateCcw, Save, Users, Wrench } from 'lucide-react'
import Badge from '../ui/Badge'

const headerClass = 'grid gap-3 border-b border-[var(--app-line)] bg-transparent pb-3'
const headerTopClass = 'flex flex-wrap items-start justify-between gap-3'
const backClass = 'inline-flex text-[length:var(--app-topbar-font-size)] font-bold text-[var(--app-muted)] transition hover:text-[var(--app-primary)]'
const titleClass = 'text-[clamp(24px,var(--app-page-title-font-size),34px)] font-extrabold tracking-[-.045em] text-[var(--app-ink)]'
const descriptionClass = 'mt-1 text-[length:var(--app-page-description-font-size)] text-[var(--app-muted)]'
const actionsClass = 'flex flex-wrap items-center justify-end gap-2'
const statusClass = 'inline-flex h-9 items-center gap-2 rounded-xl bg-[var(--app-soft-bg)] px-3 text-xs text-[var(--app-muted)] [&_strong]:text-[var(--app-ink)]'
const saveStateClass = state => `inline-flex h-9 items-center gap-2 rounded-xl px-3 text-xs font-bold ${state === 'Saved' ? 'bg-[var(--app-badge-green-bg)] text-[var(--app-badge-green-text)]' : state === 'Saving' ? 'bg-[var(--app-soft-bg)] text-[var(--app-muted)]' : 'bg-[var(--app-badge-orange-bg)] text-[var(--app-badge-orange-text)]'}`
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
  onSave,
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
  const saveLabel = autoSaveState === 'Saving' ? 'Saving…' : autoSaveState === 'Saved' ? 'All changes saved' : 'Unsaved changes'

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
          <div className={saveStateClass(autoSaveState)}>
            {autoSaveState === 'Saving' ? <span className="h-2 w-2 animate-spin rounded-full border-2 border-[var(--app-muted)] border-t-[var(--app-primary)]" /> : <Check size={13} />}
            <span>{saveLabel}</span>
          </div>
          <button className={primaryButtonClass} disabled={autoSaveState === 'Saved' || autoSaveState === 'Saving'} onClick={onSave}>
            <Save size={15} />Save changes
          </button>

          <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-[var(--app-line)] bg-[var(--app-panel)] p-1.5">
            <div className={statusClass}><span>Current status</span><strong>{status}</strong></div>
            {status === 'Waiting' && <button className={primaryButtonClass} disabled={!overviewReady} onClick={() => setWorkAssigned(true)}><Users size={15} />Change status: Assign</button>}
            {status === 'ASSIGNED' && <button className={primaryButtonClass} disabled={!preparationReady} onClick={() => setWorkStarted(true)}><Wrench size={15} />Change status: Start</button>}
            {status === 'INPRG' && <button className={primaryButtonClass} disabled={!failureReady} onClick={completeWork} title={!failureReady ? 'Failure Code and Problem Code are required before completion' : ''}><Check size={15} />Change status: Complete</button>}
            {status === 'COMP' && <button className={primaryButtonClass} disabled={!actualReady} onClick={() => setWorkClosed(true)}><Check size={15} />Change status: Close</button>}
          </div>

          <button className={outlineButtonClass} onClick={reroute}><RotateCcw size={15} /> Re-route</button>
          <button className={outlineButtonClass} onClick={printWorkOrder}><Printer size={15} /> Print</button>
        </div>
      </div>
    </header>
  )
}

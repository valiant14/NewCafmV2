import { Check, Printer, Save, Users, Wrench } from 'lucide-react'
import Badge from '../ui/Badge'

const headerClass = 'grid gap-3 border-b border-[var(--app-line)] bg-transparent pb-3'
const headerTopClass = 'flex flex-wrap items-start justify-between gap-3'
const backClass = 'inline-flex text-[length:var(--app-topbar-font-size)] font-bold text-[var(--app-muted)] transition hover:text-[var(--app-primary)]'
const titleClass = 'text-[clamp(24px,var(--app-page-title-font-size),34px)] font-extrabold tracking-[-.045em] text-[var(--app-ink)]'
const descriptionClass = 'mt-1 text-[length:var(--app-page-description-font-size)] text-[var(--app-muted)]'
const actionsClass = 'flex flex-wrap items-center justify-end gap-2'
const primaryButtonClass = 'inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-transparent bg-[var(--app-primary)] px-4 text-xs font-bold text-white shadow-[0_8px_20px_rgba(49,90,71,.18)] transition hover:brightness-95 disabled:cursor-not-allowed disabled:opacity-50'
const outlineButtonClass = 'inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-[var(--app-line)] bg-[var(--app-panel)] px-4 text-xs font-bold text-[var(--app-muted)] transition hover:bg-[var(--app-soft-bg-hover)] disabled:cursor-not-allowed disabled:opacity-50'

export { primaryButtonClass as workOrderPrimaryButtonClass, outlineButtonClass as workOrderOutlineButtonClass }

export default function WorkOrderHeader({
  number,
  workType,
  status,
  statusDescription,
  description,
  isPM,
  autoSaveState,
  onSave,
  overviewReady,
  preparationReady,
  failureReady,
  actualReady,
  close,
  printWorkOrder,
  setWorkApproved,
  setWorkWaitingSchedule,
  setWorkScheduled,
  setWorkStarted,
  completeWork,
  setWorkClosed
}) {
  const saveLabel = autoSaveState === 'Saving' ? 'Saving...' : autoSaveState === 'Saved' ? 'Saved' : 'Save'
  const nextStatusAction = () => {
    if (status === 'WAPPR') return { label: 'Change status: Approve', disabled: !overviewReady, icon: Users, onClick: () => setWorkApproved(true) }
    if (status === 'APPR') return { label: 'Change status: Send to schedule', disabled: false, icon: Users, onClick: () => setWorkWaitingSchedule(true) }
    if (status === 'WSCH') return { label: 'Change status: Schedule', disabled: !preparationReady, icon: Users, onClick: () => setWorkScheduled(true) }
    if (status === 'SCHED') return { label: 'Change status: Start work', disabled: !preparationReady, icon: Wrench, onClick: () => setWorkStarted(true) }
    if (status === 'HOLD') return { label: 'Status on hold', disabled: true, icon: Wrench, onClick: undefined }
    if (status === 'INPRG') return { label: 'Change status: Complete', disabled: !failureReady, icon: Check, onClick: completeWork, title: !failureReady ? 'Failure Code and Problem Code are required before completion' : '' }
    if (status === 'COMP') return { label: 'Change status: Close', disabled: !actualReady, icon: Check, onClick: () => setWorkClosed(true) }
    return { label: 'No status change', disabled: true, icon: Check, onClick: undefined }
  }
  const action = nextStatusAction()
  const StatusIcon = action.icon

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
          <button className={outlineButtonClass} onClick={printWorkOrder}><Printer size={15} />Print</button>
          <button className={primaryButtonClass} disabled={autoSaveState === 'Saving'} onClick={onSave}>
            {autoSaveState === 'Saving'
              ? <span className="h-3 w-3 animate-spin rounded-full border-2 border-white/60 border-t-white" />
              : autoSaveState === 'Saved'
                ? <Check size={15} />
                : <Save size={15} />}
            {saveLabel}
          </button>
          <button className={primaryButtonClass} disabled={action.disabled} onClick={action.onClick} title={action.title || statusDescription || status}>
            <StatusIcon size={15} />{action.label}
          </button>
        </div>
      </div>
    </header>
  )
}

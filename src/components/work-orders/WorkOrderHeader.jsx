import { Check, PackageX, Play, Printer, Save } from 'lucide-react'
import Badge from '../ui/Badge'
import { statusTone } from '../../lib/statusMatrix'

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
  close,
  printWorkOrder,
  onMaterialHold,
  onResume,
  onMaterialHoldStatus = false,
  canMaterialHold = false,
  canManageHold = false,
  workClosed = false
}) {
  const saveLabel = autoSaveState === 'Saving' ? 'Saving...' : autoSaveState === 'Saved' ? 'Saved' : 'Save'

  return (
    <header className={headerClass}>
      <div className={headerTopClass}>
        <div>
          <button className={backClass} onClick={close}>Back to Work Order Tracking</button>
          <div className="mt-2 flex flex-wrap items-center gap-3">
            <h2 className={titleClass}>{number === 'AUTO' ? 'New work order' : `Work order #${number}`}</h2>
            <Badge tone={isPM ? 'blue' : 'purple'}>{workType}</Badge>
            <Badge tone={statusTone(status)}>{statusDescription || status}</Badge>
          </div>
          <p className={descriptionClass}>{description || 'Enter work order information'}</p>
        </div>

        <div className={`${actionsClass} self-center`}>
          {/* Holding a job pauses its SLA, so it is a supervisor's call rather than a
              technician's - only a Facility Manager sees these. */}
          {canManageHold && (onMaterialHoldStatus ? (
            <button className={outlineButtonClass} onClick={onResume} title="Resume work and restart the SLA clock">
              <Play size={15} />Resume
            </button>
          ) : canMaterialHold && (
            <button className={outlineButtonClass} onClick={onMaterialHold} title="Pause the SLA clock while waiting for material">
              <PackageX size={15} />Put on Hold (Material)
            </button>
          ))}
          <button className={outlineButtonClass} onClick={printWorkOrder}><Printer size={15} />Print</button>
          {/* CLOSE is terminal - there is nothing further to save, so the button goes
              rather than sitting there inviting a pointless click. */}
          {!workClosed && (
          <button className={primaryButtonClass} disabled={autoSaveState === 'Saving'} onClick={onSave}>
            {autoSaveState === 'Saving'
              ? <span className="h-3 w-3 animate-spin rounded-full border-2 border-white/60 border-t-white" />
              : autoSaveState === 'Saved'
                ? <Check size={15} />
                : <Save size={15} />}
            {saveLabel}
          </button>
          )}
        </div>
      </div>
    </header>
  )
}

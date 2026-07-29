import { Check, Printer, Save } from 'lucide-react'
import Badge from '../ui/Badge'

const headerClass = 'grid gap-3 border-b border-[var(--app-line)] bg-transparent pb-3'
const headerTopClass = 'flex flex-wrap items-start justify-between gap-3'
const backClass = 'inline-flex text-[length:var(--app-topbar-font-size)] font-bold text-[var(--app-muted)] transition hover:text-[var(--app-primary)]'
const titleClass = 'text-[clamp(24px,var(--app-page-title-font-size),34px)] font-extrabold tracking-[-.045em] text-[var(--app-ink)]'
const descriptionClass = 'mt-1 text-[length:var(--app-page-description-font-size)] text-[var(--app-muted)]'
const actionsClass = 'flex flex-wrap items-center justify-end gap-2'
const primaryButtonClass = 'inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-transparent bg-[var(--app-primary)] px-4 text-xs font-bold text-white shadow-[0_8px_20px_rgba(49,90,71,.18)] transition hover:brightness-95 disabled:cursor-not-allowed disabled:opacity-50'
const outlineButtonClass = 'inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-[var(--app-line)] bg-[var(--app-panel)] px-4 text-xs font-bold text-[var(--app-muted)] transition hover:bg-[var(--app-soft-bg-hover)] disabled:cursor-not-allowed disabled:opacity-50'
const statusSelectClass = 'h-10 min-w-[190px] rounded-xl border border-[var(--app-line)] bg-[var(--app-panel)] px-3 text-xs font-extrabold text-[var(--app-ink)] outline-none transition hover:bg-[var(--app-soft-bg)] focus:border-[var(--app-primary)] focus:ring-4 focus:ring-[var(--app-field-focus-ring)]'

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
  onStatusChange,
  statusOptions = []
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
          <select
            className={statusSelectClass}
            value={status}
            onChange={event => onStatusChange?.(event.target.value)}
            title={statusDescription || status}
            aria-label="Change work order status"
          >
            {statusOptions.map(option => (
              <option value={option.value} key={option.value} disabled={option.disabled} title={option.reason}>
                {option.value} · {option.label}{option.disabled && option.reason ? ` — ${option.reason}` : ''}
              </option>
            ))}
          </select>
        </div>
      </div>
    </header>
  )
}

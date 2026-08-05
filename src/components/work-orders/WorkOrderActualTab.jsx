import { Check, Lock, PackageCheck, Play, ShieldCheck, Undo2, Wrench } from 'lucide-react'
import Badge from '../ui/Badge'
import Field from '../ui/Field'
import Section from '../ui/Section'
import { useEffect, useState } from 'react'
import { RETURN_CONFIRM_MS, RETURN_KIND, isRecentlyReturned, overrunOf, plannedOf, returnDue } from '../../lib/resourceReturns'

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
const laborGridClass = 'grid grid-cols-1 gap-4 md:grid-cols-[1.4fr_.7fr_.9fr_.9fr]'
const resourceListClass = 'grid gap-2'
const resourceRowClass = 'flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[var(--app-line)] bg-[var(--app-soft-bg)] p-3 [&>span]:flex [&>span]:items-center [&>span]:gap-2 [&>span]:text-[var(--app-primary)] [&_strong]:text-sm [&_strong]:text-[var(--app-ink)] [&_label]:flex [&_label]:items-center [&_label]:gap-2 [&_label]:text-xs [&_label]:text-[var(--app-muted)] [&_input]:h-9 [&_input]:w-24 [&_input]:rounded-lg [&_input]:border [&_input]:border-[var(--app-field-border)] [&_input]:bg-[var(--app-panel)] [&_input]:px-3 [&_input]:text-sm'
const closeoutGridClass = 'grid gap-3 md:grid-cols-4'
const closeoutCardClass = 'grid gap-1 rounded-xl border border-[var(--app-line)] bg-[var(--app-soft-bg)] p-3 [&_span]:text-[9px] [&_span]:font-extrabold [&_span]:uppercase [&_span]:tracking-[.1em] [&_span]:text-[var(--app-muted)] [&_strong]:text-sm [&_strong]:text-[var(--app-ink)]'

function formatDateTime(value, fallback = 'Not recorded') {
  return value ? new Date(value).toLocaleString() : fallback
}

const returnRowClass = 'grid grid-cols-1 items-center gap-4 rounded-xl border border-[var(--app-line)] bg-[var(--app-soft-bg)] p-4 md:grid-cols-[1.5fr_80px_160px_1fr]'
const cellLabelClass = 'block text-[9px] font-extrabold uppercase tracking-[.1em] text-[var(--app-muted)]'
const qtyInputClass = 'mt-1 h-9 w-full rounded-lg border border-[var(--app-field-border)] bg-[var(--app-panel)] px-2 text-sm text-[var(--app-ink)] outline-none focus:border-[var(--app-field-focus)]'
const returnButtonClass = 'inline-flex h-9 items-center gap-2 rounded-lg border border-[var(--warning)] bg-[var(--app-badge-orange-bg)] px-3 text-xs font-bold text-[var(--app-badge-orange-text)] transition hover:brightness-95'

function ActualResourceSection({ title, note, rows, icon: Icon, update, onReturn, kind, emptyText, locked = false }) {
  // One re-render when the newest confirmation expires - no interval left running.
  const [, tick] = useState(0)
  const newestReturn = Math.max(0, ...rows.map(row => row.returnedAt || 0))
  useEffect(() => {
    if (!newestReturn) return
    const remaining = newestReturn + RETURN_CONFIRM_MS - Date.now()
    if (remaining <= 0) return
    const timer = setTimeout(() => tick(value => value + 1), remaining)
    return () => clearTimeout(timer)
  }, [newestReturn])

  return (
    <Section compact title={title} note={note}>
      {rows.length ? (
        <div className={resourceListClass}>
          {rows.map((row, index) => {
            const due = returnDue(row, kind)
            const over = overrunOf(row)
            const isTool = kind === RETURN_KIND.TOOL
            return (
              <div className={returnRowClass} key={`${row.item}-${index}`}>
                <span className="flex min-w-0 items-center gap-2 text-[var(--app-primary)]">
                  <Icon size={15} />
                  <strong className="truncate text-sm text-[var(--app-ink)]">{row.item}</strong>
                </span>

                <span className="md:justify-self-center">
                  <span className={cellLabelClass}>{isTool ? 'Taken' : 'Issued'}</span>
                  <strong className="mt-1 block text-sm text-[var(--app-ink)]">{plannedOf(row) || '—'}</strong>
                </span>

                {/* A tool is not consumed, so there is no "used" figure to record for it. */}
                {isTool ? <span className="hidden md:block" /> : (
                  <label>
                    <span className={cellLabelClass}>Used qty</span>
                    <input className={`${qtyInputClass} max-w-[140px] disabled:cursor-not-allowed disabled:bg-[var(--app-table-header-bg)] disabled:text-[var(--app-muted)]`} type="number" min="0" value={row.actualQuantity ?? ''} onChange={event => update(index, event.target.value)} placeholder="0" disabled={locked} />
                  </label>
                )}

                <div className="flex flex-wrap items-center justify-start gap-2 md:justify-end">
                  {over > 0 && <Badge tone="orange">Over by {over}</Badge>}
                  {row.returned
                    ? isRecentlyReturned(row)
                      ? <Badge tone="green"><Check size={12} /> Returned {row.returnedQuantity}</Badge>
                      : <Badge tone="neutral">Returned</Badge>
                    : due > 0 && !locked
                      ? (
                        <button type="button" className={returnButtonClass} onClick={() => onReturn(index)}
                          title={isTool ? 'Confirm the tool is back in the store' : 'Return the unused quantity to the store'}>
                          <Undo2 size={14} />Return {due}
                        </button>
                      )
                      : <Badge tone="green">Nothing to return</Badge>}
                </div>
              </div>
            )
          })}
        </div>
      ) : (
        <p className="rounded-xl border border-dashed border-[var(--app-line)] p-4 text-center text-xs text-[var(--app-muted)]">{emptyText}</p>
      )}
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
  showStartAction = false,
  showCompleteAction = false,
  showCloseAction = true,
  completionReady = false,
  completionBlocked = '',
  startBlocked = '',
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
  actualHours,
  setActualHours,
  actualStart,
  setActualStart,
  actualMaterials,
  setActualMaterials,
  actualTools,
  setActualTools,
  updateActualRow,
  workClosed,
  actualReady = false,
  closeWork,
  returnResource,
  outstanding = [],
  currentUser
}) {
  const closed = ['CLOSE', 'CLOSED'].includes(String(status || '').toUpperCase())
  if (!actualsEditable) {
    return (
      <div className={lockedClass}>
        <div className={lockedIconClass}><ShieldCheck size={22} /></div>
        <div>
          <strong>Available after work completion</strong>
          <p>{status === 'SCHED' ? 'Complete Plan and Failure preparation, then select Start Work. When execution is finished, select Resolve / Complete.' : 'When physical work is finished, select Resolve / Complete in the header to unlock execution notes and actual consumption.'}</p>
          <span>Current status: {status}</span>
          {status === 'SCHED' && !preparationReady && <button className={outlineButtonClass} onClick={() => setTab(planReady ? 'Failure' : 'Plan')}>Complete {planReady ? 'Failure' : 'Plan'} preparation</button>}
          {status === 'SCHED' && preparationReady && <button className={primaryButtonClass} onClick={() => setWorkStarted(true)}>Start work</button>}
          {status === 'INPRG' && <button className={primaryButtonClass} onClick={completeWork}>Resolve / complete work</button>}
        </div>
      </div>
    )
  }

  // The preparation stages advance on their own; these three are the points where a person
  // has to decide something, so they stay explicit. Exactly one is offered at a time.
  const step =
    status === 'SCHED' && showStartAction ? { label: 'Start work', icon: Play, run: () => setWorkStarted(true), ready: preparationReady, blocked: startBlocked || 'Complete start requirements first' }
    : status === 'INPRG' && showCompleteAction ? { label: 'Resolve / complete work', icon: Check, run: completeWork, ready: completionReady, blocked: completionBlocked || 'Complete execution requirements first' }
    : status === 'COMP' && showCloseAction ? {
      label: 'Close work order', icon: Lock, run: closeWork, ready: actualReady,
      // Returns are named explicitly - "complete the Actual tab" would not tell the
      // technician that a ladder is still in the van.
      blocked: outstanding.length
        ? `Return to store first: ${outstanding.map(entry => `${entry.quantity} × ${entry.item}`).join(', ')}`
        : 'Complete the Actual tab before closeout'
    }
    : null

  return (
    <>
      {step && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-[var(--app-line)] bg-[var(--app-soft-bg)] p-4">
          <div className="grid gap-1">
            <strong className="text-sm text-[var(--app-ink)]">{step.ready ? `Ready to ${step.label.toLowerCase()}` : 'Not ready yet'}</strong>
            <span className="text-xs text-[var(--app-muted)]">
              {step.ready ? 'Earlier stages were approved and scheduled automatically.' : step.blocked}
            </span>
          </div>
          <button className={primaryButtonClass} onClick={step.run} disabled={!step.ready} title={step.ready ? '' : step.blocked}>
            <step.icon size={15} />{step.label}
          </button>
        </div>
      )}

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
          <Field label="Technician Remarks" value={technicianRemarks} onChange={event => setTechnicianRemarks(event.target.value)} type="textarea" required disabled={closed} />
          <Field label="Completion Notes" value={completionNotes} onChange={event => setCompletionNotes(event.target.value)} type="textarea" required disabled={closed} />
        </div>
      </Section>

      <Section compact title="Actual Labor">
        <div className={laborGridClass}>
          <Field label="Technicians / Labor" value={actualLabor} onChange={event => setActualLabor(event.target.value)} required disabled={closed} />
          <Field label="Actual Labor Hours" value={actualHours} onChange={event => setActualHours(event.target.value)} type="number" required disabled={closed} />
          <Field label="Actual Start" value={actualStart} onChange={event => setActualStart(event.target.value)} type="datetime-local" disabled={closed} />
          <Field label="Actual Finish" value={actualFinish} onChange={event => setActualFinish(event.target.value)} type="datetime-local" disabled={closed} />
        </div>
      </Section>

      <ActualResourceSection
        title="Actual Materials Used"
        note="Record what was consumed. Anything issued and not used goes back to the store before closeout."
        rows={actualMaterials}
        icon={PackageCheck}
        kind={RETURN_KIND.MATERIAL}
        emptyText="Planned materials appear here once work is completed."
        update={(index, value) => updateActualRow(setActualMaterials, index, value)}
        onReturn={index => returnResource?.('material', index)}
        locked={closed}
      />
      <ActualResourceSection
        title="Actual Tools and Equipment Used"
        note="Tools are borrowed, not consumed - every one must be returned before the work order can close."
        rows={actualTools}
        icon={Wrench}
        kind={RETURN_KIND.TOOL}
        emptyText="Planned tools appear here once work is completed."
        update={(index, value) => updateActualRow(setActualTools, index, value)}
        onReturn={index => returnResource?.('tool', index)}
        locked={closed}
      />

      <Section compact title="Store Returns" note="Unused material and every borrowed tool must be back in the store before the work order closes">
        {outstanding.length ? (
          <div className="flex flex-wrap items-start gap-3 rounded-2xl bg-[var(--app-badge-orange-bg)] p-4 text-[var(--app-badge-orange-text)]">
            <Undo2 size={18} />
            <div className="grid gap-1">
              <strong className="text-sm">{outstanding.length} item{outstanding.length > 1 ? 's' : ''} still owed to the store</strong>
              <span className="text-xs">
                {outstanding.map(entry => `${entry.quantity} × ${entry.item} (${entry.kind === RETURN_KIND.TOOL ? 'tool' : 'unused material'})`).join(' · ')}
              </span>
              <span className="text-xs opacity-80">Closeout stays blocked until each is returned above.</span>
            </div>
          </div>
        ) : (
          <div className="flex items-center gap-3 rounded-2xl bg-[var(--app-badge-green-bg)] p-4 text-[var(--app-badge-green-text)]">
            <Check size={18} />
            <strong className="text-sm">Nothing outstanding — all material and tools accounted for</strong>
          </div>
        )}
      </Section>

      <Section compact title="Automatic Closeout" note="System populated when the work order is closed">
        <div className={closeoutGridClass}>
          <div className={closeoutCardClass}><span>Completion Date</span><strong>{actualFinish ? new Date(actualFinish).toLocaleString() : 'Pending'}</strong></div>
          <div className={closeoutCardClass}><span>Closed By</span><strong>{workClosed ? (currentUser?.name || currentUser?.username || 'Current user') : 'Pending'}</strong></div>
          <div className={closeoutCardClass}><span>Close Status</span><strong>{workClosed ? 'CLOSE' : 'Pending'}</strong></div>
          <div className={closeoutCardClass}><span>Asset History Update</span><strong>{workClosed ? 'Updated automatically' : 'Pending close'}</strong></div>
        </div>
      </Section>
    </>
  )
}

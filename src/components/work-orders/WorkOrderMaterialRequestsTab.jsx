import { AlertTriangle, Check, PackageCheck, Wrench } from 'lucide-react'
import Section from '../ui/Section'

const tableClass = 'overflow-hidden rounded-2xl border border-[var(--app-line)] bg-[var(--app-table-bg)]'
const headClass = 'grid grid-cols-[1.4fr_130px_150px_170px_190px] gap-3 bg-[var(--app-table-header-bg)] px-4 py-3 text-[length:var(--app-table-header-font-size)] font-extrabold uppercase tracking-[.08em] text-[var(--app-table-heading)]'
const rowClass = 'grid grid-cols-[1.4fr_130px_150px_170px_190px] items-center gap-3 border-t border-[var(--app-line)] px-4 py-3 text-[length:var(--app-table-font-size)] text-[var(--app-table-text)] hover:bg-[var(--app-table-hover-bg)]'
const resourceIconClass = type => `grid h-9 w-9 place-items-center rounded-xl ${type === 'Material' ? 'bg-[var(--app-badge-green-bg)] text-[var(--app-badge-green-text)]' : 'bg-[var(--app-badge-blue-bg)] text-[var(--app-badge-blue-text)]'}`
const summaryClass = blocked => `mt-3 flex items-start gap-3 rounded-2xl p-4 ${blocked ? 'bg-[var(--app-badge-orange-bg)] text-[var(--app-badge-orange-text)]' : 'bg-[var(--app-badge-green-bg)] text-[var(--app-badge-green-text)]'}`
const emptyClass = 'grid min-h-40 place-items-center content-center gap-2 rounded-2xl border border-dashed border-[var(--app-line)] bg-[var(--app-soft-bg)] p-6 text-center text-[var(--app-muted)]'
const selectClass = 'h-10 rounded-xl border border-[var(--app-field-border)] bg-[var(--app-panel)] px-3 text-sm text-[var(--app-ink)] outline-none focus:border-[var(--app-field-focus)] focus:ring-4 focus:ring-[var(--app-field-focus-ring)]'

export default function WorkOrderMaterialRequestsTab({
  resourceRequests,
  plannedResources,
  setPlannedResources,
  updatePlanRow,
  materialBlocked,
  primaryButtonClass,
  outlineButtonClass,
  setTab
}) {
  return (
    <Section compact title="Material Requests" note="Generated from resources requested in the Plan tab. Materials, tools, and equipment are handled directly inside this work order.">
      {resourceRequests.length ? (
        <>
          <div className={tableClass}>
            <div className={headClass}>
              <span>Planned resource</span>
              <span>Requested quantity</span>
              <span>Store / source</span>
              <span>Availability</span>
              <span>Action</span>
            </div>
            {plannedResources.map((resource, index) => ['Material', 'Tool', 'Equipment'].includes(resource.type) ? (
              <div className={rowClass} key={index}>
                <div className="flex min-w-0 items-center gap-3">
                  <span className={resourceIconClass(resource.type)}>{resource.type === 'Material' ? <PackageCheck size={16} /> : <Wrench size={16} />}</span>
                  <div className="grid min-w-0 gap-0.5">
                    <small className="text-[10px] font-bold uppercase tracking-[.08em] text-[var(--app-muted)]">{resource.type}</small>
                    <strong className="truncate text-sm text-[var(--app-ink)]">{resource.item || `Unnamed planned ${resource.type.toLowerCase()}`}</strong>
                  </div>
                </div>
                <span>{resource.quantity || 'Not set'}</span>
                <span>{resource.type === 'Material' ? 'DIWAN-MAIN' : 'Tool Crib'}</span>
                <select className={selectClass} value={resource.availability} onChange={event => updatePlanRow(setPlannedResources, index, 'availability', event.target.value)}>
                  <option>Available</option>
                  <option>Purchase Required</option>
                </select>
                <button className={resource.availability === 'Available' ? primaryButtonClass : outlineButtonClass}>
                  {resource.availability === 'Available' ? (resource.type === 'Material' ? 'Reserve' : 'Allocate') : 'Create purchase request'}
                </button>
              </div>
            ) : null)}
          </div>

          <div className={summaryClass(materialBlocked)}>
            {materialBlocked ? <AlertTriangle size={18} /> : <Check size={18} />}
            <div className="grid gap-1">
              <strong className="text-sm">{materialBlocked ? 'Waiting for Spare Parts' : 'Resources ready for execution'}</strong>
              <span className="text-xs">{materialBlocked ? 'One or more planned material items require purchase. Work Order status changed automatically to Waiting for Spare Parts.' : 'Planned materials, tools, and equipment are available for reservation or allocation.'}</span>
            </div>
          </div>
        </>
      ) : (
        <div className={emptyClass}>
          <PackageCheck size={28} />
          <strong className="text-sm text-[var(--app-ink)]">No resources requested</strong>
          <p className="text-xs">Add materials, tools, or equipment in the Plan tab.</p>
          <button className={outlineButtonClass} onClick={() => setTab('Plan')}>Go to Plan</button>
        </div>
      )}
    </Section>
  )
}

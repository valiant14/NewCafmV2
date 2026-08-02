import { AlertTriangle, Check, PackageCheck, Wrench } from 'lucide-react'
import Section from '../ui/Section'
import { statusDescription, statusTone } from '../../lib/statusMatrix'

const tableClass = 'overflow-hidden rounded-2xl border border-[var(--app-line)] bg-[var(--app-table-bg)]'
const headClass = 'grid grid-cols-[1.3fr_120px_140px_160px_150px_190px] gap-3 bg-[var(--app-table-header-bg)] px-4 py-3 text-[length:var(--app-table-header-font-size)] font-extrabold uppercase tracking-[.08em] text-[var(--app-table-heading)]'
const rowClass = 'grid grid-cols-[1.3fr_120px_140px_160px_150px_190px] items-center gap-3 border-t border-[var(--app-line)] px-4 py-3 text-[length:var(--app-table-font-size)] text-[var(--app-table-text)] hover:bg-[var(--app-table-hover-bg)]'
const resourceIconClass = type => `grid h-9 w-9 place-items-center rounded-xl ${type === 'Material' ? 'bg-[var(--app-badge-green-bg)] text-[var(--app-badge-green-text)]' : 'bg-[var(--app-badge-blue-bg)] text-[var(--app-badge-blue-text)]'}`
const summaryClass = blocked => `mt-3 flex items-start gap-3 rounded-2xl p-4 ${blocked ? 'bg-[var(--app-badge-orange-bg)] text-[var(--app-badge-orange-text)]' : 'bg-[var(--app-badge-green-bg)] text-[var(--app-badge-green-text)]'}`
const emptyClass = 'grid min-h-40 place-items-center content-center gap-2 rounded-2xl border border-dashed border-[var(--app-line)] bg-[var(--app-soft-bg)] p-6 text-center text-[var(--app-muted)]'
const statusClass = status => `w-fit rounded-full px-2.5 py-1 text-[10px] font-extrabold uppercase tracking-[.08em] ${statusTone(status) === 'orange' ? 'bg-[var(--app-badge-orange-bg)] text-[var(--app-badge-orange-text)]' : statusTone(status) === 'green' ? 'bg-[var(--app-badge-green-bg)] text-[var(--app-badge-green-text)]' : statusTone(status) === 'blue' ? 'bg-[var(--app-badge-blue-bg)] text-[var(--app-badge-blue-text)]' : 'bg-[var(--app-badge-neutral-bg)] text-[var(--app-badge-neutral-text)]'}`
const availabilityClass = availability => `w-fit rounded-full px-2.5 py-1 text-[10px] font-extrabold uppercase tracking-[.08em] ${availability === 'Available' ? 'bg-[var(--app-badge-green-bg)] text-[var(--app-badge-green-text)]' : 'bg-[var(--app-badge-orange-bg)] text-[var(--app-badge-orange-text)]'}`

export default function WorkOrderMaterialRequestsTab({
  resourceRequests,
  plannedResources,
  setPlannedResources,
  updatePlanRow,
  getAvailability,
  materialBlocked,
  primaryButtonClass,
  outlineButtonClass,
  setTab,
  workOrderContext = {},
  onCreatePurchaseRequest,
  onCreateReservation
}) {
  const actionResource = (index, resource) => {
    const availability = getAvailability(resource).availability
    const stock = getAvailability(resource)
    const nextStatus = availability === 'Purchase Required' || availability === 'Not Found' ? 'WAPPR' : 'ENTERED'
    const transaction = nextStatus === 'WAPPR'
      ? onCreatePurchaseRequest?.({
        workOrder: workOrderContext.number,
        type: resource.type,
        item: resource.item,
        quantity: resource.quantity || 0,
        source: stock.source,
        availableQuantity: stock.availableQuantity,
        site: workOrderContext.site,
        department: workOrderContext.department
      })
      : onCreateReservation?.({
        workOrder: workOrderContext.number,
        type: resource.type,
        item: resource.item,
        quantity: resource.quantity || 0,
        source: stock.source,
        availableQuantity: stock.availableQuantity,
        site: workOrderContext.site,
        department: workOrderContext.department,
        status: nextStatus,
        statusDescription: statusDescription('inventoryUsage', nextStatus)
      })
    setPlannedResources(rows => rows.map((row, rowIndex) => rowIndex === index ? {
      ...row,
      requestStatus: nextStatus,
      transactionRef: transaction?.purchaseRequest || transaction?.reservation || row.transactionRef
    } : row))
  }

  return (
    <Section compact title="Material Requests" note="Available stock creates a Reservation / Allocation. Unavailable stock creates a Purchase Requisition for procurement.">
      {resourceRequests.length ? (
        <>
          <div className={tableClass}>
            <div className={headClass}>
              <span>Planned resource</span>
              <span>Requested quantity</span>
              <span>Store / source</span>
              <span>Availability</span>
              <span>Request status</span>
              <span>Action</span>
            </div>
            {plannedResources.map((resource, index) => {
              if (!['Material', 'Tool', 'Equipment'].includes(resource.type)) return null
              const stock = getAvailability(resource)
              return (
                <div className={rowClass} key={index}>
                  <div className="flex min-w-0 items-center gap-3">
                    <span className={resourceIconClass(resource.type)}>{resource.type === 'Material' ? <PackageCheck size={16} /> : <Wrench size={16} />}</span>
                    <div className="grid min-w-0 gap-0.5">
                      <small className="text-[10px] font-bold uppercase tracking-[.08em] text-[var(--app-muted)]">{resource.type}{stock.itemNumber ? ` · ${stock.itemNumber}` : ''}</small>
                      <strong className="truncate text-sm text-[var(--app-ink)]">{resource.item || `Unnamed planned ${resource.type.toLowerCase()}`}</strong>
                    </div>
                  </div>
                  <span>{resource.quantity || 'Not set'}</span>
                  <span>{stock.source}</span>
                  <span className={availabilityClass(stock.availability)}>{stock.availability}</span>
                  <span className={statusClass(resource.requestStatus)}>{resource.requestStatus ? `${resource.requestStatus} · ${statusDescription(resource.requestStatus === 'WAPPR' ? 'purchaseRequisition' : 'inventoryUsage', resource.requestStatus)}${resource.transactionRef ? ` · ${resource.transactionRef}` : ''}` : `Stock: ${stock.availableQuantity ?? '-'}`}</span>
                  <button className={stock.availability === 'Available' ? primaryButtonClass : outlineButtonClass} onClick={() => actionResource(index, resource)}>
                    {stock.availability === 'Available' ? (resource.type === 'Material' ? 'Reserve' : 'Allocate') : 'Create purchase request'}
                  </button>
                </div>
              )
            })}
          </div>

          <div className={summaryClass(materialBlocked)}>
            {materialBlocked ? <AlertTriangle size={18} /> : <Check size={18} />}
            <div className="grid gap-1">
              <strong className="text-sm">{materialBlocked ? 'Work order on HOLD' : 'Resources ready for execution'}</strong>
              <span className="text-xs">{materialBlocked ? 'One or more planned material items require purchase. Work Order status changes automatically to HOLD until the request is created or stock is available.' : 'Planned materials, tools, and equipment are available for reservation or allocation.'}</span>
            </div>
          </div>
        </>
      ) : (
        <div className={emptyClass}>
          <PackageCheck size={28} />
          <strong className="text-sm text-[var(--app-ink)]">No resources requested</strong>
          <p className="text-xs">Nothing is generated automatically. Add materials, tools, or equipment manually in the Plan tab when required.</p>
          <button className={outlineButtonClass} onClick={() => setTab('Plan')}>Go to Plan</button>
        </div>
      )}
    </Section>
  )
}

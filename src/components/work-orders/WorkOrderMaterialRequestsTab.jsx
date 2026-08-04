import { AlertTriangle, Check, PackageCheck, Wrench } from 'lucide-react'
import Section from '../ui/Section'
import Badge from '../ui/Badge'
import { statusDescription, statusTone } from '../../lib/statusMatrix'
import { materialStatusFor, materialStatusTone } from '../../lib/inventory'

const tableClass = 'overflow-hidden rounded-2xl border border-[var(--app-line)] bg-[var(--app-table-bg)]'
const headClass = 'grid grid-cols-[1.2fr_100px_130px_140px_130px_150px_180px] gap-3 bg-[var(--app-table-header-bg)] px-4 py-3 text-[length:var(--app-table-header-font-size)] font-extrabold uppercase tracking-[.08em] text-[var(--app-table-heading)]'
const rowClass = 'grid grid-cols-[1.2fr_100px_130px_140px_130px_150px_180px] items-center gap-3 border-t border-[var(--app-line)] px-4 py-3 text-[length:var(--app-table-font-size)] text-[var(--app-table-text)] hover:bg-[var(--app-table-hover-bg)]'
const resourceIconClass = type => `grid h-9 w-9 place-items-center rounded-xl ${type === 'Material' ? 'bg-[var(--app-badge-green-bg)] text-[var(--app-badge-green-text)]' : 'bg-[var(--app-badge-blue-bg)] text-[var(--app-badge-blue-text)]'}`
const summaryClass = blocked => `mt-3 flex items-start gap-3 rounded-2xl p-4 ${blocked ? 'bg-[var(--app-badge-orange-bg)] text-[var(--app-badge-orange-text)]' : 'bg-[var(--app-badge-green-bg)] text-[var(--app-badge-green-text)]'}`
const emptyClass = 'grid min-h-40 place-items-center content-center gap-2 rounded-2xl border border-dashed border-[var(--app-line)] bg-[var(--app-soft-bg)] p-6 text-center text-[var(--app-muted)]'
const statusClass = status => `w-fit rounded-full px-2.5 py-1 text-[10px] font-extrabold uppercase tracking-[.08em] ${statusTone(status) === 'orange' ? 'bg-[var(--app-badge-orange-bg)] text-[var(--app-badge-orange-text)]' : statusTone(status) === 'green' ? 'bg-[var(--app-badge-green-bg)] text-[var(--app-badge-green-text)]' : statusTone(status) === 'blue' ? 'bg-[var(--app-badge-blue-bg)] text-[var(--app-badge-blue-text)]' : 'bg-[var(--app-badge-neutral-bg)] text-[var(--app-badge-neutral-text)]'}`
const availabilityClass = availability => `w-fit rounded-full px-2.5 py-1 text-[10px] font-extrabold uppercase tracking-[.08em] ${['Available', 'Reserved', 'Allocated', 'Received'].includes(availability) ? 'bg-[var(--app-badge-green-bg)] text-[var(--app-badge-green-text)]' : availability === 'Procurement linked' ? 'bg-[var(--app-badge-purple-bg)] text-[var(--app-badge-purple-text)]' : 'bg-[var(--app-badge-orange-bg)] text-[var(--app-badge-orange-text)]'}`
const requestedQuantity = resource => Number(resource.quantity || 0)
const hasFulfillment = resource => Boolean(resource.reservation)
const hasProcurement = resource => Boolean(resource.purchaseRequest || resource.purchaseOrder)
const liveReservationFor = (resource, reservations = []) =>
  resource.reservation ? reservations.find(row => String(row.reservation) === String(resource.reservation)) : null
// The status stored on the planned row is only a snapshot taken when the request was raised.
// Advancing a requisition or order is Supply Chain's job, and writing back to the work order
// needs work-order edit rights they do not have - so the requisition and order records are
// read live here, exactly as the reservation already was. Without this a work order sat on
// "PR waiting approval" for ever, however far procurement had actually got.
const sameRef = (left, right) => Boolean(left) && String(left).trim() === String(right).trim()
const liveProcurementFor = (resource, purchaseRequests = [], purchaseOrders = []) => {
  const request = resource.purchaseRequest
    ? purchaseRequests.find(row => sameRef(row.purchaseRequest, resource.purchaseRequest))
    : null
  // The order is found three ways because only one of them is reliable: the planned row knows
  // it only if the order existed when the row was written, and an approved requisition does not
  // always record the order it produced - but the order always names its source requisition.
  const order =
    purchaseOrders.find(row => sameRef(row.purchaseOrder, resource.purchaseOrder)) ||
    purchaseOrders.find(row => sameRef(row.purchaseOrder, request?.purchaseOrder)) ||
    purchaseOrders.find(row => sameRef(row.purchaseRequest, resource.purchaseRequest)) ||
    null
  return { request, order, orderNumber: order?.purchaseOrder || resource.purchaseOrder || '' }
}
const resourceWithLiveReservation = (resource, reservations = [], purchaseRequests = [], purchaseOrders = []) => {
  const reservation = liveReservationFor(resource, reservations)
  if (reservation) return {
    ...resource,
    requestStatus: reservation.status || resource.requestStatus,
    supplyChainStatus: reservation.statusDescription || statusDescription('inventoryUsage', reservation.status) || resource.supplyChainStatus
  }
  const { request, order, orderNumber } = liveProcurementFor(resource, purchaseRequests, purchaseOrders)
  // A requisition that has been approved into an order carries its number, so the row follows
  // the chain forward on its own.
  if (order) return {
    ...resource,
    purchaseOrder: orderNumber,
    requestStatus: order.status || resource.requestStatus,
    supplyChainStatus: statusDescription('purchaseOrder', order.status) || resource.supplyChainStatus
  }
  if (request) return {
    ...resource,
    requestStatus: request.status || resource.requestStatus,
    supplyChainStatus: statusDescription('purchaseRequisition', request.status) || resource.supplyChainStatus
  }
  return resource
}
const materialStatusForResource = (resource, stock, materials, reservations = [], purchaseRequests = [], purchaseOrders = []) => {
  const liveResource = resourceWithLiveReservation(resource, reservations, purchaseRequests, purchaseOrders)
  if (liveResource.reservation) return liveResource.type === 'Material' ? 'Allocated' : ''
  if (liveResource.purchaseOrder) return 'On PO'
  if (liveResource.purchaseRequest) return 'On PR'
  return materialStatusFor(stock.itemNumber, materials)
}
const requestStatusFor = (resource, reservations = [], purchaseRequests = [], purchaseOrders = []) => {
  const liveResource = resourceWithLiveReservation(resource, reservations, purchaseRequests, purchaseOrders)
  if (liveResource.reservation) {
    const status = ['STAGED', 'COMPLETE', 'CANCELLED'].includes(liveResource.requestStatus) ? liveResource.requestStatus : 'ENTERED'
    return {
      status,
      label: liveResource.supplyChainStatus?.startsWith('Reservation') ? liveResource.supplyChainStatus : statusDescription('inventoryUsage', status),
      ref: liveResource.reservation
    }
  }
  if (liveResource.purchaseOrder) return {
    status: liveResource.requestStatus || 'WAPPR',
    label: liveResource.supplyChainStatus || statusDescription('purchaseOrder', liveResource.requestStatus || 'WAPPR'),
    ref: liveResource.purchaseOrder
  }
  if (liveResource.purchaseRequest) return {
    status: liveResource.requestStatus || 'WAPPR',
    label: liveResource.supplyChainStatus || statusDescription('purchaseRequisition', liveResource.requestStatus || 'WAPPR'),
    ref: liveResource.purchaseRequest
  }
  return null
}
const actionStateFor = (resource, stock, reservations = [], purchaseRequests = [], purchaseOrders = []) => {
  const liveResource = resourceWithLiveReservation(resource, reservations, purchaseRequests, purchaseOrders)
  const quantity = requestedQuantity(resource)
  // Nothing can be reserved, allocated or purchased for a row that does not say what it is, or
  // that names something the master does not hold - the store would be issuing an unknown.
  if (!String(resource.item || '').trim()) return { kind: 'none', label: 'Name the item first', disabled: true, availability: 'Item needed' }
  if (stock.availability === 'Not Found') return { kind: 'none', label: 'Not in master', disabled: true, availability: 'Unknown item' }
  if (!quantity) return { kind: 'none', label: 'Set quantity', disabled: true, availability: 'Quantity needed' }
  if (hasFulfillment(liveResource)) {
    const complete = liveResource.requestStatus === 'COMPLETE'
    return { kind: 'none', label: complete ? 'Delivered' : liveResource.type === 'Material' ? 'Reserved' : 'Allocated', disabled: true, availability: complete ? 'Received' : liveResource.type === 'Material' ? 'Reserved' : 'Allocated' }
  }
  if (liveResource.purchaseOrder && liveResource.requestStatus === 'CLOSE') return { kind: 'reserve', label: 'Reserve received stock', availability: 'Received', source: `Received via ${liveResource.purchaseOrder}`, availableQuantity: quantity }
  if (hasProcurement(liveResource)) return { kind: 'none', label: liveResource.purchaseOrder ? 'PO linked' : 'PR created', disabled: true, availability: 'Procurement linked' }
  if (Number(stock.availableQuantity || 0) >= quantity) return { kind: 'reserve', label: resource.type === 'Material' ? 'Reserve' : 'Allocate', availability: 'Available' }
  return { kind: 'purchase', label: 'Create purchase request', availability: 'Purchase Required' }
}

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
  materials = [],
  reservations = [],
  purchaseRequests = [],
  purchaseOrders = [],
  workOrderContext = {},
  onCreatePurchaseRequest,
  onCreateReservation,
  onUpdateWorkOrder
}) {
  const actionResource = (index, resource) => {
    const stock = getAvailability(resource)
    const action = actionStateFor(resource, stock, reservations, purchaseRequests, purchaseOrders)
    if (action.disabled || action.kind === 'none') return
    const nextStatus = action.kind === 'purchase' ? 'WAPPR' : 'ENTERED'
    // Buy the gap, not the whole line. Stock already on the shelf is issued to the job, so
    // requesting the full planned quantity would over-order by whatever is in the store.
    const planned = requestedQuantity(resource)
    const onHand = Math.max(0, Number(stock.availableQuantity || 0))
    const shortfall = Math.max(0, planned - onHand)
    const transaction = action.kind === 'purchase'
      ? onCreatePurchaseRequest?.({
        workOrder: workOrderContext.number,
        resourceRequestId: resource.resourceRequestId,
        resourceIndex: index,
        type: resource.type,
        item: resource.item,
        itemCode: resource.itemCode || stock.itemNumber,
        quantity: shortfall,
        plannedQuantity: planned,
        availableQuantity: onHand,
        source: stock.storeCode || stock.source,
        site: workOrderContext.site,
        department: workOrderContext.department
      })
      : onCreateReservation?.({
        workOrder: workOrderContext.number,
        resourceRequestId: resource.resourceRequestId,
        resourceIndex: index,
        type: resource.type,
        item: resource.item,
        itemCode: resource.itemCode || stock.itemNumber,
        quantity: resource.quantity || 0,
        source: action.storeCode || stock.storeCode || action.source || stock.source,
        availableQuantity: action.availableQuantity ?? stock.availableQuantity,
        site: workOrderContext.site,
        department: workOrderContext.department,
        purchaseRequest: resource.purchaseRequest,
        purchaseOrder: resource.purchaseOrder,
        status: nextStatus,
        statusDescription: statusDescription('inventoryUsage', nextStatus)
      })
    const linkedResource = {
      ...resource,
      requestStatus: nextStatus,
      transactionRef: transaction?.purchaseRequest || transaction?.reservation || resource.transactionRef,
      purchaseRequest: transaction?.purchaseRequest || resource.purchaseRequest,
      purchaseOrder: transaction?.purchaseOrder || resource.purchaseOrder,
      reservation: transaction?.reservation || resource.reservation,
      supplyChainStatus: transaction?.purchaseRequest ? 'PR waiting approval' : 'Reservation entered'
    }
    const nextRows = plannedResources.map((row, rowIndex) => rowIndex === index ? linkedResource : row)
    setPlannedResources(nextRows)
    onUpdateWorkOrder?.(workOrderContext.number, { 'PLANNED RESOURCES': nextRows })
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
              <span>Material status</span>
              <span>Request status</span>
              <span>Action</span>
            </div>
            {plannedResources.map((resource, index) => {
              if (!['Material', 'Tool', 'Equipment'].includes(resource.type)) return null
              const stock = getAvailability(resource)
              const action = actionStateFor(resource, stock, reservations, purchaseRequests, purchaseOrders)
              const requestStatus = requestStatusFor(resource, reservations, purchaseRequests, purchaseOrders)
              const materialStatus = materialStatusForResource(resource, stock, materials, reservations, purchaseRequests, purchaseOrders)
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
                  <span className={availabilityClass(action.availability)}>{action.availability}</span>
                  {/* Supply-chain position of the item itself. Display only - nothing here
                      raises a purchase request. */}
                  <span>{materialStatus
                    ? <Badge tone={materialStatusTone(materialStatus)}>{materialStatus}</Badge>
                    : <span className="text-[var(--app-muted)]">—</span>}</span>
                  <span className={statusClass(requestStatus?.status)}>{requestStatus ? `${requestStatus.status} · ${requestStatus.label}${requestStatus.ref ? ` · ${requestStatus.ref}` : ''}` : `Stock: ${stock.availableQuantity ?? '-'}`}</span>
                  <button className={action.kind === 'reserve' ? primaryButtonClass : outlineButtonClass} disabled={action.disabled} onClick={() => actionResource(index, resource)}>
                    {action.label}
                  </button>
                </div>
              )
            })}
          </div>

          <div className={summaryClass(materialBlocked)}>
            {materialBlocked ? <AlertTriangle size={18} /> : <Check size={18} />}
            <div className="grid gap-1">
              <strong className="text-sm">{materialBlocked ? 'Material shortage blocks scheduling' : 'Resources ready for execution'}</strong>
              <span className="text-xs">{materialBlocked ? 'One or more planned material items require purchase. Only the shortfall is ordered - stock already on the shelf is issued to this job. Scheduling stays blocked until the request is created or stock arrives; a Facility Manager can pause the SLA clock by putting the work order on material hold.' : 'Planned materials, tools, and equipment are available for reservation or allocation.'}</span>
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

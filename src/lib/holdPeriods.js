// A work order waiting on out-of-stock material should not burn its SLA. Every hold is
// recorded as a period on the order, and the time inside those periods is added back onto
// the target date - so resuming gives back exactly the time that was lost.
//
// The four separate breach predicates in the app (the editor label, the notification
// builder, slaBreached and the dashboard) all read the pause through this module. That is
// the point of it: a pause that only some of them honour is worse than no pause.

export const HOLD_MATERIAL = 'ON_HOLD_MATERIAL'

const periodsOf = order => (Array.isArray(order?.holdPeriods) ? order.holdPeriods : [])

const time = value => {
  if (!value) return null
  const parsed = new Date(value).getTime()
  return Number.isNaN(parsed) ? null : parsed
}

// An open period - one with no endedAt - means the order is on hold right now.
export const activeHold = order => periodsOf(order).find(period => period && !period.endedAt) || null

export const isOnHold = order => Boolean(activeHold(order))

// Total time spent on hold, closed periods plus the open one running up to `now`.
export const heldMs = (order, now = Date.now()) => periodsOf(order).reduce((total, period) => {
  const started = time(period?.startedAt)
  if (started === null) return total
  const ended = period?.endedAt ? time(period.endedAt) : now
  if (ended === null || ended <= started) return total
  return total + (ended - started)
}, 0)

// The target date shifted forward by everything the order has spent on hold.
export const effectiveTargetTime = (targetTime, order, now = Date.now()) => {
  if (!targetTime) return targetTime
  return targetTime + heldMs(order, now)
}

// Held orders are never breached - the clock is not running against them.
export const slaPaused = order => isOnHold(order)

export const startHold = (order, reason = 'MATERIAL', at = new Date()) => {
  if (isOnHold(order)) return periodsOf(order)
  return [...periodsOf(order), { startedAt: new Date(at).toISOString(), endedAt: null, reason }]
}

export const endHold = (order, at = new Date()) => {
  const open = activeHold(order)
  if (!open) return periodsOf(order)
  return periodsOf(order).map(period => (
    period === open ? { ...period, endedAt: new Date(at).toISOString() } : period
  ))
}

// Human-readable, for the hold banner on the detail view.
export const holdSince = order => activeHold(order)?.startedAt || ''

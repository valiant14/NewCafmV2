// What has to go back to the store before a work order can be closed.
//
// Materials and tools are returned for different reasons, so they are counted differently:
//
//   Material  issued 5, used 4  ->  1 goes back. Consumed quantity is gone for good.
//   Tool      taken 1           ->  1 goes back, always. A tool is borrowed, not consumed.
//
// A work order that closes with a ladder still on site has lost the ladder, which is why
// closeout waits on these rather than merely reporting them.

export const RETURN_KIND = { MATERIAL: 'Material', TOOL: 'Tool' }

const number = value => Number(value) || 0

// Planned quantity rides along on the row because actual rows are spread from plan rows.
export const plannedOf = row => number(row?.quantity)
export const usedOf = row => number(row?.actualQuantity)

// How much of this row is still owed to the store.
export const returnDue = (row, kind = RETURN_KIND.MATERIAL) => {
  if (!row?.item) return 0
  if (row.returned) return 0
  if (kind === RETURN_KIND.TOOL) return plannedOf(row)
  return Math.max(0, plannedOf(row) - usedOf(row))
}

export const needsReturn = (row, kind) => returnDue(row, kind) > 0

// Using more than was planned is an overrun to explain, not a return to raise.
export const overrunOf = row => Math.max(0, usedOf(row) - plannedOf(row))

// How long the "Returned n" confirmation stays loud before settling down. The row remains
// settled either way - only the badge is temporary.
export const RETURN_CONFIRM_MS = 4000

export const markReturned = (row, now = Date.now()) => ({
  ...row,
  returned: true,
  returnedQuantity: returnDue(row, row?.type === RETURN_KIND.MATERIAL ? RETURN_KIND.MATERIAL : RETURN_KIND.TOOL),
  returnedAt: now
})

export const isRecentlyReturned = (row, now = Date.now()) =>
  Boolean(row?.returned && row.returnedAt && now - row.returnedAt < RETURN_CONFIRM_MS)

// Everything still outstanding across both lists, ready to render as a blocking reason.
export const outstandingReturns = (materials = [], tools = []) => [
  ...materials.filter(row => needsReturn(row, RETURN_KIND.MATERIAL))
    .map(row => ({ item: row.item, quantity: returnDue(row, RETURN_KIND.MATERIAL), kind: RETURN_KIND.MATERIAL })),
  ...tools.filter(row => needsReturn(row, RETURN_KIND.TOOL))
    .map(row => ({ item: row.item, quantity: returnDue(row, RETURN_KIND.TOOL), kind: RETURN_KIND.TOOL }))
]

export const returnsSettled = (materials, tools) => outstandingReturns(materials, tools).length === 0

export const describeOutstanding = (materials, tools) =>
  outstandingReturns(materials, tools)
    .map(entry => `${entry.quantity} × ${entry.item}`)
    .join(', ')

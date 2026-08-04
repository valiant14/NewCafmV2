// A work order stores its priority as the bare number (PRIORTY = 3), but the dropdowns used to
// list "3 - Medium" as the whole value. Creating with the label and reading back the number left
// the field holding "3" against a list that had no such entry - flagged "Not in list", and one
// careless click would have written the label into a numeric column.
// The code is the value; the name is the hint beside it.
export const workOrderPriorities = [
  { value: '1', label: 'Emergency' },
  { value: '2', label: 'High' },
  { value: '3', label: 'Medium' },
  { value: '4', label: 'Low' }
]

export const priorityCode = value => {
  const digit = String(value ?? '').trim().match(/\d/)?.[0]
  return digit || ''
}

export const priorityLabel = value =>
  workOrderPriorities.find(priority => priority.value === priorityCode(value))?.label || ''

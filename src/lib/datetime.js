const pad = value => String(value).padStart(2, '0')

const isDateOnly = value => typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value.trim())

// `new Date('2026-08-01')` parses as UTC midnight, which shifts the day in some zones.
// Appending a time forces local parsing.
export const parseLocal = value => {
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value
  if (value === null || value === undefined || value === '') return null
  const date = isDateOnly(value) ? new Date(`${String(value).trim()}T00:00:00`) : new Date(value)
  return Number.isNaN(date.getTime()) ? null : date
}

export const toLocalDateInput = value => {
  const date = parseLocal(value)
  return date ? `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}` : ''
}

export const toLocalDateTimeInput = value => {
  const date = parseLocal(value)
  return date ? `${toLocalDateInput(date)}T${pad(date.getHours())}:${pad(date.getMinutes())}` : ''
}

export const nowLocalDate = () => toLocalDateInput(new Date())

export const nowLocalDateTime = () => toLocalDateTimeInput(new Date())

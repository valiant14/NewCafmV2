export const emptyStandardFilters = {
  site: '',
  department: '',
  status: '',
  from: '',
  to: ''
}

const valueFromKeys = (row, keys = []) => {
  for (const key of keys) {
    const value = row?.[key]
    if (value !== undefined && value !== null && String(value).trim() !== '') return String(value)
  }
  return ''
}

const dateTime = value => {
  if (!value) return null
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? null : date.getTime()
}

export function optionsFromRows(rows = [], keys = []) {
  return [...new Set(rows.map(row => valueFromKeys(row, keys)).filter(Boolean))].sort((a, b) => a.localeCompare(b, undefined, { numeric: true }))
}

// User records store the site as a display label ("Riyadh / 1031") while data rows
// carry the bare code ("1031"), so the code has to be pulled out before it can match.
export function siteCodeFromUser(user) {
  const site = String(user?.site || '').trim()
  if (!site || /^all sites$/i.test(site)) return ''
  return site.split('/').pop().trim()
}

// Pre-selects the signed-in user's site, but only when that site is actually present
// in the rows. Labor, materials and tools carry no site at all, so an unguarded default
// would match nothing and blank the whole list.
export function scopedStandardFilters(user, rows = [], siteKeys = ['site', 'SITE']) {
  const site = siteCodeFromUser(user)
  if (!site || !rows.some(row => valueFromKeys(row, siteKeys) === site)) return emptyStandardFilters
  return { ...emptyStandardFilters, site }
}

export function applyStandardFilters(rows = [], filters = emptyStandardFilters, keys = {}) {
  const siteKeys = keys.site || ['site', 'SITE']
  const departmentKeys = keys.department || ['department', 'DEPARTMENT', 'DEPARTMENT ', 'assignedDepartment', 'Assigned Department']
  const statusKeys = keys.status || ['status', 'STATUS', 'availability', 'pmStatus']
  const dateKeys = keys.date || ['reportedDate', 'REPORTED DATE', 'REPORTED DATE ', 'TARGET START ', 'startDate', 'inspectionDue']
  const fromTime = filters.from ? dateTime(filters.from) : null
  const toTime = filters.to ? dateTime(filters.to) : null

  return rows.filter(row => {
    const site = valueFromKeys(row, siteKeys)
    const department = valueFromKeys(row, departmentKeys)
    const status = valueFromKeys(row, statusKeys)
    const dateValue = valueFromKeys(row, dateKeys)
    const rowTime = dateTime(dateValue)

    if (filters.site && site !== filters.site) return false
    if (filters.department && department !== filters.department) return false
    if (filters.status && status !== filters.status) return false
    if (fromTime && rowTime && rowTime < fromTime) return false
    if (toTime && rowTime && rowTime > toTime) return false
    if ((fromTime || toTime) && !rowTime) return false
    return true
  })
}

import { sameDepartment } from './departments'

const text = value => String(value || '').trim()
const sameText = (left, right) => text(left).toLowerCase() === text(right).toLowerCase()

export const isActiveRoutingRecord = row => String(row?.status || 'Active').trim().toLowerCase() !== 'inactive'

const matchesScope = (row, { site = '', department = '', subDepartment = '' } = {}) => {
  if (site && !sameText(row.site, site)) return false
  if (department && !sameDepartment(row.department, department)) return false
  if (subDepartment && row.subDepartment && !sameText(row.subDepartment, subDepartment)) return false
  return true
}

const uniqueOptions = rows => [...new Map(rows.map(row => [text(row.name).toLowerCase(), {
  value: text(row.code),
  label: text(row.name)
}])).values()]
  .filter(option => option.value)
  .sort((left, right) => left.value.localeCompare(right.value, undefined, { numeric: true, sensitivity: 'base' }))

export const systemOptionsForScope = (rows = [], scope = {}) => uniqueOptions(
  rows.filter(row => isActiveRoutingRecord(row) && matchesScope(row, scope))
)

export const workGroupOptionsForScope = (rows = [], scope = {}) => uniqueOptions(
  rows.filter(row => isActiveRoutingRecord(row) && matchesScope(row, scope))
)

export const routingRecordByValue = (rows = [], value = '') => {
  const key = text(value)
  if (!key) return null
  return rows.find(row => sameText(row.code, key) || sameText(row.name, key)) || null
}

export const supervisorOptionsForScope = (laborRows = [], scope = {}) => laborRows
  .filter(person => {
    if (String(person.status || 'Active').trim().toLowerCase() === 'inactive') return false
    if (scope.site && !sameText(person.site, scope.site)) return false
    if (scope.department && !sameDepartment(person.department, scope.department)) return false
    if (scope.subDepartment && person.subDepartment && !sameText(person.subDepartment, scope.subDepartment)) return false
    return Boolean(text(person.name))
  })
  .map(person => ({
    value: text(person.personId),
    label: [text(person.name), text(person.craft)].filter(Boolean).join(' / ')
  }))
  .sort((left, right) => left.value.localeCompare(right.value, undefined, { sensitivity: 'base' }))

export const supervisorValueForWorkGroup = (workGroup, laborRows = []) => {
  if (!workGroup?.supervisorId) return ''
  return laborRows.find(person => sameText(person.personId, workGroup.supervisorId))?.personId || ''
}

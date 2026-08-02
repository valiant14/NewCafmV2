import workbookData from './workbooks.json'
import { effectiveTargetTime, isOnHold } from '../lib/holdPeriods.js'
import assetSeeds, { assetOverrides } from './assetSeeds.js'
import { subDepartmentName } from '../lib/departments.js'

export const rowsToObjects = (rows = []) => {
  const headers = (rows[0] || []).map((header, index) => String(header || `Column ${index + 1}`).trim())
  return rows.slice(1).filter(row => row.some(value => value !== null && value !== '')).map(row =>
    Object.fromEntries(headers.map((header, index) => [header, row[index] ?? '']))
  )
}

// The client's asset sheet is incomplete - its PM sheet references six assets that are not
// on it, and one row is missing a location. Both gaps are filled from assetSeeds so every
// consumer of `assets` sees one complete register.
export const assets = [
  ...rowsToObjects(workbookData.assets.assets).map(row => ({
    ...row,
    // The sheet stores the sub department as a code; everything else in the app matches
    // on the name, so it is resolved once here rather than at each read site.
    'sub department': subDepartmentName(row['sub department']),
    ...(assetOverrides[row.assetnum] || {})
  })),
  ...assetSeeds
]
export const workOrders = rowsToObjects(workbookData['Work Order Tracking'].Sheet1)
export const pmRecords = rowsToObjects(workbookData.PM['PREVENTIVE MAINTENANCE'])
export const jobTasks = rowsToObjects(workbookData['JOB PLAN-TASKS']['JOB PLAN-TASKS'])
export const failureCodes = rowsToObjects(workbookData['FAILURE CODE']['FAILURE CODE'])
export const locations = rowsToObjects(workbookData.location.location)
export const statusMatrix = rowsToObjects(workbookData.IBM_Maximo_Status_Matrix['Maximo Status Matrix'])
export const uniqueCodeOptions = (rows, codeKey, descriptionKey) => [...new Map(rows.filter(row=>row[codeKey]).map(row=>[row[codeKey], { value: row[codeKey], label: row[descriptionKey] }])).values()]
export const failureClassOptions = uniqueCodeOptions(failureCodes, 'FAILURE CLASS ID', 'DESCRIPTION')

export const excelDate = value => {
  if (!value || typeof value === 'string') return value || '—'
  const date = new Date(Date.UTC(1899, 11, 30) + value * 86400000)
  return new Intl.DateTimeFormat('en', { day: '2-digit', month: 'short', year: 'numeric' }).format(date)
}
export const excelToDate = value => typeof value === 'number' ? new Date(Date.UTC(1899, 11, 30) + value * 86400000) : null
export const toDateTimeInput = value => {
  const date = typeof value === 'number' ? excelToDate(value) : value ? new Date(value) : null
  return date && !Number.isNaN(date.getTime()) ? new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 16) : ''
}
export const slaBreached = order => {
  // A work order held for material has its clock stopped, and time already spent on hold
  // is added back onto the target before lateness is judged.
  if (isOnHold(order)) return false
  const finish = excelToDate(order['TARGET FINISH '])
  if (!finish) return false
  const due = effectiveTargetTime(finish.getTime(), order)
  return Boolean(due < Date.now() && !['COMP', 'CLOSE', 'CAN'].includes(order.STATUS))
}

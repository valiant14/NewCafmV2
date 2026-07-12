import workbookData from './workbooks.json'

export const rowsToObjects = (rows = []) => {
  const headers = (rows[0] || []).map((header, index) => String(header || `Column ${index + 1}`).trim())
  return rows.slice(1).filter(row => row.some(value => value !== null && value !== '')).map(row =>
    Object.fromEntries(headers.map((header, index) => [header, row[index] ?? '']))
  )
}

export const assets = rowsToObjects(workbookData.assets.assets)
export const workOrders = rowsToObjects(workbookData['Work Order Tracking'].Sheet1)
export const pmRecords = rowsToObjects(workbookData.PM['PREVENTIVE MAINTENANCE'])
export const jobTasks = rowsToObjects(workbookData['JOB PLAN-TASKS']['JOB PLAN-TASKS'])
export const failureCodes = rowsToObjects(workbookData['FAILURE CODE']['FAILURE CODE'])
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
  const finish = excelToDate(order['TARGET FINISH '])
  return Boolean(finish && finish < new Date() && !['COMP', 'CLOSE', 'CAN'].includes(order.STATUS))
}

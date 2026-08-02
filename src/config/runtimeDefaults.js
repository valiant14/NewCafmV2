export const assets = []
export const codingStructure = []
export const crafts = []
export const departments = []
export const excelDate = value => {
  if (!value) return ''
  const date = new Date(value)
  return Number.isNaN(date.getTime())
    ? String(value)
    : new Intl.DateTimeFormat('en', { day: '2-digit', month: 'short', year: 'numeric' }).format(date)
}
export const excelToDate = value => value ? new Date(value) : null
export const failureClassOptions = []
export const failureCodes = []
export const incidentSeed = []
export const jobPlans = []
export const jobTasks = []
export const labor = []
export const laborWorkMap = {}
export const locations = []
export const locationsMaster = []
export const materials = []
export const materialUsageMap = {}
export const permissionActions = ['view', 'create', 'edit', 'approve', 'close', 'import']
export const permissionModules = [
  'Overview',
  'Job Requests',
  'Work Orders',
  'Preventive Maintenance',
  'Incidents',
  'Job Plans',
  'Assets',
  'Labor',
  'Locations',
  'Failure Library',
  'Meters',
  'Materials',
  'Stores',
  'Tools & Equipment',
  'Reservations',
  'Purchase Requisitions',
  'Purchase Orders',
  'Users',
  'Roles & Permissions',
  'Sites',
  'Departments',
  'Settings'
]
export const pmRecords = []
export const pmSchedules = []
export const rolePermissionRows = []
export const rowsToObjects = () => []
export const serviceRequestSeed = []
export const slaBreached = () => false
export const statusMatrix = []
export const toDateTimeInput = value => {
  const date = value ? new Date(value) : null
  return date && !Number.isNaN(date.getTime()) ? new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 16) : ''
}
export const tools = []
export const toolUsageMap = {}
export const uniqueCodeOptions = () => []
export const users = []
export const workOrderSeeds = []
export const workOrders = []

const pageResources = {
  Overview: ['overviewSnapshot', 'workOrders'],
  'Job Requests': ['serviceRequests', 'assets', 'locations', 'sites', 'departments', 'failureCodes', 'applicationWorkflows'],
  'Work Orders': ['workOrders', 'assets', 'locations', 'sites', 'departments', 'workOrderWorkflow'],
  'Preventive Maintenance': ['pmSchedules', 'pmRules', 'assets', 'locations', 'jobPlans', 'jobTasks', 'sites', 'departments', 'storerooms', 'labor', 'workOrderWorkflow'],
  Incidents: ['incidents', 'sites', 'departments'],
  'Job Plans': ['jobPlans', 'jobTasks'],
  Assets: ['assets', 'locations', 'sites', 'departments'],
  Labor: ['labor', 'sites', 'departments'],
  Locations: ['locations', 'sites', 'departments'],
  'Failure Library': ['failureCodes'],
  Meters: ['meters', 'assets', 'locations', 'sites', 'departments', 'workOrders'],
  Stores: ['storerooms', 'inventoryStock', 'materials', 'tools', 'reservations', 'sites', 'applicationWorkflows'],
  Materials: ['materials', 'inventoryStock', 'storerooms', 'purchaseRequests', 'purchaseOrders', 'reservations', 'workOrderResources', 'applicationWorkflows'],
  'Tools & Equipment': ['tools', 'storerooms', 'purchaseRequests', 'purchaseOrders', 'reservations', 'workOrderResources', 'applicationWorkflows'],
  Reservations: ['reservations', 'inventoryStock', 'materials', 'tools', 'storerooms', 'workOrderResources', 'applicationWorkflows'],
  'Purchase Requisitions': ['purchaseRequests', 'purchaseOrders', 'workOrderResources', 'materials', 'tools', 'storerooms', 'applicationWorkflows'],
  'Purchase Orders': ['purchaseOrders', 'purchaseRequests', 'reservations', 'inventoryStock', 'materials', 'tools', 'storerooms', 'workOrderResources', 'applicationWorkflows'],
  Users: ['users', 'roles', 'sites', 'departments', 'labor'],
  'Roles & Permissions': ['roles'],
  Sites: ['sites'],
  Departments: ['departments'],
  'Work Order Workflow': ['workOrderWorkflow', 'applicationWorkflows'],
  Notifications: ['notificationRules'],
  'SMTP & SMS': ['connectors'],
  'PM Schedule Rules': ['pmRules', 'pmSchedules']
}

const workOrderDetailResources = [
  'labor', 'materials', 'inventoryStock', 'storerooms', 'tools',
  'failureCodes', 'notificationRules'
]

export const resourcesForPage = (page, routePath = '') => {
  const resources = pageResources[page] || []
  const workOrderDetail = page === 'Work Orders' && /^\/work-orders\/[^/]+/.test(routePath) && !routePath.endsWith('/new')
  return [...new Set(workOrderDetail ? [...resources, ...workOrderDetailResources] : resources)]
}

const tableResources = {
  'dbo.sites': ['sites'],
  'dbo.departments': ['departments'],
  'dbo.roles': ['roles'],
  'dbo.role_permissions': ['roles'],
  'dbo.users': ['users', 'roles'],
  'dbo.user_site_access': ['users'],
  'dbo.user_department_access': ['users'],
  'dbo.assets': ['assets'],
  'dbo.locations': ['locations'],
  'dbo.labor': ['labor'],
  'dbo.materials': ['materials'],
  'dbo.storerooms': ['storerooms'],
  'dbo.inventory_stock': ['inventoryStock'],
  'dbo.tools_equipment': ['tools'],
  'dbo.failure_library': ['failureCodes'],
  'dbo.work_orders': ['workOrders'],
  'dbo.work_order_resource_requests': ['workOrderResources'],
  'dbo.work_order_planned_labor': ['workOrderPlannedLabor'],
  'dbo.work_order_tasks': ['workOrderTasks'],
  'dbo.service_requests': ['serviceRequests'],
  'dbo.purchase_requisitions': ['purchaseRequests'],
  'dbo.purchase_orders': ['purchaseOrders'],
  'dbo.inventory_reservations': ['reservations'],
  'dbo.preventive_maintenance': ['pmSchedules'],
  'dbo.pm_schedule_rules': ['pmRules'],
  'dbo.smtp_sms_connectors': ['connectors'],
  'dbo.notification_rules': ['notificationRules'],
  'dbo.job_plans': ['jobPlans'],
  'dbo.job_plan_tasks': ['jobTasks'],
  'dbo.incidents': ['incidents'],
  'dbo.meter_readings': ['meters'],
  'dbo.work_order_workflow': ['workOrderWorkflow'],
  'dbo.work_order_workflow_steps': ['workOrderWorkflow'],
  'dbo.application_workflows': ['applicationWorkflows'],
  'dbo.application_workflow_steps': ['applicationWorkflows']
}

const overviewTables = new Set([
  'dbo.assets', 'dbo.incidents', 'dbo.work_orders', 'dbo.attachments',
  'dbo.preventive_maintenance', 'dbo.failure_library', 'dbo.meter_readings',
  'dbo.purchase_requisitions', 'dbo.purchase_orders', 'dbo.inventory_reservations'
])

export const resourcesForWorkspaceChange = change => {
  const table = String(change?.table || '').toLowerCase()
  return [...new Set([...(tableResources[table] || []), ...(overviewTables.has(table) ? ['overviewSnapshot'] : [])])]
}

export const workOrderChildTables = new Set([
  'dbo.work_order_resource_requests',
  'dbo.work_order_planned_labor',
  'dbo.work_order_tasks',
  'dbo.meter_readings',
  'dbo.purchase_requisitions',
  'dbo.purchase_orders',
  'dbo.inventory_reservations'
])

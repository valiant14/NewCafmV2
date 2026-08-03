import { Router } from 'express'
import authRouter from './auth.js'
import rolesRouter from './roles.js'
import usersRouter from './users.js'
import { crudRouter } from './crudFactory.js'
import inventoryStockRouter from './inventoryStock.js'
import { requireAuth } from '../middleware/auth.js'

const router = Router()

router.get('/health', (req, res) => res.json({ ok: true, service: 'backendCafm', realtime: Boolean(req.app.locals.io) }))
router.use('/auth', authRouter)
router.use(requireAuth)

router.use('/sites', crudRouter({
  moduleName: 'Sites',
  table: 'dbo.sites',
  key: 'site_code',
  columns: ['site_code', 'site_name', 'region', 'city', 'status', 'created_at', 'updated_at'],
  scope: { siteColumn: 'site_code', departmentColumn: null }
}))

router.use('/departments', crudRouter({
  moduleName: 'Departments',
  table: 'dbo.departments',
  key: 'sub_department_code',
  columns: ['sub_department_code', 'department_name', 'description', 'status', 'created_at', 'updated_at']
}))

router.use('/users', usersRouter)

router.use('/roles', rolesRouter)

router.use('/assets', crudRouter({
  moduleName: 'Assets',
  table: 'dbo.assets',
  key: 'asset_num',
  columns: ['asset_num', 'description', 'location_code', 'parent_asset_num', 'department_name', 'sub_department_code', 'priority', 'site_code', 'status', 'model_num', 'serial_num', 'install_date', 'quantity', 'created_at', 'updated_at'],
  scope: { siteColumn: 'site_code', departmentColumn: 'department_name' }
}))

router.use('/labor', crudRouter({
  moduleName: 'Labor',
  table: 'dbo.labor',
  key: 'labor_id',
  columns: ['labor_id', 'display_name', 'craft_code', 'craft_name', 'department_name', 'sub_department_code', 'site_code', 'availability', 'status', 'created_at', 'updated_at'],
  scope: { siteColumn: 'site_code', departmentColumn: 'department_name' }
}))

router.use('/locations', crudRouter({
  moduleName: 'Locations',
  table: 'dbo.locations',
  key: 'location_code',
  columns: ['location_code', 'description', 'location_type', 'status', 'priority', 'priority_description', 'site_code', 'building', 'building_category', 'department_name', 'created_at', 'updated_at'],
  scope: { siteColumn: 'site_code', departmentColumn: 'department_name' }
}))

router.use('/materials', crudRouter({
  moduleName: 'Materials',
  table: 'dbo.materials',
  key: 'item_code',
  columns: ['item_code', 'description', 'category', 'unit_of_measure', 'status', 'created_at', 'updated_at']
}))

router.use('/tools-equipment', crudRouter({
  moduleName: 'Tools & Equipment',
  table: 'dbo.tools_equipment',
  key: 'tool_code',
  columns: ['tool_code', 'description', 'category', 'location_code', 'quantity', 'low_level', 'status', 'inspection_due', 'created_at', 'updated_at']
}))

router.use('/failure-library', crudRouter({
  moduleName: 'Failure Library',
  table: 'dbo.failure_library',
  key: 'failure_library_id',
  columns: ['failure_library_id', 'failure_class_id', 'description', 'problem_code', 'problem_description', 'cause_code', 'cause_description', 'remedy_code', 'remedy_description', 'created_at', 'updated_at'],
  defaultOrder: 'failure_class_id, problem_code, cause_code, remedy_code'
}))

router.use('/storerooms', crudRouter({
  moduleName: 'Stores',
  table: 'dbo.storerooms',
  key: 'store_code',
  columns: ['store_code', 'store_name', 'site_code', 'status', 'created_at', 'updated_at']
}))

router.use('/inventory-stock', inventoryStockRouter)

router.use('/work-orders', crudRouter({
  moduleName: 'Work Orders',
  table: 'dbo.work_orders',
  key: 'work_order_num',
  columns: ['work_order_num', 'description', 'long_description', 'location_code', 'asset_num', 'status', 'work_type', 'priority', 'site_code', 'department_name', 'sub_department_code', 'assigned_department_name', 'target_start_at', 'target_finish_at', 'actual_start_at', 'actual_finish_at', 'reported_at', 'source_sr_num', 'failure_code', 'problem_code', 'cause_code', 'remedy_code', 'created_at', 'updated_at'],
  scope: { siteColumn: 'site_code', departmentColumn: 'department_name' }
}))

router.use('/work-order-resource-requests', crudRouter({
  moduleName: 'Work Orders',
  table: 'dbo.work_order_resource_requests',
  key: 'resource_request_id',
  columns: ['resource_request_id', 'work_order_num', 'resource_type', 'item_code', 'item_description', 'requested_quantity', 'available_quantity', 'store_code', 'site_code', 'department_name', 'source_type', 'availability_status', 'request_status', 'transaction_ref', 'purchase_request_num', 'purchase_order_num', 'reservation_num', 'supply_chain_status', 'created_at', 'updated_at'],
  scope: { siteColumn: 'site_code', departmentColumn: 'department_name' }
}))

router.use('/work-order-planned-labor', crudRouter({
  moduleName: 'Work Orders',
  table: 'dbo.work_order_planned_labor',
  key: 'planned_labor_id',
  columns: ['planned_labor_id', 'work_order_num', 'line_order', 'craft_name', 'estimated_hours', 'assigned_crew', 'site_code', 'department_name', 'created_at', 'updated_at'],
  scope: { siteColumn: 'site_code', departmentColumn: 'department_name' }
}))

router.use('/work-order-tasks', crudRouter({
  moduleName: 'Work Orders',
  table: 'dbo.work_order_tasks',
  key: 'work_order_task_id',
  columns: ['work_order_task_id', 'work_order_num', 'task_sequence', 'task_description', 'duration_minutes', 'site_code', 'department_name', 'created_at', 'updated_at'],
  scope: { siteColumn: 'site_code', departmentColumn: 'department_name' }
}))

router.use('/service-requests', crudRouter({
  moduleName: 'Job Requests',
  table: 'dbo.service_requests',
  key: 'sr_num',
  columns: ['sr_num', 'description', 'long_description', 'site_code', 'location_code', 'asset_num', 'department_name', 'sub_department_code', 'assigned_department_name', 'reported_by', 'reported_at', 'priority', 'request_type', 'failure_code', 'status', 'converted_work_order_num', 'created_at', 'updated_at'],
  scope: { siteColumn: 'site_code', departmentColumn: 'department_name' }
}))

router.use('/purchase-requisitions', crudRouter({
  moduleName: 'Purchase Requisitions',
  table: 'dbo.purchase_requisitions',
  key: 'pr_num',
  columns: ['pr_num', 'work_order_num', 'resource_request_id', 'request_type', 'item_code', 'item_description', 'requested_quantity', 'planned_quantity', 'available_quantity', 'store_code', 'site_code', 'department_name', 'status', 'po_num', 'created_at', 'approved_at', 'closed_at', 'cancelled_at', 'updated_at'],
  scope: { siteColumn: 'site_code', departmentColumn: 'department_name' }
}))

router.use('/purchase-orders', crudRouter({
  moduleName: 'Purchase Orders',
  table: 'dbo.purchase_orders',
  key: 'po_num',
  columns: ['po_num', 'pr_num', 'work_order_num', 'resource_request_id', 'request_type', 'item_code', 'item_description', 'ordered_quantity', 'store_code', 'site_code', 'department_name', 'status', 'created_at', 'approved_at', 'received_at', 'closed_at', 'cancelled_at', 'updated_at'],
  scope: { siteColumn: 'site_code', departmentColumn: 'department_name' }
}))

router.use('/reservations', crudRouter({
  moduleName: 'Reservations',
  table: 'dbo.inventory_reservations',
  key: 'reservation_num',
  columns: ['reservation_num', 'work_order_num', 'resource_request_id', 'pr_num', 'po_num', 'item_code', 'item_description', 'reserved_quantity', 'arranged_quantity', 'released_quantity', 'delivered_quantity', 'store_code', 'site_code', 'department_name', 'status', 'created_at', 'updated_at'],
  scope: { siteColumn: 'site_code', departmentColumn: 'department_name' }
}))

router.use('/preventive-maintenance', crudRouter({
  moduleName: 'Preventive Maintenance',
  table: 'dbo.preventive_maintenance',
  key: 'pm_num',
  columns: ['pm_num', 'description', 'asset_num', 'route_code', 'location_code', 'job_plan_num', 'next_date', 'lead_time_days', 'frequency', 'frequency_unit', 'pm_counter', 'work_type', 'wo_status', 'store_code', 'supervisor', 'lead_person', 'person_group', 'site_code', 'department_name', 'sub_department_code', 'pm_status', 'last_generated_cycle', 'created_at', 'updated_at'],
  scope: { siteColumn: 'site_code', departmentColumn: 'department_name' }
}))

router.use('/job-plans', crudRouter({
  moduleName: 'Job Plans',
  table: 'dbo.job_plans',
  key: 'job_plan_num',
  columns: ['job_plan_num', 'description', 'status', 'created_at', 'updated_at']
}))

router.use('/job-plan-tasks', crudRouter({
  moduleName: 'Job Plans',
  table: 'dbo.job_plan_tasks',
  key: 'job_plan_task_id',
  columns: ['job_plan_task_id', 'job_plan_num', 'task_sequence', 'task_description', 'duration_hours']
}))

router.use('/incidents', crudRouter({
  moduleName: 'Incidents',
  table: 'dbo.incidents',
  key: 'incident_num',
  columns: ['incident_num', 'description', 'site_code', 'location_code', 'asset_num', 'department_name', 'status', 'reported_at', 'created_at', 'updated_at'],
  scope: { siteColumn: 'site_code', departmentColumn: 'department_name' }
}))

router.use('/meter-readings', crudRouter({
  moduleName: 'Meters',
  table: 'dbo.meter_readings',
  key: 'meter_reading_id',
  columns: ['meter_reading_id', 'meter_id', 'asset_num', 'work_order_num', 'site_code', 'department_name', 'reading_value', 'reading_unit', 'reading_at', 'created_at'],
  scope: { siteColumn: 'site_code', departmentColumn: 'department_name' }
}))

export default router

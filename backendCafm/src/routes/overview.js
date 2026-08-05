import { Router } from 'express'
import { getPool } from '../db/pool.js'
import { requirePermission, userHasPermission } from '../middleware/auth.js'
import { addScopeWhere } from '../middleware/scope.js'
import { bindParams } from '../utils/sqlParams.js'
import { asyncHandler } from '../utils/asyncHandler.js'

const router = Router()
const ownerColumn = 'created_by_user_id'
const departmentScope = { siteColumn: 'site_code', departmentColumn: 'department_name' }
const workOrderScope = {
  ...departmentScope,
  departmentColumns: ['assigned_department_name'],
  subDepartmentColumn: 'sub_department_code',
  ownerColumn
}

const number = value => Number(value || 0)
const canView = (user, moduleName) => userHasPermission(user, moduleName, 'view')
const emptyWorkOrders = {
  total: 0, open: 0, closed: 0, overdue: 0, paused: 0, pm: 0, cm: 0,
  loggedThisMonth: 0, loggedYtd: 0, permits: 0, permitsMissing: 0,
  scheduledPm: 0, pmMissed: 0
}

const workOrderSnapshot = async (pool, user) => {
  if (!await canView(user, 'Work Orders')) return { stats: emptyWorkOrders, siteCompliance: [], permitOrders: [] }
  const scoped = addScopeWhere({ user, ...workOrderScope })
  const result = await bindParams(pool.request(), scoped.params).query(`
    select
      count_big(1) as total,
      sum(case when upper(status) not in ('CLOSE', 'CLOSED', 'CAN', 'CANCELLED') then 1 else 0 end) as [open],
      sum(case when upper(status) in ('CLOSE', 'CLOSED', 'CAN', 'CANCELLED') then 1 else 0 end) as closed,
      sum(case when upper(status) not in ('CLOSE', 'CLOSED', 'CAN', 'CANCELLED', 'HOLD', 'ON_HOLD_MATERIAL')
        and coalesce(target_finish_at, target_start_at) < sysutcdatetime() then 1 else 0 end) as overdue,
      sum(case when upper(status) in ('HOLD', 'ON_HOLD_MATERIAL') then 1 else 0 end) as paused,
      sum(case when upper(work_type) = 'PM' then 1 else 0 end) as pm,
      sum(case when upper(work_type) = 'CM' then 1 else 0 end) as cm,
      sum(case when reported_at >= datefromparts(year(sysutcdatetime()), month(sysutcdatetime()), 1) then 1 else 0 end) as logged_this_month,
      sum(case when reported_at >= datefromparts(year(sysutcdatetime()), 1, 1) then 1 else 0 end) as logged_ytd,
      sum(case when ptw_required = 1 then 1 else 0 end) as permits,
      sum(case when ptw_required = 1 and isnull(permit_attachment.file_count, 0) = 0 then 1 else 0 end) as permits_missing,
      sum(case when upper(work_type) = 'PM' and coalesce(target_finish_at, target_start_at) is not null then 1 else 0 end) as scheduled_pm,
      sum(case when upper(work_type) = 'PM' and coalesce(target_finish_at, target_start_at) is not null
        and upper(status) not in ('HOLD', 'ON_HOLD_MATERIAL')
        and ((upper(status) in ('CLOSE', 'CLOSED') and actual_finish_at > coalesce(target_finish_at, target_start_at))
          or (upper(status) not in ('CLOSE', 'CLOSED', 'CAN', 'CANCELLED') and coalesce(target_finish_at, target_start_at) < sysutcdatetime()))
        then 1 else 0 end) as pm_missed
    from dbo.work_orders
    left join (
      select entity_id, count_big(1) as file_count
      from dbo.attachments
      where entity_type = 'work-order' and upper(category) = 'PTW'
      group by entity_id
    ) permit_attachment on permit_attachment.entity_id = dbo.work_orders.work_order_num
    where 1 = 1${scoped.where};

    select top 4 site_code,
      count_big(1) as total,
      sum(case when upper(status) not in ('CLOSE', 'CLOSED', 'CAN', 'CANCELLED', 'HOLD', 'ON_HOLD_MATERIAL')
        and coalesce(target_finish_at, target_start_at) < sysutcdatetime() then 1 else 0 end) as overdue
    from dbo.work_orders
    where site_code is not null${scoped.where}
    group by site_code
    order by count_big(1) desc, site_code;

    select top 6 work_order_num, description, status,
      (select count_big(1) from dbo.attachments attachment
       where attachment.entity_type = 'work-order'
         and attachment.entity_id = dbo.work_orders.work_order_num
         and upper(attachment.category) = 'PTW') as file_count
    from dbo.work_orders
    where ptw_required = 1${scoped.where}
    order by reported_at desc, work_order_num desc;
  `)
  const row = result.recordsets[0]?.[0] || {}
  const stats = {
    total: number(row.total),
    open: number(row.open),
    closed: number(row.closed),
    overdue: number(row.overdue),
    paused: number(row.paused),
    pm: number(row.pm),
    cm: number(row.cm),
    loggedThisMonth: number(row.logged_this_month),
    loggedYtd: number(row.logged_ytd),
    permits: number(row.permits),
    permitsMissing: number(row.permits_missing),
    scheduledPm: number(row.scheduled_pm),
    pmMissed: number(row.pm_missed)
  }
  return {
    stats,
    siteCompliance: (result.recordsets[1] || []).map(site => ({
      site: site.site_code,
      value: number(site.total) ? Math.round(((number(site.total) - number(site.overdue)) / number(site.total)) * 100) : 100
    })),
    permitOrders: (result.recordsets[2] || []).map(order => ({
      workOrder: order.work_order_num,
      description: order.description,
      status: order.status,
      fileCount: number(order.file_count)
    }))
  }
}

const countSnapshot = async (pool, user, { moduleName, table, scope, expression = 'count_big(1) as total' }) => {
  if (!await canView(user, moduleName)) return {}
  const scoped = addScopeWhere({ user, ...scope })
  const result = await bindParams(pool.request(), scoped.params).query(`select ${expression} from ${table} where 1 = 1${scoped.where}`)
  return result.recordset[0] || {}
}

const meterSnapshot = async (pool, user) => {
  if (!await canView(user, 'Meters')) return { total: 0, rows: [], history: [] }
  const scoped = addScopeWhere({ user, ...departmentScope, ownerColumn })
  const result = await bindParams(pool.request(), scoped.params).query(`
    select count_big(distinct meter_id) as total
    from dbo.meter_readings
    where 1 = 1${scoped.where};

    with ranked as (
      select meter_reading_id, meter_id, asset_num, work_order_num, site_code, department_name,
        reading_value, reading_unit, reading_at, created_by_user_id, created_at,
        row_number() over(partition by meter_id order by reading_at desc, meter_reading_id desc) as row_num
      from dbo.meter_readings
      where 1 = 1${scoped.where}
    )
    select top 20 meter_reading_id, meter_id, asset_num, work_order_num, site_code, department_name,
      reading_value, reading_unit, reading_at, created_by_user_id, created_at
    from ranked
    where row_num = 1
    order by reading_at desc, meter_reading_id desc;

    select top 120 meter_reading_id, meter_id, asset_num, work_order_num, site_code, department_name,
      reading_value, reading_unit, reading_at, created_by_user_id, created_at
    from dbo.meter_readings
    where 1 = 1${scoped.where}
    order by reading_at desc, meter_reading_id desc;
  `)
  return {
    total: number(result.recordsets[0]?.[0]?.total),
    rows: result.recordsets[1] || [],
    history: result.recordsets[2] || []
  }
}

const pmSnapshot = async (pool, user) => {
  if (!await canView(user, 'Preventive Maintenance')) return { total: 0, rows: [] }
  const scoped = addScopeWhere({ user, ...departmentScope, subDepartmentColumn: 'sub_department_code', ownerColumn })
  const result = await bindParams(pool.request(), scoped.params).query(`
    select count_big(1) as total from dbo.preventive_maintenance where 1 = 1${scoped.where};
    select top 4 * from dbo.preventive_maintenance where 1 = 1${scoped.where} order by next_date, pm_num;
  `)
  return { total: number(result.recordsets[0]?.[0]?.total), rows: result.recordsets[1] || [] }
}

const supplySnapshot = async (pool, user) => {
  const definitions = [
    { moduleName: 'Purchase Requisitions', table: 'dbo.purchase_requisitions', reference: 'pr_num', type: "'Purchase Request'", active: "status not in ('CLOSE', 'CAN')", next: "case when po_num is not null then concat('Linked to ', po_num) else 'Awaiting approval' end" },
    { moduleName: 'Purchase Orders', table: 'dbo.purchase_orders', reference: 'po_num', type: "'Purchase Order'", active: "status not in ('CLOSE', 'CAN')", next: "case when status = 'CLOSE' then 'Received and closed' else 'Procurement follow-up' end" },
    { moduleName: 'Reservations', table: 'dbo.inventory_reservations', reference: 'reservation_num', type: "case when upper(request_type) = 'MATERIAL' then 'Reservation' else 'Allocation' end", active: "status not in ('COMPLETE', 'CANCELLED', 'CAN')", next: "case when status = 'COMPLETE' then 'Delivered to work order' else 'Store fulfillment' end" }
  ]
  const results = await Promise.all(definitions.map(async definition => {
    if (!await canView(user, definition.moduleName)) return { moduleName: definition.moduleName, count: 0, rows: [] }
    const scoped = addScopeWhere({ user, ...departmentScope, ownerColumn })
    const result = await bindParams(pool.request(), scoped.params).query(`
      select count_big(1) as total from ${definition.table} where ${definition.active}${scoped.where};
      select top 4 ${definition.type} as record_type, ${definition.reference} as reference,
        work_order_num, item_description, status, ${definition.next} as next_step, created_at
      from ${definition.table}
      where 1 = 1${scoped.where}
      order by created_at desc, ${definition.reference} desc;
    `)
    return { moduleName: definition.moduleName, count: number(result.recordsets[0]?.[0]?.total), rows: result.recordsets[1] || [] }
  }))
  const countFor = moduleName => results.find(result => result.moduleName === moduleName)?.count || 0
  return {
    openPurchaseRequests: countFor('Purchase Requisitions'),
    openPurchaseOrders: countFor('Purchase Orders'),
    activeReservations: countFor('Reservations'),
    operations: results.flatMap(result => result.rows)
      .sort((left, right) => String(right.created_at || '').localeCompare(String(left.created_at || '')))
      .slice(0, 8)
      .map(row => ({
        type: row.record_type,
        reference: row.reference,
        workOrder: row.work_order_num,
        item: row.item_description,
        status: row.status,
        next: row.next_step
      }))
  }
}

router.get('/', requirePermission('Overview', 'view'), asyncHandler(async (req, res) => {
  const pool = await getPool()
  const [workOrders, assets, incidents, preventiveMaintenance, failureCodes, meters, supply] = await Promise.all([
    workOrderSnapshot(pool, req.user),
    countSnapshot(pool, req.user, {
      moduleName: 'Assets', table: 'dbo.assets', scope: departmentScope,
      expression: "count_big(1) as total, sum(case when upper(status) = 'OPERATING' then 1 else 0 end) as operating"
    }),
    countSnapshot(pool, req.user, {
      moduleName: 'Incidents', table: 'dbo.incidents', scope: { ...departmentScope, ownerColumn },
      expression: "count_big(1) as total, sum(case when upper(status) not in ('RESOLVED', 'CLOSED') then 1 else 0 end) as [open]"
    }),
    pmSnapshot(pool, req.user),
    countSnapshot(pool, req.user, { moduleName: 'Failure Library', table: 'dbo.failure_library', scope: { siteColumn: null, departmentColumn: null } }),
    meterSnapshot(pool, req.user),
    supplySnapshot(pool, req.user)
  ])
  res.json({
    workOrders: workOrders.stats,
    siteCompliance: workOrders.siteCompliance,
    permitOrders: workOrders.permitOrders,
    assets: { total: number(assets.total), operating: number(assets.operating) },
    incidents: { total: number(incidents.total), open: number(incidents.open) },
    preventiveMaintenance: { total: preventiveMaintenance.total, rows: preventiveMaintenance.rows },
    failureCodes: { total: number(failureCodes.total) },
    meters,
    supply
  })
}))

export default router

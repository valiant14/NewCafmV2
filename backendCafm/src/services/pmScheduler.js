import { sql, getPool } from '../db/pool.js'
import { env } from '../config/env.js'
import { broadcastWorkspaceChange } from '../realtime.js'

let timer
let running = false

const startOfCycleSql = `
  convert(nvarchar(33), pm.next_date, 126)
`

const duePlansSql = `
  select
    pm.*,
    asset.location_code as asset_location_code,
    asset.description as asset_description,
    coalesce(pm_rule.frequency, pm.frequency) as effective_frequency,
    coalesce(pm_rule.frequency_unit, pm.frequency_unit) as effective_frequency_unit,
    coalesce(pm_rule.lead_time_days, pm.lead_time_days) as effective_lead_time_days,
    coalesce(pm_rule.horizon_days, pm.lead_time_days, 30) as effective_horizon_days,
    case
      when coalesce(pm_rule.frequency_unit, pm.frequency_unit) in ('MINUTES', 'HOURS') then 0
      else coalesce(pm_rule.trigger_hour, 0)
    end as effective_trigger_hour,
    coalesce(pm_rule.wo_prefix, 'PMWO-') as effective_wo_prefix,
    coalesce(pm_rule.default_wo_status, pm.wo_status, 'WSCH') as effective_wo_status,
    ${startOfCycleSql} as pm_cycle
  from dbo.preventive_maintenance pm
  left join dbo.pm_schedule_rules pm_rule
    on pm_rule.rule_name = pm.schedule_rule_name
    and pm_rule.status = 'Active'
  left join dbo.assets asset on asset.asset_num = pm.asset_num
  where pm.pm_status = 'ACTIVE'
    and (
      (
        coalesce(pm_rule.frequency_unit, pm.frequency_unit) in ('MINUTES', 'HOURS')
        and pm.next_date <= sysutcdatetime()
      )
      or (
        coalesce(pm_rule.frequency_unit, pm.frequency_unit) not in ('MINUTES', 'HOURS')
        and pm.next_date <= dateadd(day, coalesce(pm_rule.horizon_days, pm.lead_time_days, 30), sysutcdatetime())
      )
    )
    and (
      coalesce(pm_rule.frequency_unit, pm.frequency_unit) in ('MINUTES', 'HOURS')
      or datepart(hour, sysutcdatetime()) >= coalesce(pm_rule.trigger_hour, 0)
    )
    and not exists (
      select 1
      from dbo.work_orders wo
      where wo.pm_num = pm.pm_num
        and wo.pm_cycle = ${startOfCycleSql}
    )
  order by pm.next_date
`

const advanceExpression = (unit, frequency) => {
  const amount = Math.max(1, Number(frequency) || 1)
  const normalizedUnit = String(unit || 'MONTHS').toUpperCase()
  const datePart = normalizedUnit === 'MINUTES' ? 'minute'
    : normalizedUnit === 'HOURS' ? 'hour'
      : normalizedUnit === 'DAYS' ? 'day'
        : normalizedUnit === 'WEEKS' ? 'week'
          : normalizedUnit === 'YEARS' ? 'year'
            : 'month'
  return `dateadd(${datePart}, ${amount}, @next_date)`
}

const statusDescription = status => ({
  WSCH: 'Waiting for Schedule',
  SCHED: 'Scheduled',
  WAPPR: 'Waiting for Approval',
  APPR: 'Approved',
  INPRG: 'In Progress',
  COMP: 'Completed',
  CLOSE: 'Closed'
}[String(status || '').toUpperCase()] || 'Waiting for Schedule')

const advancePmUntilFuture = async (transaction, plan) => {
  const expression = advanceExpression(plan.effective_frequency_unit, plan.effective_frequency)
  let nextDate = plan.next_date
  for (let index = 0; index < 500; index += 1) {
    const result = await new sql.Request(transaction)
      .input('next_date', sql.DateTime2, nextDate)
      .query(`select ${expression} as next_date`)
    nextDate = result.recordset[0].next_date
    if (nextDate > new Date()) return nextDate
  }
  return nextDate
}

const generatePlan = async (pool, plan) => {
  const transaction = new sql.Transaction(pool)
  await transaction.begin()
  try {
    const duplicate = await new sql.Request(transaction)
      .input('pm_num', sql.NVarChar(80), plan.pm_num)
      .input('pm_cycle', sql.NVarChar(120), plan.pm_cycle)
      .query(`
        select top 1 work_order_num
        from dbo.work_orders
        where pm_num = @pm_num
          and pm_cycle = @pm_cycle
      `)
    if (duplicate.recordset[0]) {
      await transaction.rollback()
      return null
    }

    const workOrderNum = `${plan.effective_wo_prefix || 'PMWO-'}${Date.now().toString().slice(-8)}${String(Math.floor(Math.random() * 100)).padStart(2, '0')}`
    const target = plan.next_date
    await new sql.Request(transaction)
      .input('work_order_num', sql.NVarChar(80), workOrderNum)
      .input('description', sql.NVarChar(300), plan.description)
      .input('location_code', sql.NVarChar(80), plan.location_code || plan.asset_location_code || null)
      .input('asset_num', sql.NVarChar(80), plan.asset_num || null)
      .input('status', sql.NVarChar(40), plan.effective_wo_status || 'WSCH')
      .input('work_type', sql.NVarChar(40), plan.work_type || 'PM')
      .input('priority', sql.Int, 3)
      .input('site_code', sql.NVarChar(30), plan.site_code || '1031')
      .input('department_name', sql.NVarChar(160), plan.department_name || null)
      .input('sub_department_code', sql.NVarChar(50), plan.sub_department_code || null)
      .input('assigned_department_name', sql.NVarChar(160), plan.department_name || null)
      .input('target_start_at', sql.DateTime2, target)
      .input('target_finish_at', sql.DateTime2, target)
      .input('reported_at', sql.DateTime2, new Date())
      .input('pm_num', sql.NVarChar(80), plan.pm_num)
      .input('pm_cycle', sql.NVarChar(120), plan.pm_cycle)
      .input('job_plan_num', sql.NVarChar(80), plan.job_plan_num)
      .input('schedule_rule_name', sql.NVarChar(160), plan.schedule_rule_name || null)
      .query(`
        insert into dbo.work_orders (
          work_order_num, description, location_code, asset_num, status, work_type, priority,
          site_code, department_name, sub_department_code, assigned_department_name,
          target_start_at, target_finish_at, reported_at,
          pm_num, pm_cycle, job_plan_num, schedule_rule_name
        )
        values (
          @work_order_num, @description, @location_code, @asset_num, @status, @work_type, @priority,
          @site_code, @department_name, @sub_department_code, @assigned_department_name,
          @target_start_at, @target_finish_at, @reported_at,
          @pm_num, @pm_cycle, @job_plan_num, @schedule_rule_name
        )
      `)

    await new sql.Request(transaction)
      .input('work_order_num', sql.NVarChar(80), workOrderNum)
      .input('site_code', sql.NVarChar(30), plan.site_code || '1031')
      .input('department_name', sql.NVarChar(160), plan.department_name || null)
      .input('job_plan_num', sql.NVarChar(80), plan.job_plan_num)
      .query(`
        insert into dbo.work_order_tasks (work_order_num, task_sequence, task_description, duration_minutes, site_code, department_name)
        select
          @work_order_num,
          task_sequence,
          task_description,
          ceiling(isnull(duration_hours, 0) * 60),
          @site_code,
          @department_name
        from dbo.job_plan_tasks
        where job_plan_num = @job_plan_num
      `)

    const nextDate = await advancePmUntilFuture(transaction, plan)
    await new sql.Request(transaction)
      .input('pm_num', sql.NVarChar(80), plan.pm_num)
      .input('next_date', sql.DateTime2, nextDate)
      .input('pm_cycle', sql.NVarChar(120), plan.pm_cycle)
      .query(`
        update dbo.preventive_maintenance
        set next_date = @next_date,
            last_generated_cycle = @pm_cycle,
            pm_counter = isnull(pm_counter, 0) + 1,
            updated_at = sysutcdatetime()
        where pm_num = @pm_num
      `)

    await transaction.commit()
    return { pmNum: plan.pm_num, workOrderNum }
  } catch (error) {
    await transaction.rollback().catch(() => {})
    throw error
  }
}

export const runPmSchedulerOnce = async () => {
  if (running) return []
  running = true
  try {
    const pool = await getPool()
    const due = await pool.request().query(duePlansSql)
    const generated = []
    for (const plan of due.recordset) {
      const result = await generatePlan(pool, plan)
      if (result) generated.push(result)
    }
    if (generated.length) {
      broadcastWorkspaceChange({
        moduleName: 'Preventive Maintenance',
        table: 'dbo.preventive_maintenance',
        action: 'pm-generated',
        count: generated.length
      })
      broadcastWorkspaceChange({
        moduleName: 'Work Orders',
        table: 'dbo.work_orders',
        action: 'pm-generated',
        count: generated.length
      })
      console.log(`PM scheduler generated ${generated.length} work order(s).`)
    }
    return generated
  } catch (error) {
    console.error('PM scheduler failed:', error.message)
    return []
  } finally {
    running = false
  }
}

export const startPmScheduler = () => {
  if (!env.pmSchedulerEnabled || timer) return
  const interval = Math.max(10000, env.pmSchedulerIntervalMs)
  timer = setInterval(runPmSchedulerOnce, interval)
  runPmSchedulerOnce()
  console.log(`PM scheduler enabled. Checking every ${interval}ms.`)
}

export const stopPmScheduler = () => {
  if (!timer) return
  clearInterval(timer)
  timer = null
}

import { randomUUID } from 'node:crypto'
import { sql, getPool } from '../db/pool.js'
import { env } from '../config/env.js'
import { broadcastWorkspaceChange } from '../realtime.js'

let timer
let running = false

const startOfCycleSql = 'convert(nvarchar(33), pm.next_date, 126)'
const dueFromSql = `
  from dbo.preventive_maintenance pm
  left join dbo.pm_schedule_rules pm_rule
    on pm_rule.rule_name = pm.schedule_rule_name
    and pm_rule.status = 'Active'
  left join dbo.assets asset on asset.asset_num = pm.asset_num
`
const dueWhereSql = `
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
`
const duePlanColumnsSql = `
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
`
const duePlansSql = `
  select top (@batchSize) ${duePlanColumnsSql}
  ${dueFromSql}
  ${dueWhereSql}
  order by pm.next_date, pm.pm_num
`

const statusDescription = status => ({
  WSCH: 'Waiting for Schedule',
  SCHED: 'Scheduled',
  WAPPR: 'Waiting for Approval',
  APPR: 'Approved',
  INPRG: 'In Progress',
  COMP: 'Completed',
  CLOSE: 'Closed'
}[String(status || '').toUpperCase()] || 'Waiting for Schedule')

const addCalendarMonths = (source, months) => {
  const next = new Date(source)
  const originalDay = next.getUTCDate()
  next.setUTCDate(1)
  next.setUTCMonth(next.getUTCMonth() + months)
  const lastDay = new Date(Date.UTC(next.getUTCFullYear(), next.getUTCMonth() + 1, 0)).getUTCDate()
  next.setUTCDate(Math.min(originalDay, lastDay))
  return next
}

const advancePmUntilFuture = plan => {
  const frequency = Math.max(1, Number(plan.effective_frequency) || 1)
  const unit = String(plan.effective_frequency_unit || 'MONTHS').toUpperCase()
  const now = Date.now()
  const current = new Date(plan.next_date)
  if (Number.isNaN(current.getTime())) throw new Error(`PM ${plan.pm_num} has an invalid next date.`)

  const fixedIntervalMs = {
    MINUTES: 60000,
    HOURS: 3600000,
    DAYS: 86400000,
    WEEKS: 604800000
  }[unit]
  if (fixedIntervalMs) {
    const interval = fixedIntervalMs * frequency
    const steps = current.getTime() > now ? 1 : Math.floor((now - current.getTime()) / interval) + 1
    return new Date(current.getTime() + steps * interval)
  }

  let next = current
  const monthStep = unit === 'YEARS' ? frequency * 12 : frequency
  for (let index = 0; index < 10000; index += 1) {
    next = addCalendarMonths(next, monthStep)
    if (next.getTime() > now) return next
  }
  throw new Error(`PM ${plan.pm_num} could not advance to a future cycle.`)
}

const workOrderNumberFor = plan => {
  const prefix = String(plan.effective_wo_prefix || 'PMWO-').slice(0, 40)
  return `${prefix}${randomUUID().replaceAll('-', '').slice(0, 20).toUpperCase()}`
}

const generatePlan = async (pool, plan) => {
  const workOrderNum = workOrderNumberFor(plan)
  const nextDate = advancePmUntilFuture(plan)
  const transaction = new sql.Transaction(pool)
  await transaction.begin()
  try {
    const result = await new sql.Request(transaction)
      .input('work_order_num', sql.NVarChar(80), workOrderNum)
      .input('description', sql.NVarChar(300), plan.description)
      .input('location_code', sql.NVarChar(80), plan.location_code || plan.asset_location_code || null)
      .input('asset_num', sql.NVarChar(80), plan.asset_num || null)
      .input('status', sql.NVarChar(40), plan.effective_wo_status || 'WSCH')
      .input('work_type', sql.NVarChar(40), plan.work_type || 'PM')
      .input('priority', sql.Int, 3)
      .input('site_code', sql.NVarChar(30), plan.site_code)
      .input('department_name', sql.NVarChar(160), plan.department_name || null)
      .input('sub_department_code', sql.NVarChar(50), plan.sub_department_code || null)
      .input('target_at', sql.DateTime2, plan.next_date)
      .input('reported_at', sql.DateTime2, new Date())
      .input('pm_num', sql.NVarChar(80), plan.pm_num)
      .input('pm_cycle', sql.NVarChar(120), plan.pm_cycle)
      .input('job_plan_num', sql.NVarChar(80), plan.job_plan_num)
      .input('schedule_rule_name', sql.NVarChar(160), plan.schedule_rule_name || null)
      .input('created_by_user_id', sql.NVarChar(50), plan.created_by_user_id || null)
      .input('next_date', sql.DateTime2, nextDate)
      .input('lock_resource', sql.NVarChar(255), `pm-generation:${plan.pm_num}`)
      .query(`
        set xact_abort on;
        declare @lockResult int;
        exec @lockResult = sp_getapplock
          @Resource = @lock_resource,
          @LockMode = 'Exclusive',
          @LockOwner = 'Transaction',
          @LockTimeout = 10000;

        if @lockResult < 0
          throw 51001, 'Unable to lock PM generation cycle.', 1;

        if exists (
          select 1 from dbo.work_orders with (updlock, holdlock)
          where pm_num = @pm_num and pm_cycle = @pm_cycle
        )
        begin
          select cast(0 as bit) as generated, work_order_num
          from dbo.work_orders
          where pm_num = @pm_num and pm_cycle = @pm_cycle;
        end
        else
        begin
          insert into dbo.work_orders (
            work_order_num, description, location_code, asset_num, status, work_type, priority,
            site_code, department_name, sub_department_code, assigned_department_name,
            target_start_at, target_finish_at, reported_at,
            pm_num, pm_cycle, job_plan_num, schedule_rule_name, ptw_required, created_by_user_id
          )
          values (
            @work_order_num, @description, @location_code, @asset_num, @status, @work_type, @priority,
            @site_code, @department_name, @sub_department_code, @department_name,
            @target_at, @target_at, @reported_at,
            @pm_num, @pm_cycle, @job_plan_num, @schedule_rule_name,
            coalesce((select top 1 ptw_required_default from dbo.work_order_workflow_settings where workflow_key = 'DEFAULT'), 1),
            @created_by_user_id
          );

          insert into dbo.work_order_tasks (
            work_order_num, task_sequence, task_description, duration_minutes, site_code, department_name, created_by_user_id
          )
          select
            @work_order_num, task_sequence, task_description,
            ceiling(isnull(duration_hours, 0) * 60), @site_code, @department_name, @created_by_user_id
          from dbo.job_plan_tasks
          where job_plan_num = @job_plan_num;

          update dbo.preventive_maintenance
          set next_date = @next_date,
              last_generated_cycle = @pm_cycle,
              pm_counter = isnull(pm_counter, 0) + 1,
              updated_at = sysutcdatetime()
          where pm_num = @pm_num;

          select cast(1 as bit) as generated, @work_order_num as work_order_num;
        end
      `)

    await transaction.commit()
    return result.recordset[0]?.generated
      ? { pmNum: plan.pm_num, workOrderNum: result.recordset[0].work_order_num }
      : null
  } catch (error) {
    await transaction.rollback().catch(() => {})
    throw error
  }
}

const runWithConcurrency = async (rows, concurrency, worker) => {
  let cursor = 0
  const results = []
  const failures = []
  const runners = Array.from({ length: Math.min(concurrency, rows.length) }, async () => {
    while (cursor < rows.length) {
      const row = rows[cursor]
      cursor += 1
      try {
        const result = await worker(row)
        if (result) results.push(result)
      } catch (error) {
        failures.push({ id: row.pm_num, error })
      }
    }
  })
  await Promise.all(runners)
  return { results, failures }
}

export const runPmSchedulerOnce = async () => {
  if (running) return []
  running = true
  try {
    const pool = await getPool()
    const due = await pool.request()
      .input('batchSize', sql.Int, env.pmSchedulerBatchSize)
      .query(duePlansSql)
    if (env.pmSchedulerDebug) console.log(`PM scheduler checked ${due.recordset.length} due plan(s).`)

    const { results: generated, failures } = await runWithConcurrency(
      due.recordset,
      Math.min(env.pmSchedulerConcurrency, Math.max(1, env.db.pool.max - 2)),
      plan => generatePlan(pool, plan)
    )
    failures.forEach(({ id, error }) => console.error(`PM scheduler failed for ${id}:`, error.message))

    if (generated.length) {
      broadcastWorkspaceChange({
        moduleName: 'Work Orders',
        relatedModules: ['Preventive Maintenance'],
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

export const getPmSchedulerStatus = async () => {
  const pool = await getPool()
  const result = await pool.request()
    .input('batchSize', sql.Int, env.pmSchedulerBatchSize)
    .query(`
      select count_big(1) as due_count ${dueFromSql} ${dueWhereSql};
      ${duePlansSql};
    `)
  const duePlans = result.recordsets[1] || []
  return {
    enabled: env.pmSchedulerEnabled,
    running,
    intervalMs: env.pmSchedulerIntervalMs,
    batchSize: env.pmSchedulerBatchSize,
    concurrency: env.pmSchedulerConcurrency,
    dueCount: Number(result.recordsets[0]?.[0]?.due_count || 0),
    duePlans: duePlans.map(plan => ({
      pmNum: plan.pm_num,
      description: plan.description,
      nextDate: plan.next_date,
      frequency: plan.effective_frequency,
      frequencyUnit: plan.effective_frequency_unit,
      rule: plan.schedule_rule_name || '',
      cycle: plan.pm_cycle,
      site: plan.site_code,
      department: plan.department_name || ''
    }))
  }
}

export const startPmScheduler = () => {
  if (!env.pmSchedulerEnabled || timer) return
  timer = setInterval(runPmSchedulerOnce, env.pmSchedulerIntervalMs)
  timer.unref?.()
  runPmSchedulerOnce()
  console.log(`PM scheduler enabled. Checking every ${env.pmSchedulerIntervalMs}ms.`)
}

export const stopPmScheduler = () => {
  if (!timer) return
  clearInterval(timer)
  timer = undefined
}

export const getPmSchedulerRuntime = () => ({ running, timerActive: Boolean(timer) })

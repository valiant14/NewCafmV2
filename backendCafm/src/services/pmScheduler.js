import { randomUUID } from 'node:crypto'
import { sql, getPool } from '../db/pool.js'
import { env } from '../config/env.js'
import { broadcastWorkspaceChange } from '../realtime.js'
import { getWorkOrderWorkflow } from './workOrderWorkflow.js'

let timer
let running = false

const startOfCycleSql = 'convert(nvarchar(33), pm.next_date, 126)'
const dueFromSql = `
  from dbo.preventive_maintenance pm
  left join dbo.pm_schedule_rules pm_rule
    on pm_rule.rule_name = pm.schedule_rule_name
    and pm_rule.status = 'Active'
  left join dbo.assets asset on asset.asset_num = pm.asset_num
  join dbo.job_plans job_plan on job_plan.job_plan_num = pm.job_plan_num
  outer apply (
    select convert(decimal(18,4), isnull(sum(isnull(task.duration_hours, 0) * 60), 0)) as total_minutes
    from dbo.job_plan_tasks task
    where task.job_plan_num = pm.job_plan_num
  ) task_duration
`
const dueWhereSql = `
  where pm.pm_status = 'ACTIVE'
    and upper(job_plan.status) = 'ACTIVE'
    and (
      (
        upper(coalesce(pm_rule.frequency_unit, pm.frequency_unit)) in ('MINUTES', 'HOURS')
        and pm.next_date <= sysutcdatetime()
      )
      or (
        upper(coalesce(pm_rule.frequency_unit, pm.frequency_unit)) not in ('MINUTES', 'HOURS')
        and pm.next_date <= dateadd(day,
          case
            when coalesce(pm_rule.horizon_days, 0) > coalesce(pm_rule.lead_time_days, pm.lead_time_days, 0)
              then coalesce(pm_rule.horizon_days, 0)
            else coalesce(pm_rule.lead_time_days, pm.lead_time_days, 0)
          end,
          sysutcdatetime()
        )
      )
    )
    and (
      upper(coalesce(pm_rule.frequency_unit, pm.frequency_unit)) in ('MINUTES', 'HOURS')
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
  job_plan.description as job_plan_description,
  job_plan.required_labor_json,
  job_plan.required_materials_json,
  job_plan.required_tools_json,
  job_plan.safety_instructions,
  job_plan.checklist_json,
  case
    when job_plan.estimated_duration_minutes > 0 then job_plan.estimated_duration_minutes
    else task_duration.total_minutes
  end as effective_duration_minutes,
  coalesce(pm_rule.frequency, pm.frequency) as effective_frequency,
  upper(coalesce(pm_rule.frequency_unit, pm.frequency_unit)) as effective_frequency_unit,
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

const addCalendarMonths = (source, months) => {
  const next = new Date(source)
  const originalDay = next.getUTCDate()
  next.setUTCDate(1)
  next.setUTCMonth(next.getUTCMonth() + months)
  const lastDay = new Date(Date.UTC(next.getUTCFullYear(), next.getUTCMonth() + 1, 0)).getUTCDate()
  next.setUTCDate(Math.min(originalDay, lastDay))
  return next
}

const nextCycleDate = plan => {
  const frequency = Math.max(1, Number(plan.effective_frequency) || 1)
  const unit = String(plan.effective_frequency_unit || 'MONTHS').toUpperCase()
  const current = new Date(plan.next_date)
  if (Number.isNaN(current.getTime())) throw new Error(`PM ${plan.pm_num} has an invalid next date.`)

  const fixedIntervalMs = {
    MINUTES: 60000,
    HOURS: 3600000,
    DAYS: 86400000,
    WEEKS: 604800000
  }[unit]
  if (fixedIntervalMs) {
    return new Date(current.getTime() + fixedIntervalMs * frequency)
  }
  const monthStep = unit === 'YEARS'
    ? frequency * 12
    : unit === 'QUARTERS'
      ? frequency * 3
      : unit === 'MONTHS'
        ? frequency
        : 0
  if (!monthStep) throw new Error(`PM ${plan.pm_num} uses unsupported frequency unit ${unit}.`)
  return addCalendarMonths(current, monthStep)
}

const workOrderNumberFor = plan => {
  const prefix = String(plan.effective_wo_prefix || 'PMWO-').slice(0, 40)
  return `${prefix}${randomUUID().replaceAll('-', '').slice(0, 20).toUpperCase()}`
}

const generatePlan = async (pool, plan, workflow) => {
  const workOrderNum = workOrderNumberFor(plan)
  const nextDate = nextCycleDate(plan)
  const durationMinutes = Math.max(0, Number(plan.effective_duration_minutes) || 0)
  const targetFinish = new Date(new Date(plan.next_date).getTime() + durationMinutes * 60000)
  const requestedStatus = String(plan.effective_wo_status || '').trim().toUpperCase()
  const generatedStatus = (
    workflow.steps.some(step => step.status_code === requestedStatus)
      || ['ON_HOLD_MATERIAL', 'ON_HOLD_PERMIT'].includes(requestedStatus)
  ) ? requestedStatus : workflow.initial_status
  const transaction = new sql.Transaction(pool)
  await transaction.begin()
  try {
    const result = await new sql.Request(transaction)
      .input('work_order_num', sql.NVarChar(80), workOrderNum)
      .input('description', sql.NVarChar(300), plan.description)
      .input('location_code', sql.NVarChar(80), plan.location_code || plan.asset_location_code || null)
      .input('asset_num', sql.NVarChar(80), plan.asset_num || null)
      .input('status', sql.NVarChar(40), generatedStatus)
      .input('work_type', sql.NVarChar(40), plan.work_type || 'PM')
      .input('priority', sql.Int, 3)
      .input('site_code', sql.NVarChar(30), plan.site_code)
      .input('department_name', sql.NVarChar(160), plan.department_name || null)
      .input('sub_department_code', sql.NVarChar(50), plan.sub_department_code || null)
      .input('work_group', sql.NVarChar(160), plan.person_group || null)
      .input('supervisor', sql.NVarChar(160), plan.supervisor || plan.lead_person || null)
      .input('store_code', sql.NVarChar(80), plan.store_code || null)
      .input('target_at', sql.DateTime2, plan.next_date)
      .input('target_finish_at', sql.DateTime2, targetFinish)
      .input('reported_at', sql.DateTime2, new Date())
      .input('pm_num', sql.NVarChar(80), plan.pm_num)
      .input('pm_cycle', sql.NVarChar(120), plan.pm_cycle)
      .input('job_plan_num', sql.NVarChar(80), plan.job_plan_num)
      .input('schedule_rule_name', sql.NVarChar(160), plan.schedule_rule_name || null)
      .input('created_by_user_id', sql.NVarChar(50), plan.created_by_user_id || null)
      .input('next_date', sql.DateTime2, nextDate)
      .input('estimated_duration_minutes', sql.Decimal(18, 4), durationMinutes)
      .input('required_labor_json', sql.NVarChar(sql.MAX), plan.required_labor_json || '[]')
      .input('required_materials_json', sql.NVarChar(sql.MAX), plan.required_materials_json || '[]')
      .input('required_tools_json', sql.NVarChar(sql.MAX), plan.required_tools_json || '[]')
      .input('safety_instructions', sql.NVarChar(sql.MAX), plan.safety_instructions || null)
      .input('checklist_json', sql.NVarChar(sql.MAX), plan.checklist_json || '[]')
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
          update dbo.preventive_maintenance
          set next_date = case when next_date <= @target_at then @next_date else next_date end,
              last_generated_cycle = @pm_cycle,
              updated_at = sysutcdatetime()
          where pm_num = @pm_num;

          select cast(0 as bit) as generated, work_order_num
          from dbo.work_orders
          where pm_num = @pm_num and pm_cycle = @pm_cycle;
        end
        else
        begin
          insert into dbo.work_orders (
            work_order_num, description, location_code, asset_num, status, work_type, priority,
            site_code, department_name, sub_department_code, assigned_department_name, work_group, supervisor,
            target_start_at, target_finish_at, reported_at,
            pm_num, pm_cycle, job_plan_num, schedule_rule_name, ptw_required,
            estimated_duration_minutes, safety_instructions, checklist_json, created_by_user_id
          )
          values (
            @work_order_num, @description, @location_code, @asset_num, @status, @work_type, @priority,
            @site_code, @department_name, @sub_department_code, @department_name, @work_group, @supervisor,
            @target_at, @target_finish_at, @reported_at,
            @pm_num, @pm_cycle, @job_plan_num, @schedule_rule_name,
            coalesce((select top 1 ptw_required_default from dbo.work_order_workflow_settings where workflow_key = 'DEFAULT'), 1),
            @estimated_duration_minutes, @safety_instructions, @checklist_json, @created_by_user_id
          );

          insert into dbo.work_order_tasks (
            work_order_num, task_sequence, task_description, duration_minutes, site_code, department_name, created_by_user_id
          )
          select
            @work_order_num, task_sequence, task_description,
            ceiling(isnull(duration_hours, 0) * 60), @site_code, @department_name, @created_by_user_id
          from dbo.job_plan_tasks
          where job_plan_num = @job_plan_num;

          insert into dbo.work_order_planned_labor (
            work_order_num, line_order, craft_name, estimated_hours, assigned_crew,
            site_code, department_name, created_by_user_id
          )
          select
            @work_order_num,
            coalesce(required_labor.line_order, row_number() over (order by (select 1))),
            required_labor.craft_name,
            required_labor.estimated_hours,
            coalesce(required_labor.assigned_crew, N''),
            @site_code, @department_name, @created_by_user_id
          from openjson(@required_labor_json)
          with (
            line_order int '$.lineOrder',
            craft_name nvarchar(160) '$.craft',
            estimated_hours decimal(18,4) '$.hours',
            assigned_crew nvarchar(160) '$.crew'
          ) required_labor
          where nullif(ltrim(rtrim(required_labor.craft_name)), N'') is not null
            and required_labor.estimated_hours > 0;

          ;with required_resources as (
            select
              N'Material' as resource_type,
              material.item_code,
              material.item_description,
              material.requested_quantity,
              material.store_code
            from openjson(@required_materials_json)
            with (
              item_code nvarchar(80) '$.itemCode',
              item_description nvarchar(300) '$.description',
              requested_quantity decimal(18,4) '$.quantity',
              store_code nvarchar(80) '$.storeCode'
            ) material
            union all
            select
              N'Tool' as resource_type,
              tool.item_code,
              tool.item_description,
              tool.requested_quantity,
              tool.store_code
            from openjson(@required_tools_json)
            with (
              item_code nvarchar(80) '$.itemCode',
              item_description nvarchar(300) '$.description',
              requested_quantity decimal(18,4) '$.quantity',
              store_code nvarchar(80) '$.storeCode'
            ) tool
          ), resolved_resources as (
            select
              required_resources.*,
              material.description as material_description,
              tool.description as tool_description,
              case
                when required_resources.resource_type = N'Material' then coalesce(stock.available_quantity, 0)
                else coalesce(tool.quantity, 0)
              end as available_quantity,
              case
                when store.store_code is not null then store.store_code
                else null
              end as resolved_store_code,
              case
                when required_resources.resource_type = N'Material' and material.item_code is not null then material.item_code
                else null
              end as resolved_item_code
            from required_resources
            left join dbo.materials material
              on required_resources.resource_type = N'Material' and material.item_code = required_resources.item_code
            left join dbo.tools_equipment tool
              on required_resources.resource_type = N'Tool' and tool.tool_code = required_resources.item_code
            left join dbo.storerooms store
              on store.store_code = coalesce(nullif(required_resources.store_code, N''), @store_code)
            outer apply (
              select sum(inventory.balance - inventory.reserved_quantity) as available_quantity
              from dbo.inventory_stock inventory
              where inventory.item_code = required_resources.item_code
                and (store.store_code is null or inventory.store_code = store.store_code)
            ) stock
          )
          insert into dbo.work_order_resource_requests (
            work_order_num, resource_type, item_code, item_description, requested_quantity,
            available_quantity, store_code, site_code, department_name, source_type,
            availability_status, request_status, supply_chain_status, created_by_user_id
          )
          select
            @work_order_num,
            resolved_resources.resource_type,
            resolved_resources.resolved_item_code,
            coalesce(
              nullif(ltrim(rtrim(resolved_resources.item_description)), N''),
              resolved_resources.material_description,
              resolved_resources.tool_description,
              resolved_resources.item_code
            ),
            resolved_resources.requested_quantity,
            resolved_resources.available_quantity,
            resolved_resources.resolved_store_code,
            @site_code, @department_name, N'JOB_PLAN',
            case when resolved_resources.available_quantity >= resolved_resources.requested_quantity then N'AVAILABLE' else N'PURCHASE REQUIRED' end,
            N'PLANNED', N'PLANNED - Job Plan', @created_by_user_id
          from resolved_resources
          where resolved_resources.requested_quantity > 0
            and coalesce(
              nullif(ltrim(rtrim(resolved_resources.item_description)), N''),
              resolved_resources.material_description,
              resolved_resources.tool_description,
              resolved_resources.item_code
            ) is not null;

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
    const workflow = await getWorkOrderWorkflow(pool)
    const generated = []
    for (let pass = 0; pass < env.pmSchedulerMaxPasses; pass += 1) {
      const due = await pool.request()
        .input('batchSize', sql.Int, env.pmSchedulerBatchSize)
        .query(duePlansSql)
      if (env.pmSchedulerDebug) console.log(`PM scheduler pass ${pass + 1} checked ${due.recordset.length} due plan(s).`)
      if (!due.recordset.length) break

      const { results, failures } = await runWithConcurrency(
        due.recordset,
        Math.min(env.pmSchedulerConcurrency, Math.max(1, env.db.pool.max - 2)),
        plan => generatePlan(pool, plan, workflow)
      )
      generated.push(...results)
      failures.forEach(({ id, error }) => console.error(`PM scheduler failed for ${id}:`, error.message))
      if (failures.length) break
    }

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
    maxPasses: env.pmSchedulerMaxPasses,
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

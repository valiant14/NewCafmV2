import { getWorkOrderWorkflow, workflowSteps } from './workOrderWorkflow.js'
import { sql } from '../db/pool.js'

const text = value => String(value ?? '').trim()
const upper = value => text(value).toUpperCase()

const frequencyUnitAliases = Object.freeze({
  MINUTE: 'MINUTES',
  MINUTELY: 'MINUTES',
  HOUR: 'HOURS',
  HOURLY: 'HOURS',
  DAY: 'DAYS',
  DAILY: 'DAYS',
  WEEK: 'WEEKS',
  WEEKLY: 'WEEKS',
  MONTH: 'MONTHS',
  MONTHLY: 'MONTHS',
  QUARTER: 'QUARTERS',
  QUARTERLY: 'QUARTERS',
  YEAR: 'YEARS',
  YEARLY: 'YEARS',
  ANNUALLY: 'YEARS'
})

const woStatusAliases = Object.freeze({
  WAITING: 'WSCH',
  ASSIGNED: 'SCHED',
  'IN PROGRESS': 'INPRG',
  COMPLETED: 'COMP',
  CLOSED: 'CLOSE',
  CANCELLED: 'CAN',
  CANCELED: 'CAN',
  'WAITING FOR MATERIAL': 'ON_HOLD_MATERIAL',
  'WAITING FOR PERMIT': 'ON_HOLD_PERMIT'
})

export const normalizePmFrequencyUnit = value => {
  const code = upper(value)
  return frequencyUnitAliases[code] || code
}

const normalizeWoStatus = value => woStatusAliases[upper(value)] || upper(value)

const invalid = (message, details = []) => {
  const error = new Error(details.length ? `${message}: ${details.join(', ')}` : message)
  error.name = 'BadRequest'
  error.status = 400
  error.details = details
  return error
}

const validDate = value => {
  if (!value) return false
  const parsed = value instanceof Date ? value : new Date(value)
  return !Number.isNaN(parsed.getTime())
}

const validateConfiguredWoStatus = async (pool, value) => {
  const workflow = await getWorkOrderWorkflow(pool)
  const requestedWoStatus = normalizeWoStatus(value || 'WSCH')
  const allowedWoStatuses = new Set([
    ...workflowSteps(workflow).map(step => step.status_code),
    'ON_HOLD_MATERIAL',
    'ON_HOLD_PERMIT'
  ])
  if (!allowedWoStatuses.has(requestedWoStatus)) {
    throw invalid(`WO Status ${requestedWoStatus || '(blank)'} is not configured in the Work Order workflow`)
  }
  return requestedWoStatus
}

const validatePmMaster = async (pool, row) => {
  const status = upper(row.pm_status || 'ACTIVE')
  const unit = normalizePmFrequencyUnit(row.frequency_unit || 'MONTHS')
  const frequency = Number(row.frequency)
  const leadTime = Number(row.lead_time_days || 0)
  const missing = [
    !text(row.pm_num) && 'PM Number',
    !text(row.description) && 'Description',
    !text(row.asset_num) && !text(row.location_code) && 'Asset or Location',
    !text(row.job_plan_num) && 'Job Plan',
    !validDate(row.next_date) && 'Start Date',
    !(frequency > 0) && 'Frequency',
    !text(row.site_code) && 'Site',
    !text(row.department_name) && 'Department',
    !text(row.sub_department_code) && 'Sub Department'
  ].filter(Boolean)
  if (missing.length) throw invalid('PM master is incomplete', missing)
  if (!['ACTIVE', 'INACTIVE', 'DRAFT'].includes(status)) throw invalid('PM Status must be Active, Inactive, or Draft')
  if (!['MINUTES', 'HOURS', 'DAYS', 'WEEKS', 'MONTHS', 'QUARTERS', 'YEARS'].includes(unit)) {
    throw invalid('Unsupported PM frequency unit', [unit || 'blank'])
  }
  if (!Number.isFinite(leadTime) || leadTime < 0) throw invalid('Lead Time must be zero or greater')

  const jobPlan = await pool.request()
    .input('jobPlanNumber', row.job_plan_num)
    .query(`
      select top 1
        job_plan.status,
        case
          when job_plan.estimated_duration_minutes > 0 then job_plan.estimated_duration_minutes
          else task_duration.total_minutes
        end as effective_duration_minutes
      from dbo.job_plans job_plan
      outer apply (
        select convert(decimal(18,4), isnull(sum(isnull(task.duration_hours, 0) * 60), 0)) as total_minutes
        from dbo.job_plan_tasks task
        where task.job_plan_num = job_plan.job_plan_num
      ) task_duration
      where job_plan.job_plan_num = @jobPlanNumber
    `)
  if (!jobPlan.recordset[0]) throw invalid(`Job Plan ${row.job_plan_num} does not exist`)
  if (status === 'ACTIVE' && upper(jobPlan.recordset[0].status) !== 'ACTIVE') {
    throw invalid(`Job Plan ${row.job_plan_num} must be active before this PM can be active`)
  }
  if (status === 'ACTIVE' && !(Number(jobPlan.recordset[0].effective_duration_minutes) > 0)) {
    throw invalid(`Job Plan ${row.job_plan_num} must have an estimated duration or task duration before this PM can be active`)
  }

  const site = await pool.request()
    .input('siteCode', row.site_code)
    .query('select top 1 site_code from dbo.sites where site_code = @siteCode')
  if (!site.recordset[0]) throw invalid(`Site ${row.site_code} does not exist`)

  const department = await pool.request()
    .input('subDepartmentCode', row.sub_department_code)
    .input('departmentName', row.department_name)
    .query(`
      select top 1 sub_department_code
      from dbo.departments
      where sub_department_code = @subDepartmentCode
        and department_name = @departmentName
    `)
  if (!department.recordset[0]) {
    throw invalid(`Sub Department ${row.sub_department_code} does not belong to Department ${row.department_name}`)
  }

  let assetRow = null
  if (text(row.asset_num)) {
    const asset = await pool.request()
      .input('assetNumber', row.asset_num)
      .query('select top 1 location_code, site_code from dbo.assets where asset_num = @assetNumber')
    assetRow = asset.recordset[0]
    if (!assetRow) throw invalid(`Asset ${row.asset_num} does not exist`)
    if (text(assetRow.site_code) !== text(row.site_code)) {
      throw invalid(`Asset ${row.asset_num} does not belong to Site ${row.site_code}`)
    }
    if (!text(row.location_code) && !text(assetRow.location_code)) {
      throw invalid('The selected asset has no Location; enter a PM Location explicitly')
    }
  }

  if (text(row.location_code)) {
    const location = await pool.request()
      .input('locationCode', row.location_code)
      .query('select top 1 site_code from dbo.locations where location_code = @locationCode')
    if (!location.recordset[0]) throw invalid(`Location ${row.location_code} does not exist`)
    if (text(location.recordset[0].site_code) !== text(row.site_code)) {
      throw invalid(`Location ${row.location_code} does not belong to Site ${row.site_code}`)
    }
    if (text(assetRow?.location_code) && text(assetRow.location_code) !== text(row.location_code)) {
      throw invalid(`Location ${row.location_code} is not assigned to Asset ${row.asset_num}`)
    }
  }

  if (text(row.store_code)) {
    const store = await pool.request()
      .input('storeCode', row.store_code)
      .query('select top 1 site_code from dbo.storerooms where store_code = @storeCode')
    if (!store.recordset[0]) throw invalid(`Store ${row.store_code} does not exist`)
    if (text(store.recordset[0].site_code) !== text(row.site_code)) {
      throw invalid(`Store ${row.store_code} does not belong to Site ${row.site_code}`)
    }
  }

  if (text(row.schedule_rule_name)) {
    const scheduleRule = await pool.request()
      .input('ruleName', row.schedule_rule_name)
      .query('select top 1 status from dbo.pm_schedule_rules where rule_name = @ruleName')
    if (!scheduleRule.recordset[0]) throw invalid(`PM Schedule Rule ${row.schedule_rule_name} does not exist`)
    if (status === 'ACTIVE' && upper(scheduleRule.recordset[0].status) !== 'ACTIVE') {
      throw invalid(`PM Schedule Rule ${row.schedule_rule_name} must be active before this PM can be active`)
    }
  }

  await validateConfiguredWoStatus(pool, row.wo_status)
}

const normalizePayload = payload => ({
  ...payload,
  ...(payload.frequency_unit !== undefined ? { frequency_unit: normalizePmFrequencyUnit(payload.frequency_unit) } : {}),
  ...(payload.pm_status !== undefined ? { pm_status: upper(payload.pm_status) } : {}),
  ...(payload.wo_status !== undefined ? { wo_status: normalizeWoStatus(payload.wo_status) } : {})
})

export const preparePreventiveMaintenanceCreate = async ({ pool, payload }) => {
  const normalized = normalizePayload({
    ...payload,
    work_type: 'PM',
    pm_status: payload.pm_status || 'ACTIVE',
    wo_status: payload.wo_status || 'WSCH',
    pm_counter: 0,
    last_generated_cycle: null
  })
  await validatePmMaster(pool, normalized)
  return normalized
}

export const preparePreventiveMaintenanceUpdate = async ({ pool, payload, current }) => {
  const normalized = normalizePayload({ ...payload, work_type: 'PM' })
  await validatePmMaster(pool, { ...current, ...normalized })
  delete normalized.pm_counter
  delete normalized.last_generated_cycle
  return normalized
}

const normalizeRulePayload = payload => ({
  ...payload,
  ...(payload.frequency_unit !== undefined ? { frequency_unit: normalizePmFrequencyUnit(payload.frequency_unit) } : {}),
  ...(payload.default_wo_status !== undefined ? { default_wo_status: normalizeWoStatus(payload.default_wo_status) } : {}),
  ...(payload.status !== undefined ? { status: upper(payload.status) === 'ACTIVE' ? 'Active' : upper(payload.status) === 'INACTIVE' ? 'Inactive' : payload.status } : {})
})

const validatePmScheduleRule = async (pool, row) => {
  const frequency = Number(row.frequency)
  const unit = normalizePmFrequencyUnit(row.frequency_unit || 'MONTHS')
  const leadTime = Number(row.lead_time_days || 0)
  const horizon = Number(row.horizon_days ?? 30)
  const triggerHour = Number(row.trigger_hour || 0)
  const status = upper(row.status || 'ACTIVE')
  if (!text(row.rule_name)) throw invalid('Rule Name is required')
  if (!(frequency > 0)) throw invalid('PM rule frequency must be greater than zero')
  if (!['MINUTES', 'HOURS', 'DAYS', 'WEEKS', 'MONTHS', 'QUARTERS', 'YEARS'].includes(unit)) {
    throw invalid('Unsupported PM rule frequency unit', [unit || 'blank'])
  }
  if (!Number.isFinite(leadTime) || leadTime < 0) throw invalid('PM rule Lead Time must be zero or greater')
  if (!Number.isFinite(horizon) || horizon < 0) throw invalid('PM rule Generation Horizon must be zero or greater')
  if (!Number.isInteger(triggerHour) || triggerHour < 0 || triggerHour > 23) throw invalid('PM rule Trigger Hour must be from 0 to 23')
  if (!['ACTIVE', 'INACTIVE'].includes(status)) throw invalid('PM rule Status must be Active or Inactive')
  await validateConfiguredWoStatus(pool, row.default_wo_status)
}

export const preparePmScheduleRuleCreate = async ({ pool, payload }) => {
  const normalized = normalizeRulePayload({
    ...payload,
    frequency: payload.frequency || 1,
    frequency_unit: payload.frequency_unit || 'MONTHS',
    lead_time_days: payload.lead_time_days ?? 0,
    horizon_days: payload.horizon_days ?? 30,
    trigger_hour: payload.trigger_hour ?? 0,
    wo_prefix: payload.wo_prefix || 'PMWO-',
    default_wo_status: payload.default_wo_status || 'WSCH',
    status: payload.status || 'Active'
  })
  await validatePmScheduleRule(pool, normalized)
  return normalized
}

export const preparePmScheduleRuleUpdate = async ({ pool, payload, current }) => {
  const normalized = normalizeRulePayload(payload)
  await validatePmScheduleRule(pool, { ...current, ...normalized })
  return normalized
}

export const importPreventiveMaintenanceMasters = async ({ pool, rows, userId }) => {
  if (!Array.isArray(rows) || !rows.length) throw invalid('No PM master rows were supplied')
  if (rows.length > 5000) throw invalid('A PM master import is limited to 5,000 rows per file')

  const normalizedRows = rows.map(row => normalizePayload({
    ...row,
    work_type: 'PM',
    pm_status: row.pm_status || 'ACTIVE',
    wo_status: row.wo_status || 'WSCH',
    created_by_user_id: userId || null
  }))
  const transaction = new sql.Transaction(pool)
  await transaction.begin()
  try {
    const result = await new sql.Request(transaction)
      .input('rows', sql.NVarChar(sql.MAX), JSON.stringify(normalizedRows))
      .query(`
        set xact_abort on;

        declare @incoming table (
          pm_num nvarchar(80) not null,
          description nvarchar(300) null,
          asset_num nvarchar(80) null,
          route_code nvarchar(80) null,
          location_code nvarchar(80) null,
          job_plan_num nvarchar(80) null,
          next_date datetime2 null,
          lead_time_days int null,
          frequency int null,
          frequency_unit nvarchar(40) null,
          schedule_rule_name nvarchar(160) null,
          work_type nvarchar(40) null,
          wo_status nvarchar(40) null,
          store_code nvarchar(80) null,
          supervisor nvarchar(160) null,
          lead_person nvarchar(160) null,
          person_group nvarchar(120) null,
          site_code nvarchar(30) null,
          department_name nvarchar(160) null,
          sub_department_code nvarchar(50) null,
          pm_status nvarchar(40) null,
          created_by_user_id nvarchar(50) null
        );

        insert into @incoming
        select
          ltrim(rtrim(pm_num)), ltrim(rtrim(description)), nullif(ltrim(rtrim(asset_num)), N''),
          nullif(ltrim(rtrim(route_code)), N''), nullif(ltrim(rtrim(location_code)), N''),
          nullif(ltrim(rtrim(job_plan_num)), N''), next_date, lead_time_days, frequency,
          upper(ltrim(rtrim(frequency_unit))), nullif(ltrim(rtrim(schedule_rule_name)), N''),
          N'PM', upper(ltrim(rtrim(wo_status))), nullif(ltrim(rtrim(store_code)), N''),
          nullif(ltrim(rtrim(supervisor)), N''), nullif(ltrim(rtrim(lead_person)), N''),
          nullif(ltrim(rtrim(person_group)), N''), nullif(ltrim(rtrim(site_code)), N''),
          nullif(ltrim(rtrim(department_name)), N''), nullif(ltrim(rtrim(sub_department_code)), N''),
          upper(ltrim(rtrim(pm_status))), nullif(ltrim(rtrim(created_by_user_id)), N'')
        from openjson(@rows)
        with (
          pm_num nvarchar(80) '$.pm_num',
          description nvarchar(300) '$.description',
          asset_num nvarchar(80) '$.asset_num',
          route_code nvarchar(80) '$.route_code',
          location_code nvarchar(80) '$.location_code',
          job_plan_num nvarchar(80) '$.job_plan_num',
          next_date datetime2 '$.next_date',
          lead_time_days int '$.lead_time_days',
          frequency int '$.frequency',
          frequency_unit nvarchar(40) '$.frequency_unit',
          schedule_rule_name nvarchar(160) '$.schedule_rule_name',
          work_type nvarchar(40) '$.work_type',
          wo_status nvarchar(40) '$.wo_status',
          store_code nvarchar(80) '$.store_code',
          supervisor nvarchar(160) '$.supervisor',
          lead_person nvarchar(160) '$.lead_person',
          person_group nvarchar(120) '$.person_group',
          site_code nvarchar(30) '$.site_code',
          department_name nvarchar(160) '$.department_name',
          sub_department_code nvarchar(50) '$.sub_department_code',
          pm_status nvarchar(40) '$.pm_status',
          created_by_user_id nvarchar(50) '$.created_by_user_id'
        );

        declare @invalid nvarchar(80);
        declare @message nvarchar(2048);

        select top 1 @invalid = pm_num from @incoming
        where description is null or description = N'' or (asset_num is null and location_code is null)
          or job_plan_num is null or next_date is null or lead_time_days is null
          or frequency is null or frequency <= 0 or frequency_unit is null
          or wo_status is null or pm_status is null
          or site_code is null or department_name is null or sub_department_code is null;
        if @invalid is not null
        begin
          set @message = concat(N'PM master ', @invalid, N' is incomplete.');
          throw 51010, @message, 1;
        end;

        set @invalid = null;
        select top 1 @invalid = pm_num from @incoming group by pm_num having count_big(1) > 1;
        if @invalid is not null
        begin
          set @message = concat(N'PMNUM ', @invalid, N' is duplicated in the import.');
          throw 51011, @message, 1;
        end;

        set @invalid = null;
        select top 1 @invalid = pm_num from @incoming
        where frequency_unit not in ('MINUTES', 'HOURS', 'DAYS', 'WEEKS', 'MONTHS', 'QUARTERS', 'YEARS')
          or lead_time_days < 0
          or pm_status not in ('ACTIVE', 'INACTIVE', 'DRAFT');
        if @invalid is not null
        begin
          set @message = concat(N'PM master ', @invalid, N' has an invalid frequency, lead time, or status.');
          throw 51012, @message, 1;
        end;

        set @invalid = null;
        select top 1 @invalid = incoming.pm_num
        from @incoming incoming
        left join dbo.sites site on site.site_code = incoming.site_code
        left join dbo.departments department on department.sub_department_code = incoming.sub_department_code
        left join dbo.assets asset on asset.asset_num = incoming.asset_num
        left join dbo.locations location on location.location_code = incoming.location_code
        left join dbo.storerooms store on store.store_code = incoming.store_code
        where site.site_code is null
          or department.sub_department_code is null
          or department.department_name <> incoming.department_name
          or (incoming.asset_num is not null and asset.asset_num is null)
          or (incoming.location_code is not null and location.location_code is null)
          or (incoming.store_code is not null and store.store_code is null)
          or (asset.asset_num is not null and asset.site_code <> incoming.site_code)
          or (location.location_code is not null and location.site_code <> incoming.site_code)
          or (store.store_code is not null and store.site_code <> incoming.site_code)
          or (asset.location_code is not null and incoming.location_code is not null and asset.location_code <> incoming.location_code)
          or (asset.asset_num is not null and incoming.location_code is null and asset.location_code is null);
        if @invalid is not null
        begin
          set @message = concat(N'PM master ', @invalid, N' has an invalid site, department, asset, location, or store reference.');
          throw 51013, @message, 1;
        end;

        set @invalid = null;
        select top 1 @invalid = incoming.pm_num
        from @incoming incoming
        left join dbo.job_plans job_plan on job_plan.job_plan_num = incoming.job_plan_num
        outer apply (
          select sum(isnull(task.duration_hours, 0) * 60) as task_minutes
          from dbo.job_plan_tasks task
          where task.job_plan_num = incoming.job_plan_num
        ) duration
        where job_plan.job_plan_num is null
          or (incoming.pm_status = 'ACTIVE' and upper(job_plan.status) <> 'ACTIVE')
          or (incoming.pm_status = 'ACTIVE' and coalesce(nullif(job_plan.estimated_duration_minutes, 0), duration.task_minutes, 0) <= 0);
        if @invalid is not null
        begin
          set @message = concat(N'PM master ', @invalid, N' requires an active Job Plan with an estimated duration.');
          throw 51014, @message, 1;
        end;

        set @invalid = null;
        select top 1 @invalid = incoming.pm_num
        from @incoming incoming
        left join dbo.pm_schedule_rules schedule_rule on schedule_rule.rule_name = incoming.schedule_rule_name
        where incoming.schedule_rule_name is not null
          and (schedule_rule.rule_name is null or (incoming.pm_status = 'ACTIVE' and upper(schedule_rule.status) <> 'ACTIVE'));
        if @invalid is not null
        begin
          set @message = concat(N'PM master ', @invalid, N' references a missing or inactive PM Schedule Rule.');
          throw 51015, @message, 1;
        end;

        set @invalid = null;
        select top 1 @invalid = incoming.pm_num
        from @incoming incoming
        where incoming.wo_status not in ('ON_HOLD_MATERIAL', 'ON_HOLD_PERMIT')
          and not exists (
            select 1 from dbo.work_order_workflow_steps workflow_step
            where workflow_step.workflow_key = 'DEFAULT'
              and workflow_step.status_code = incoming.wo_status
          );
        if @invalid is not null
        begin
          set @message = concat(N'PM master ', @invalid, N' uses a WO Status that is not configured in the Work Order workflow.');
          throw 51016, @message, 1;
        end;

        merge dbo.preventive_maintenance with (holdlock) as target
        using @incoming as incoming on target.pm_num = incoming.pm_num
        when matched then update set
          description = incoming.description,
          asset_num = incoming.asset_num,
          route_code = incoming.route_code,
          location_code = incoming.location_code,
          job_plan_num = incoming.job_plan_num,
          next_date = incoming.next_date,
          lead_time_days = incoming.lead_time_days,
          frequency = incoming.frequency,
          frequency_unit = incoming.frequency_unit,
          schedule_rule_name = incoming.schedule_rule_name,
          work_type = N'PM',
          wo_status = incoming.wo_status,
          store_code = incoming.store_code,
          supervisor = incoming.supervisor,
          lead_person = incoming.lead_person,
          person_group = incoming.person_group,
          site_code = incoming.site_code,
          department_name = incoming.department_name,
          sub_department_code = incoming.sub_department_code,
          pm_status = incoming.pm_status,
          updated_at = sysutcdatetime()
        when not matched then insert (
          pm_num, description, asset_num, route_code, location_code, job_plan_num,
          next_date, lead_time_days, frequency, frequency_unit, schedule_rule_name,
          pm_counter, work_type, wo_status, store_code, supervisor, lead_person,
          person_group, site_code, department_name, sub_department_code, pm_status,
          last_generated_cycle, created_by_user_id
        ) values (
          incoming.pm_num, incoming.description, incoming.asset_num, incoming.route_code,
          incoming.location_code, incoming.job_plan_num, incoming.next_date,
          incoming.lead_time_days, incoming.frequency, incoming.frequency_unit,
          incoming.schedule_rule_name, 0, N'PM', incoming.wo_status, incoming.store_code,
          incoming.supervisor, incoming.lead_person, incoming.person_group,
          incoming.site_code, incoming.department_name, incoming.sub_department_code,
          incoming.pm_status, null, incoming.created_by_user_id
        )
        output inserted.pm_num;
      `)
    await transaction.commit()
    return result.recordset.map(row => row.pm_num)
  } catch (error) {
    await transaction.rollback().catch(() => {})
    if (Number(error.number) >= 51010 && Number(error.number) <= 51016) {
      error.status = 400
      error.name = 'BadRequest'
    }
    throw error
  }
}

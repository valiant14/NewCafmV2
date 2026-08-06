const text = value => String(value || '').trim()
const owns = (value, key) => Object.prototype.hasOwnProperty.call(value || {}, key)

const badRequest = message => {
  const error = new Error(message)
  error.status = 400
  error.code = 'InvalidRoutingMaster'
  return error
}

const scopeValue = (payload, current, key) => text(owns(payload, key) ? payload[key] : current?.[key])
const sameText = (left, right) => text(left).toLowerCase() === text(right).toLowerCase()

const findSystem = async (pool, { value, site, department, subDepartment }) => {
  const result = await pool.request()
    .input('value', value)
    .input('site', site)
    .input('department', department)
    .input('subDepartment', subDepartment)
    .query(`
      select top 1 system_code
      from dbo.systems
      where (system_code = @value or system_name = @value)
        and upper(ltrim(rtrim(status))) <> 'INACTIVE'
        and (@site = '' or site_code = @site)
        and (@department = '' or lower(ltrim(rtrim(department_name))) = lower(ltrim(rtrim(@department))))
        and (@subDepartment = '' or sub_department_code is null or sub_department_code = @subDepartment)
      order by case when system_name = @value then 0 else 1 end, system_code
    `)
  return result.recordset[0]?.system_code || ''
}

const findWorkGroup = async (pool, { value, site, department, subDepartment }) => {
  const result = await pool.request()
    .input('value', value)
    .input('site', site)
    .input('department', department)
    .input('subDepartment', subDepartment)
    .query(`
      select top 1 work_group_code, work_group_name, default_supervisor_labor_id
      from dbo.work_groups
      where (work_group_code = @value or work_group_name = @value)
        and upper(ltrim(rtrim(status))) <> 'INACTIVE'
        and (@site = '' or site_code = @site)
        and (@department = '' or lower(ltrim(rtrim(department_name))) = lower(ltrim(rtrim(@department))))
        and (@subDepartment = '' or sub_department_code is null or sub_department_code = @subDepartment)
      order by case when work_group_name = @value then 0 else 1 end, work_group_code
    `)
  return result.recordset[0] || null
}

const findSupervisor = async (pool, { value, site, department, subDepartment }) => {
  const result = await pool.request()
    .input('value', value)
    .input('site', site)
    .input('department', department)
    .input('subDepartment', subDepartment)
    .query(`
      select top 1 labor_id
      from dbo.labor
      where (labor_id = @value or display_name = @value)
        and upper(ltrim(rtrim(status))) <> 'INACTIVE'
        and (@site = '' or site_code = @site)
        and (@department = '' or lower(ltrim(rtrim(department_name))) = lower(ltrim(rtrim(@department))))
        and (@subDepartment = '' or sub_department_code is null or sub_department_code = @subDepartment)
      order by case when display_name = @value then 0 else 1 end, labor_id
    `)
  return result.recordset[0]?.labor_id || ''
}

const assertExistingPlanMatchesRouting = async (pool, workOrderNumber, routing) => {
  const result = await pool.request()
    .input('workOrderNumber', workOrderNumber)
    .input('workGroup', routing.workGroup)
    .input('site', routing.site)
    .input('department', routing.department)
    .input('subDepartment', routing.subDepartment)
    .query(`
      select top 1 planned.planned_labor_id
      from dbo.work_order_planned_labor planned
      left join dbo.labor labor
        on labor.labor_id = planned.assigned_crew
        or lower(ltrim(rtrim(labor.display_name))) = lower(ltrim(rtrim(planned.assigned_crew)))
      where planned.work_order_num = @workOrderNumber
        and nullif(ltrim(rtrim(planned.assigned_crew)), '') is not null
        and (
          nullif(@workGroup, '') is null
          or labor.labor_id is null
          or isnull(labor.work_group_code, '') <> isnull(@workGroup, '')
          or isnull(labor.site_code, '') <> isnull(@site, '')
          or lower(ltrim(rtrim(isnull(labor.department_name, '')))) <> lower(ltrim(rtrim(isnull(@department, ''))))
          or (nullif(@subDepartment, '') is not null and labor.sub_department_code is not null and labor.sub_department_code <> @subDepartment)
        )
    `)
  if (result.recordset[0]) {
    throw badRequest('Remove or reassign existing Planned Labor before changing the Work Group, Supervisor, or routing scope.')
  }
}

export const validateWorkOrderRouting = async ({ pool, payload, current = {}, id }) => {
  const next = { ...payload }
  const site = scopeValue(payload, current, 'site_code')
  const department = scopeValue(payload, current, 'department_name')
  const assignedDepartment = scopeValue(payload, current, 'assigned_department_name') || department
  const subDepartment = scopeValue(payload, current, 'sub_department_code')
  const scopeChanged = ['site_code', 'department_name', 'assigned_department_name', 'sub_department_code'].some(key => owns(payload, key))

  if (owns(payload, 'system_name') || scopeChanged) {
    const value = scopeValue(payload, current, 'system_name')
    if (!value) next.system_name = null
    else {
      const match = await findSystem(pool, { value, site, department, subDepartment })
      if (!match) throw badRequest('Select an active System configured for this site, department, and sub-department.')
      next.system_name = match
    }
  }

  if (owns(payload, 'work_group') || scopeChanged) {
    const value = scopeValue(payload, current, 'work_group')
    if (!value) next.work_group = null
    else {
      const match = await findWorkGroup(pool, { value, site, department: assignedDepartment, subDepartment })
      if (!match) throw badRequest('Select an active Work Group configured for this site and assigned department.')
      next.work_group = match.work_group_code
    }
  }

  if (owns(payload, 'supervisor') || scopeChanged) {
    const value = scopeValue(payload, current, 'supervisor')
    if (!value) next.supervisor = null
    else {
      const match = await findSupervisor(pool, { value, site, department: assignedDepartment, subDepartment })
      if (!match) throw badRequest('Select an active Supervisor from Labor for this site and assigned department.')
      next.supervisor = match
    }
  }

  const workGroup = text(owns(next, 'work_group') ? next.work_group : current.work_group)
  const selectedGroup = workGroup
    ? await findWorkGroup(pool, { value: workGroup, site, department: assignedDepartment, subDepartment })
    : null
  if (workGroup && !selectedGroup) throw badRequest('Select an active Work Group configured for this site and assigned department.')
  if (selectedGroup) {
    const configuredSupervisor = text(selectedGroup.default_supervisor_labor_id)
    const teamSupervisor = configuredSupervisor && await findSupervisor(pool, {
      value: configuredSupervisor,
      site,
      department: assignedDepartment,
      subDepartment
    })
    if (!teamSupervisor) throw badRequest('The selected Work Group has no active default Supervisor.')
    const selectedSupervisor = text(owns(next, 'supervisor') ? next.supervisor : current.supervisor)
    if (!selectedSupervisor || (owns(payload, 'work_group') && !owns(payload, 'supervisor'))) next.supervisor = teamSupervisor
    else if (!sameText(selectedSupervisor, teamSupervisor)) throw badRequest('The selected Supervisor does not lead the selected Work Group.')
  }

  const effectiveSupervisor = text(owns(next, 'supervisor') ? next.supervisor : current.supervisor)
  const routingChanged = Boolean(id) && [
    ['site_code', site],
    ['department_name', department],
    ['assigned_department_name', assignedDepartment],
    ['sub_department_code', subDepartment],
    ['work_group', workGroup],
    ['supervisor', effectiveSupervisor]
  ].some(([key, value]) => owns(payload, key) && !sameText(current[key], value))
  if (routingChanged) {
    await assertExistingPlanMatchesRouting(pool, id, {
      workGroup,
      supervisor: effectiveSupervisor,
      site,
      department: assignedDepartment,
      subDepartment
    })
  }

  return next
}

export const validateAssetSystem = async ({ pool, payload, current = {} }) => {
  const scopeChanged = ['site_code', 'department_name', 'sub_department_code'].some(key => owns(payload, key))
  if (!owns(payload, 'system_name') && !scopeChanged) return payload
  const value = scopeValue(payload, current, 'system_name')
  if (!value) return { ...payload, system_name: null }
  const match = await findSystem(pool, {
    value,
    site: scopeValue(payload, current, 'site_code'),
    department: scopeValue(payload, current, 'department_name'),
    subDepartment: scopeValue(payload, current, 'sub_department_code')
  })
  if (!match) throw badRequest('Select an active System configured for this asset site and department.')
  return { ...payload, system_name: match }
}

export const validateWorkGroupMaster = async ({ pool, payload, current = {} }) => {
  const next = { ...payload }
  const shouldValidate = owns(payload, 'default_supervisor_labor_id')
    || ['site_code', 'department_name', 'sub_department_code'].some(key => owns(payload, key))
  if (!shouldValidate) return next
  const supervisorId = scopeValue(payload, current, 'default_supervisor_labor_id')
  if (!supervisorId) throw badRequest('Select a default Supervisor for this Work Group.')

  const result = await pool.request()
    .input('laborId', supervisorId)
    .input('site', scopeValue(payload, current, 'site_code'))
    .input('department', scopeValue(payload, current, 'department_name'))
    .input('subDepartment', scopeValue(payload, current, 'sub_department_code'))
    .query(`
      select top 1 labor_id
      from dbo.labor
      where labor_id = @laborId
        and upper(ltrim(rtrim(status))) <> 'INACTIVE'
        and (@site = '' or site_code = @site)
        and (@department = '' or lower(ltrim(rtrim(department_name))) = lower(ltrim(rtrim(@department))))
        and (@subDepartment = '' or sub_department_code is null or sub_department_code = @subDepartment)
    `)
  if (!result.recordset[0]) throw badRequest('Default Supervisor must be an active Labor record in the same routing scope.')
  return { ...next, default_supervisor_labor_id: result.recordset[0].labor_id }
}

export const validateLaborRouting = async ({ pool, payload, current = {} }) => {
  const next = { ...payload }
  const scopeChanged = ['site_code', 'department_name', 'sub_department_code'].some(key => owns(payload, key))
  if (!owns(payload, 'work_group_code') && !scopeChanged) return next
  const workGroup = scopeValue(payload, current, 'work_group_code')
  if (!workGroup) return { ...next, work_group_code: null }
  const match = await findWorkGroup(pool, {
    value: workGroup,
    site: scopeValue(payload, current, 'site_code'),
    department: scopeValue(payload, current, 'department_name'),
    subDepartment: scopeValue(payload, current, 'sub_department_code')
  })
  if (!match) throw badRequest('Select an active Work Group in the same site, department, and sub-department as this Labor record.')
  return { ...next, work_group_code: match.work_group_code }
}

export const validatePlannedLaborAssignment = async ({ pool, payload, current = {} }) => {
  const next = { ...payload }
  const workOrderNumber = scopeValue(payload, current, 'work_order_num')
  const assignedCrew = scopeValue(payload, current, 'assigned_crew')
  if (!workOrderNumber) throw badRequest('Work Order is required for Planned Labor.')
  if (!assignedCrew) throw badRequest('Select a Labor team member for Planned Labor.')

  const routingResult = await pool.request()
    .input('workOrderNumber', workOrderNumber)
    .query(`
      select top 1 work_order_num, site_code,
        coalesce(nullif(assigned_department_name, ''), department_name) as department_name,
        sub_department_code, work_group, supervisor
      from dbo.work_orders
      where work_order_num = @workOrderNumber
    `)
  const workOrder = routingResult.recordset[0]
  if (!workOrder) throw badRequest('The Planned Labor Work Order does not exist.')
  if (!text(workOrder.work_group) || !text(workOrder.supervisor)) {
    throw badRequest('Assign a Work Group and Supervisor on the Work Order before planning Labor.')
  }

  const group = await findWorkGroup(pool, {
    value: text(workOrder.work_group),
    site: text(workOrder.site_code),
    department: text(workOrder.department_name),
    subDepartment: text(workOrder.sub_department_code)
  })
  const activeSupervisor = group && await findSupervisor(pool, {
    value: text(group.default_supervisor_labor_id),
    site: text(workOrder.site_code),
    department: text(workOrder.department_name),
    subDepartment: text(workOrder.sub_department_code)
  })
  if (!group || !activeSupervisor || !sameText(activeSupervisor, workOrder.supervisor)) {
    throw badRequest('The Work Order Supervisor does not lead the selected Work Group.')
  }

  const laborResult = await pool.request()
    .input('assignedCrew', assignedCrew)
    .input('workGroup', group.work_group_code)
    .input('site', text(workOrder.site_code))
    .input('department', text(workOrder.department_name))
    .input('subDepartment', text(workOrder.sub_department_code))
    .query(`
      select top 1 labor_id, craft_name
      from dbo.labor
      where (labor_id = @assignedCrew or display_name = @assignedCrew)
        and work_group_code = @workGroup
        and site_code = @site
        and lower(ltrim(rtrim(department_name))) = lower(ltrim(rtrim(@department)))
        and (@subDepartment = '' or sub_department_code is null or sub_department_code = @subDepartment)
        and upper(ltrim(rtrim(status))) <> 'INACTIVE'
      order by case when labor_id = @assignedCrew then 0 else 1 end, labor_id
    `)
  const labor = laborResult.recordset[0]
  if (!labor) throw badRequest('Select active Labor that belongs to the Work Order Supervisor and Work Group.')
  next.assigned_crew = labor.labor_id
  if (!text(scopeValue(payload, current, 'craft_name')) && text(labor.craft_name)) next.craft_name = labor.craft_name
  return next
}

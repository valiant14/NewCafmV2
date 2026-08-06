const text = value => String(value || '').trim()
const owns = (value, key) => Object.prototype.hasOwnProperty.call(value || {}, key)

const badRequest = message => {
  const error = new Error(message)
  error.status = 400
  error.code = 'InvalidRoutingMaster'
  return error
}

const scopeValue = (payload, current, key) => text(owns(payload, key) ? payload[key] : current?.[key])

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
      select top 1 work_group_code
      from dbo.work_groups
      where (work_group_code = @value or work_group_name = @value)
        and upper(ltrim(rtrim(status))) <> 'INACTIVE'
        and (@site = '' or site_code = @site)
        and (@department = '' or lower(ltrim(rtrim(department_name))) = lower(ltrim(rtrim(@department))))
        and (@subDepartment = '' or sub_department_code is null or sub_department_code = @subDepartment)
      order by case when work_group_name = @value then 0 else 1 end, work_group_code
    `)
  return result.recordset[0]?.work_group_code || ''
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

export const validateWorkOrderRouting = async ({ pool, payload, current = {} }) => {
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
      next.work_group = match
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
  if (!supervisorId) return { ...next, default_supervisor_labor_id: null }

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

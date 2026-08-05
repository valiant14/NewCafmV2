const normalizeList = value => [...new Set((Array.isArray(value) ? value : [])
  .map(item => String(item || '').trim())
  .filter(Boolean))]

export const normalizeDataScope = value => {
  const scope = String(value || '').trim().toUpperCase()
  return ['GLOBAL', 'DEPARTMENT', 'OWN'].includes(scope) ? scope : 'DEPARTMENT'
}

export const scopeFromUser = user => ({
  userId: String(user?.userId || '').trim(),
  dataScope: normalizeDataScope(user?.dataScope),
  siteCodes: normalizeList(user?.siteCodes),
  departmentNames: normalizeList(user?.departmentNames || user?.departments),
  subDepartmentCodes: normalizeList(user?.subDepartmentCodes)
})

const addListClause = ({ clauses, params, values, column, parameterPrefix }) => {
  if (!column) return
  if (!values.length) {
    clauses.push('1 = 0')
    return
  }
  const names = values.map((_, index) => `@${parameterPrefix}${index}`)
  clauses.push(`${column} in (${names.join(', ')})`)
  values.forEach((value, index) => { params[`${parameterPrefix}${index}`] = value })
}

export const addScopeWhere = ({
  user,
  siteColumn = 'site_code',
  departmentColumn = 'department_name',
  departmentColumns = [],
  subDepartmentColumn = null,
  ownerColumn = null,
  alias = ''
}) => {
  const prefix = alias ? `${alias}.` : ''
  const scope = scopeFromUser(user)
  if (scope.dataScope === 'GLOBAL') return { where: '', params: {} }

  const clauses = []
  const params = {}
  const scopedDepartmentColumns = [...new Set([departmentColumn, ...departmentColumns].filter(Boolean))]

  addListClause({
    clauses,
    params,
    values: scope.siteCodes,
    column: siteColumn ? `${prefix}${siteColumn}` : null,
    parameterPrefix: 'scopeSite'
  })

  let departmentExpression = ''
  if (scopedDepartmentColumns.length || subDepartmentColumn) {
    const departmentClauses = []
    if (scopedDepartmentColumns.length && scope.departmentNames.length) {
      const names = scope.departmentNames.map((_, index) => `@scopeDepartment${index}`)
      scopedDepartmentColumns.forEach(column => departmentClauses.push(`${prefix}${column} in (${names.join(', ')})`))
      scope.departmentNames.forEach((value, index) => { params[`scopeDepartment${index}`] = value })
    }
    if (subDepartmentColumn && scope.subDepartmentCodes.length) {
      const names = scope.subDepartmentCodes.map((_, index) => `@scopeSubDepartment${index}`)
      departmentClauses.push(`${prefix}${subDepartmentColumn} in (${names.join(', ')})`)
      scope.subDepartmentCodes.forEach((value, index) => { params[`scopeSubDepartment${index}`] = value })
    }
    departmentExpression = departmentClauses.length ? `(${departmentClauses.join(' or ')})` : '1 = 0'
  }

  const ownerExpression = ownerColumn && scope.userId ? `${prefix}${ownerColumn} = @scopeOwnerUserId` : ''
  if (ownerExpression) params.scopeOwnerUserId = scope.userId
  if (scope.dataScope === 'OWN' && ownerColumn) {
    clauses.push(ownerExpression || '1 = 0')
  } else if (departmentExpression && ownerExpression) {
    clauses.push(`(${departmentExpression} or ${ownerExpression})`)
  } else if (departmentExpression) {
    clauses.push(departmentExpression)
  }

  return { where: clauses.length ? ` and ${clauses.join(' and ')}` : '', params }
}

const forbidden = message => {
  const error = new Error(message)
  error.status = 403
  error.code = 'ScopeViolation'
  return error
}

const same = (left, right) => String(left || '').trim().toLowerCase() === String(right || '').trim().toLowerCase()
const includes = (values, target) => values.some(value => same(value, target))

export const applyScopeDefaults = ({ user, payload, siteColumn, departmentColumn }) => {
  const scope = scopeFromUser(user)
  if (scope.dataScope === 'GLOBAL') return payload
  const next = { ...payload }
  if (siteColumn && !String(next[siteColumn] || '').trim() && scope.siteCodes.length === 1) {
    next[siteColumn] = scope.siteCodes[0]
  }
  if (departmentColumn && !String(next[departmentColumn] || '').trim() && scope.departmentNames.length === 1) {
    next[departmentColumn] = scope.departmentNames[0]
  }
  return next
}

export const assertPayloadWithinScope = ({
  user,
  payload,
  siteColumn = 'site_code',
  departmentColumn = 'department_name',
  departmentColumns = [],
  subDepartmentColumn = null,
  requireValues = false
}) => {
  const scope = scopeFromUser(user)
  if (scope.dataScope === 'GLOBAL') return

  if (siteColumn && (requireValues || Object.hasOwn(payload, siteColumn))) {
    const site = String(payload[siteColumn] || '').trim()
    if (!site || !includes(scope.siteCodes, site)) throw forbidden('The selected site is outside your access scope.')
  }

  const scopedDepartmentColumns = [...new Set([departmentColumn, ...departmentColumns].filter(Boolean))]
  const providedDepartments = scopedDepartmentColumns
    .filter(column => Object.hasOwn(payload, column))
    .map(column => String(payload[column] || '').trim())
    .filter(Boolean)
  const hasDepartment = scopedDepartmentColumns.some(column => Object.hasOwn(payload, column))
  const hasSubDepartment = subDepartmentColumn && Object.hasOwn(payload, subDepartmentColumn)
  if ((scopedDepartmentColumns.length || subDepartmentColumn) && (requireValues || hasDepartment || hasSubDepartment)) {
    const subDepartment = String(payload[subDepartmentColumn] || '').trim()
    const departmentAllowed = providedDepartments.length > 0 && providedDepartments.every(department => includes(scope.departmentNames, department))
    const subDepartmentAllowed = subDepartment && includes(scope.subDepartmentCodes, subDepartment)
    const invalidDepartment = providedDepartments.some(department => !includes(scope.departmentNames, department))
    const invalidSubDepartment = Boolean(subDepartment) && !subDepartmentAllowed && !departmentAllowed
    if (invalidDepartment || invalidSubDepartment || (!departmentAllowed && !subDepartmentAllowed)) {
      throw forbidden('The selected department is outside your access scope.')
    }
  }
}

export const scopeFromUser = user => ({
  siteCodes: user?.siteCodes || [],
  departments: user?.departments || []
})

export const addScopeWhere = ({ user, siteColumn = 'site_code', departmentColumn = 'department_name', alias = '' }) => {
  const prefix = alias ? `${alias}.` : ''
  const scope = scopeFromUser(user)
  const clauses = []
  const params = {}

  if (scope.siteCodes.length && siteColumn) {
    clauses.push(`${prefix}${siteColumn} in (${scope.siteCodes.map((_, index) => `@scopeSite${index}`).join(', ')})`)
    scope.siteCodes.forEach((site, index) => { params[`scopeSite${index}`] = site })
  }

  if (scope.departments.length && departmentColumn) {
    clauses.push(`${prefix}${departmentColumn} in (${scope.departments.map((_, index) => `@scopeDepartment${index}`).join(', ')})`)
    scope.departments.forEach((department, index) => { params[`scopeDepartment${index}`] = department })
  }

  return { where: clauses.length ? ` and ${clauses.join(' and ')}` : '', params }
}

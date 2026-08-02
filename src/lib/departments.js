export const allSystems = []

export const normalizeDepartmentName = value => {
  const text = String(value || '').trim().toLowerCase()
  if (!text) return ''
  const compact = text.replace(/[^a-z0-9]+/g, '')
  if (compact === 'mechanics' || compact === 'mechanical') return 'mechanical'
  return compact
}

export const sameDepartment = (left, right) => normalizeDepartmentName(left) === normalizeDepartmentName(right)

const matchDepartment = name => {
  const key = normalizeDepartmentName(name)
  if (!key) return null
  return null
}

// Systems are categorised by department per the O&M contract. A blank or unrecognised
// department falls back to the full list so the dropdown is never empty.
export const systemsForDepartment = name => matchDepartment(name)?.systems || allSystems

export const systemNamesForDepartment = name => systemsForDepartment(name).map(system => system.name)

export const allWorkGroups = []

export const workGroupsForDepartment = name => matchDepartment(name)?.workGroups || allWorkGroups

export const subDepartmentsForDepartment = name => matchDepartment(name)?.subDepartments || []

export const allSubDepartments = []

// The client's asset sheet stores the sub department as its code (`4-1-1`), while every
// other record and every dropdown uses the name (`HVAC`). Resolves either to the name so
// an asset agrees with the work order it is raised against.
export const subDepartmentName = value => {
  const key = String(value ?? '').trim().toLowerCase()
  if (!key) return ''
  const match = allSubDepartments.find(sub => sub.code.toLowerCase() === key || sub.name.toLowerCase() === key)
  return match?.name || String(value).trim()
}

export const systemCodeFor = name => {
  const key = String(name || '').trim().toLowerCase()
  return allSystems.find(system => system.name.toLowerCase() === key)?.code || ''
}

export const systemLabel = name => {
  const code = systemCodeFor(name)
  return code ? `${code} · ${name}` : name || ''
}

export const allCrafts = []

export const craftsForDepartment = name => {
  const match = matchDepartment(name)
  return []
}

export const craftByCode = code => {
  const key = String(code || '').trim().toUpperCase()
  return null
}

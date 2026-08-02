import departments from '../data/departments.json'
import crafts from '../data/crafts.json'

export const allSystems = departments.flatMap(department => department.systems || [])

const matchDepartment = name => {
  const key = String(name || '').trim().toLowerCase()
  if (!key) return null
  return departments.find(department => department.name.toLowerCase() === key || department.code.toLowerCase() === key) || null
}

// Systems are categorised by department per the O&M contract. A blank or unrecognised
// department falls back to the full list so the dropdown is never empty.
export const systemsForDepartment = name => matchDepartment(name)?.systems || allSystems

export const systemNamesForDepartment = name => systemsForDepartment(name).map(system => system.name)

export const allWorkGroups = departments.flatMap(department => department.workGroups || [])

export const workGroupsForDepartment = name => matchDepartment(name)?.workGroups || allWorkGroups

export const subDepartmentsForDepartment = name => matchDepartment(name)?.subDepartments || departments.flatMap(department => department.subDepartments)

export const allSubDepartments = departments.flatMap(department => department.subDepartments || [])

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

export const allCrafts = crafts

export const craftsForDepartment = name => {
  const match = matchDepartment(name)
  return match ? crafts.filter(craft => craft.department === match.name) : crafts
}

export const craftByCode = code => {
  const key = String(code || '').trim().toUpperCase()
  return crafts.find(craft => craft.code.toUpperCase() === key) || null
}

import { siteCodesForUser } from './accessControl'
import { normalizeDepartmentName } from './departments'

// Workers without the Sites/Departments module permission get a 403 (silently mapped to
// an empty list) from the reference endpoints, so the dropdowns fall back to whatever the
// session already knows: the user's own scope plus the site/department values on the
// scoped rows they can see.

const addSite = (map, value, label = '') => {
  const key = String(value ?? '').trim()
  if (!key || map.has(key)) return
  map.set(key, { value: key, label })
}

export const deriveSiteOptions = ({ siteRecords = [], user = null, locations = [], assets = [], orders = [] }) => {
  const options = new Map()
  siteRecords.filter(site => site.status !== 'Inactive').forEach(site => addSite(options, site.code, site.name))
  siteCodesForUser(user).forEach(code => addSite(options, code))
  locations.forEach(row => addSite(options, row.site))
  assets.forEach(row => addSite(options, row.site))
  orders.forEach(row => addSite(options, row.SITE))
  return [...options.values()]
}

// Department scope strings mix department names with sub-department codes (`4-1-1`);
// codes are not valid department picks, so purely numeric parts are dropped.
const subDepartmentCodePattern = /^[\d\s./-]+$/

const departmentScopeParts = user => String(user?.departmentScope || user?.department || '')
  .split(/[,;|]+/)
  .map(part => part.trim())
  .filter(part => part && !/^all departments$/i.test(part) && !subDepartmentCodePattern.test(part))

export const deriveDepartmentOptions = ({ departmentRecords = [], user = null, assets = [], orders = [], locations = [] }) => {
  const options = new Map()
  const add = value => {
    const text = String(value ?? '').trim()
    const key = normalizeDepartmentName(text)
    if (!key || options.has(key)) return
    options.set(key, { value: text, label: '' })
  }
  departmentRecords.filter(department => department.status !== 'Inactive').forEach(department => add(department.department))
  departmentScopeParts(user).forEach(add)
  assets.forEach(row => add(row.department))
  orders.forEach(row => add(row['DEPARTMENT '] || row.DEPARTMENT))
  locations.forEach(row => add(row.department))
  return [...options.values()]
}

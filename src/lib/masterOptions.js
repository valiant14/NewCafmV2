// Option lists built from the master records, so every add/edit form offers the same choices
// instead of asking people to retype a code from memory. Shapes match the Combobox contract:
// a plain string, or { value, label } where the label is the hint shown on the right.
const active = rows => rows.filter(row => String(row.status || '').trim().toLowerCase() !== 'inactive')
const unique = values => [...new Set(values.map(value => String(value ?? '').trim()).filter(Boolean))]
  .sort((left, right) => left.localeCompare(right, undefined, { numeric: true }))

export const siteOptions = (sites = []) =>
  active(sites).map(site => ({ value: site.code, label: site.name || '' })).filter(option => option.value)

export const departmentOptions = (departments = []) => unique(active(departments).map(row => row.department))

export const subDepartmentOptions = (departments = [], department = '') => {
  const scoped = active(departments).filter(row => !department || row.department === department)
  return scoped
    .map(row => ({ value: row.subDepartmentCode, label: row.description || '' }))
    .filter(option => option.value)
}

export const locationOptions = (locations = []) =>
  active(locations).map(row => ({ value: row.location, label: row.description || '' })).filter(option => option.value)

export const assetOptions = (assets = []) =>
  assets.map(row => ({ value: row.assetnum, label: row.description?.trim() || '' })).filter(option => option.value)

export const storeOptions = (stores = []) =>
  active(stores).map(row => ({ value: row.code, label: row.name || '' })).filter(option => option.value)

export const laborNameOptions = (labor = []) =>
  labor.map(row => ({ value: row.name, label: row.craft || row.craftCode || '' })).filter(option => option.value)

export const craftCodeOptions = (labor = []) => [
  ...new Map(labor.filter(row => row.craftCode).map(row => [row.craftCode, { value: row.craftCode, label: row.craft || '' }])).values()
]

export const craftNameOptions = (labor = []) => unique(labor.map(row => row.craft))

export const buildingOptions = (locations = []) => unique(locations.map(row => row.builiding || row.building))

export const buildingCategoryOptions = (locations = []) =>
  unique(locations.map(row => row['builiding category'] || row.buildingCategory))

export const priorityDescriptionOptions = (locations = []) =>
  unique(locations.map(row => row['priority  description'] || row.priorityDescription))

export const failureClassOptions = (failureCodes = []) => unique(failureCodes.map(row => row['FAILURE CLASS ID']))

export const jobPlanOptions = (jobTasks = []) => [
  ...new Map(jobTasks.filter(task => task.JPNUM).map(task => [task.JPNUM, { value: task.JPNUM, label: task.DESCRIPTION || '' }])).values()
]

export const meterOptions = (meters = []) =>
  active(meters).map(row => ({ value: row.meterId, label: row.meterType || '' })).filter(option => option.value)

// Applies option lists to a MasterRecordModal field list by key, leaving anything unmapped
// untouched - so a form only names the fields it wants turned into a picker.
export const withSuggestions = (fields = [], suggestionsByKey = {}) => fields.map(field => (
  Object.hasOwn(suggestionsByKey, field.key)
    ? { ...field, suggestions: suggestionsByKey[field.key] || [] }
    : field
))

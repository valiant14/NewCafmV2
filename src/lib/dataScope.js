export const roleDataScopeOptions = [
  { value: 'OWN', label: 'Own transactions only' },
  { value: 'DEPARTMENT', label: 'Own and department transactions' }
]

export const userDataScopeOptions = [
  { value: 'ROLE', label: 'Use role default' },
  { value: 'OWN', label: 'Own transactions only' },
  { value: 'DEPARTMENT', label: 'Own and department transactions' },
  { value: 'GLOBAL', label: 'All sites and departments' }
]

export const dataScopeLabel = value => ({
  ROLE: 'Role default',
  OWN: 'Own transactions',
  DEPARTMENT: 'Own and department',
  GLOBAL: 'Global access'
}[String(value || '').toUpperCase()] || 'Sites and departments')

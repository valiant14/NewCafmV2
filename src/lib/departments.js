export const normalizeDepartmentName = value => {
  const text = String(value || '').trim().toLowerCase()
  if (!text) return ''
  const compact = text.replace(/[^a-z0-9]+/g, '')
  if (compact === 'mechanics' || compact === 'mechanical') return 'mechanical'
  return compact
}

export const sameDepartment = (left, right) => normalizeDepartmentName(left) === normalizeDepartmentName(right)

export const systemCodeFor = (name, systems = []) => {
  const key = String(name || '').trim().toLowerCase()
  return systems.find(system => system.name?.toLowerCase() === key || system.code?.toLowerCase() === key)?.code || ''
}

export const systemLabel = (name, systems = []) => {
  const key = String(name || '').trim().toLowerCase()
  const match = systems.find(system => system.name?.toLowerCase() === key || system.code?.toLowerCase() === key)
  return match ? `${match.code} / ${match.name}` : name || ''
}

// Configuration lists that have no backend endpoint yet. They follow the same shape as the
// project-name helper - read guarded for SSR, write returns what it stored so callers can
// do setState(write(next)) - but hold arrays of records rather than a single value.
const storageKeys = {
  notificationRules: 'facility-command-notification-rules',
  connectors: 'facility-command-connectors',
  pmRules: 'facility-command-pm-rules'
}

const readList = key => {
  if (typeof window === 'undefined') return []
  try {
    const stored = window.localStorage.getItem(storageKeys[key])
    const parsed = stored ? JSON.parse(stored) : []
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

const writeList = (key, rows) => {
  const value = Array.isArray(rows) ? rows : []
  if (typeof window !== 'undefined') window.localStorage.setItem(storageKeys[key], JSON.stringify(value))
  return value
}

export const readNotificationRules = () => readList('notificationRules')
export const writeNotificationRules = rows => writeList('notificationRules', rows)

export const readConnectors = () => readList('connectors')
export const writeConnectors = rows => writeList('connectors', rows)

export const readPmRules = () => readList('pmRules')
export const writePmRules = rows => writeList('pmRules', rows)

// Matches the setRows(updaterFn) contract the settings pages already expect, while writing
// through to storage instead of the API.
export const storedListSetter = (setState, write) => update => setState(current => {
  const next = typeof update === 'function' ? update(current) : update
  return write(next)
})

const storageKey = 'facility-command-project-name'

export const defaultProjectName = 'Royal Court Facilities'

export const readProjectName = () => {
  if (typeof window === 'undefined') return defaultProjectName
  return window.localStorage.getItem(storageKey) || defaultProjectName
}

export const writeProjectName = name => {
  const value = String(name || '').trim() || defaultProjectName
  if (typeof window !== 'undefined') window.localStorage.setItem(storageKey, value)
  return value
}

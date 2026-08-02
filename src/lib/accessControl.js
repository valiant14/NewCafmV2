const pagePermissionAliases = {
  Overview: ['Overview', 'Reports'],
  'Job Requests': ['Job Requests'],
  'Work Orders': ['Work Orders'],
  'Preventive Maintenance': ['Preventive Maintenance', 'PM'],
  Incidents: ['Incidents'],
  'Job Plans': ['Job Plans', 'PM'],
  Assets: ['Assets'],
  Labor: ['Labor', 'Work Orders'],
  Locations: ['Locations', 'Assets'],
  'Failure Library': ['Failure Library', 'Reports'],
  Meters: ['Meters', 'Reports'],
  Materials: ['Materials', 'Inventory'],
  Stores: ['Stores', 'Inventory'],
  'Tools & Equipment': ['Tools & Equipment', 'Inventory'],
  Reservations: ['Reservations', 'Inventory'],
  'Purchase Requisitions': ['Purchase Requisitions', 'Inventory'],
  'Purchase Orders': ['Purchase Orders', 'Inventory'],
  Users: ['Users', 'Administration'],
  'Roles & Permissions': ['Roles & Permissions', 'Administration'],
  Settings: ['Settings', 'Administration']
}

export const siteCodeFromScope = value => {
  const site = String(value || '').trim()
  if (!site || /^all sites$/i.test(site)) return ''
  return site.split('/').pop().trim()
}

export const siteCodesFromScope = value => {
  const site = String(value || '').trim()
  if (!site || /^all sites$/i.test(site)) return []
  if (site.split(/[,;|]+/).some(part => /^all sites$/i.test(part.trim()))) return []
  return site
    .split(/[,;|]+/)
    .map(part => siteCodeFromScope(part))
    .filter(Boolean)
}

export const siteCodesForUser = user => siteCodesFromScope(user?.siteScope || user?.site)

export const canViewPage = (user, pageName) => {
  if (!user) return false
  const allowed = user.permissions?.view || []
  const aliases = pagePermissionAliases[pageName] || [pageName]
  return aliases.some(alias => allowed.includes(alias))
}

const valueFromKeys = (row, keys = []) => {
  for (const key of keys) {
    const value = row?.[key]
    if (value !== undefined && value !== null && String(value).trim() !== '') return String(value).trim()
  }
  return ''
}

export const canViewSite = (user, site) => {
  const scope = siteCodesForUser(user)
  if (!scope.length) return true
  const rowSite = siteCodeFromScope(site) || String(site || '').trim()
  return !rowSite || scope.includes(rowSite)
}

export const scopeRowsForUser = (rows = [], user, siteKeys = ['site', 'SITE']) =>
  rows.filter(row => canViewSite(user, valueFromKeys(row, siteKeys)))

export const filterNavigationForUser = (navigationItems, user) =>
  navigationItems.filter(item => canViewPage(user, item.name))

export const firstAllowedPage = (navigationItems, user) =>
  filterNavigationForUser(navigationItems, user)[0]?.name || ''

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

export const canViewPage = (user, pageName) => {
  if (!user) return false
  const allowed = user.permissions?.view || []
  const aliases = pagePermissionAliases[pageName] || [pageName]
  return aliases.some(alias => allowed.includes(alias))
}

export const filterNavigationForUser = (navigationItems, user) =>
  navigationItems.filter(item => canViewPage(user, item.name))

export const firstAllowedPage = (navigationItems, user) =>
  filterNavigationForUser(navigationItems, user)[0]?.name || ''

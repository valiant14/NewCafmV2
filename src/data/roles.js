export const permissionModules = [
  'Overview',
  'Job Requests',
  'Work Orders',
  'Preventive Maintenance',
  'Incidents',
  'Job Plans',
  'Assets',
  'Labor',
  'Locations',
  'Failure Library',
  'Meters',
  'Materials',
  'Stores',
  'Tools & Equipment',
  'Reservations',
  'Purchase Requisitions',
  'Purchase Orders',
  'Users',
  'Roles & Permissions',
  'Sites',
  'Departments',
  'Settings'
]
export const permissionActions = ['view', 'create', 'edit', 'approve', 'close', 'import']

const allModules = permissionModules
const supervisorModules = ['Overview', 'Work Orders', 'Preventive Maintenance', 'Job Plans', 'Assets', 'Materials', 'Stores', 'Tools & Equipment', 'Reservations', 'Purchase Requisitions', 'Purchase Orders', 'Meters']

export const rolePermissionRows = [
  {
    role: 'Facility Manager',
    user: 'Ahmed Faisal',
    site: 'All Sites',
    department: 'All Departments',
    scope: 'Full CMMS access',
    status: 'Active',
    permissions: {
      view: allModules,
      create: allModules,
      edit: allModules,
      approve: allModules,
      close: allModules,
      import: allModules
    }
  },
  {
    role: 'HVAC Supervisor',
    user: 'HVAC Lead',
    site: 'Riyadh / 1031',
    department: 'HVAC',
    scope: 'Manage HVAC work orders and PM schedules',
    status: 'Active',
    permissions: {
      view: supervisorModules,
      create: ['Work Orders', 'Preventive Maintenance', 'Job Plans', 'Purchase Requisitions', 'Reservations'],
      edit: ['Work Orders', 'Preventive Maintenance', 'Job Plans', 'Materials', 'Stores', 'Tools & Equipment', 'Reservations'],
      approve: ['Work Orders'],
      close: ['Work Orders'],
      import: ['Preventive Maintenance', 'Materials', 'Tools & Equipment']
    }
  },
  {
    role: 'Civil Technician',
    user: 'Civil Team',
    site: 'Riyadh / 1031',
    department: 'Civil',
    scope: 'View assigned work orders and enter actuals',
    status: 'Draft',
    permissions: {
      view: ['Work Orders', 'Assets'],
      create: [],
      edit: ['Work Orders'],
      approve: [],
      close: [],
      import: []
    }
  }
]

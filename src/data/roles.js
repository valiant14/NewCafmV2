export const permissionModules = ['Job Requests', 'Work Orders', 'PM', 'Assets', 'Inventory', 'Incidents', 'Reports']
export const permissionActions = ['view', 'create', 'edit', 'approve', 'close', 'import']

export const rolePermissionRows = [
  {
    role: 'Facility Manager',
    user: 'Ahmed Faisal',
    site: 'All Sites',
    department: 'All Departments',
    scope: 'Full CMMS access',
    status: 'Active',
    permissions: {
      view: permissionModules,
      create: permissionModules,
      edit: permissionModules,
      approve: permissionModules,
      close: permissionModules,
      import: permissionModules
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
      view: ['Work Orders', 'PM', 'Assets', 'Inventory', 'Reports'],
      create: ['Work Orders', 'PM'],
      edit: ['Work Orders', 'PM'],
      approve: ['Work Orders'],
      close: ['Work Orders'],
      import: ['PM']
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

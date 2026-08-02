import departments from './departments.json'
import crafts from './crafts.json'
import inventory from './inventory.json'
import jobPlans from './jobPlans.json'
import labor from './labor.json'
import locationsMaster from './locations.json'
import materials from './materials.json'
import pmSchedules from './pmSchedules.json'
import storerooms from './storerooms.json'
import tools from './tools.json'
import users from './users.json'
import codingStructure from './codingStructure.json'
import workOrderSeeds from './workOrderSeeds'
import { laborWorkMap } from './laborWorkMap'
import { materialUsageMap } from './materialUsageMap'
import { toolUsageMap } from './toolUsageMap'
import { seedMeters } from './meters'
import { incidentSeed } from './incidents'
import { serviceRequestSeed } from './serviceRequests'
import {
  assets,
  excelDate,
  excelToDate,
  failureClassOptions,
  failureCodes,
  jobTasks,
  locations,
  pmRecords,
  rowsToObjects,
  slaBreached,
  statusMatrix,
  toDateTimeInput,
  uniqueCodeOptions,
  workOrders
} from './cafmData'
import { permissionActions, permissionModules, rolePermissionRows } from './roles'

export const mockData = {
  assets,
  codingStructure,
  crafts,
  departments,
  failureCodes,
  incidentSeed,
  inventory,
  jobPlans,
  jobTasks,
  labor,
  laborWorkMap,
  locations,
  locationsMaster,
  materials,
  materialUsageMap,
  meters: seedMeters,
  permissionActions,
  permissionModules,
  pmRecords,
  pmSchedules,
  rolePermissionRows,
  serviceRequestSeed,
  statusMatrix,
  storerooms,
  tools,
  toolUsageMap,
  users,
  workOrderSeeds,
  workOrders
}

export {
  assets,
  codingStructure,
  crafts,
  departments,
  excelDate,
  excelToDate,
  failureClassOptions,
  failureCodes,
  incidentSeed,
  inventory,
  jobPlans,
  jobTasks,
  labor,
  laborWorkMap,
  locations,
  locationsMaster,
  materials,
  materialUsageMap,
  permissionActions,
  permissionModules,
  pmRecords,
  pmSchedules,
  rolePermissionRows,
  rowsToObjects,
  serviceRequestSeed,
  seedMeters,
  slaBreached,
  statusMatrix,
  storerooms,
  toDateTimeInput,
  tools,
  toolUsageMap,
  uniqueCodeOptions,
  users,
  workOrderSeeds,
  workOrders
}

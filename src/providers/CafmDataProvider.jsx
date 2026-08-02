import { createContext, useContext, useMemo, useState } from 'react'
import departments from '../data/departments.json'
import laborSeed from '../data/labor.json'
import locationSeed from '../data/locations.json'
import materialSeed from '../data/materials.json'
import pmSeed from '../data/pmSchedules.json'
import toolSeed from '../data/tools.json'
import userSeed from '../data/users.json'
import { incidentSeed } from '../data/incidents'
import { serviceRequestSeed } from '../data/serviceRequests'
import { assets as assetSeed, excelDate, failureClassOptions, failureCodes, jobTasks, locations as workbookLocations, pmRecords, slaBreached, statusMatrix, toDateTimeInput, uniqueCodeOptions, workOrders as workOrderSeed } from '../data/cafmData'
import { assetFromMaster, getWorkOrderJobPlan, maximoWorkOrderStatusDescriptions, taskToPlanRow, toLocationPriority } from '../lib/workOrderUtils.jsx'
import { statusDescription } from '../lib/statusMatrix'

const CafmDataContext = createContext(null)

const todayStamp = () => new Date().toISOString().slice(0, 10)

const normalizeLocationPriority = value => {
  const priority = Number(String(value || '').trim())
  return ['1', '2', '3'].includes(String(priority)) ? String(priority) : '3'
}

const normalizeLocationRow = row => ({
  location: row.location || row['location '] || '',
  description: row.description || row['description '] || '',
  type: row.type || 'Room',
  status: row.status || row['status '] || 'OPERATING',
  priority: normalizeLocationPriority(row.priority),
  'priority  description': row['priority  description'] || '',
  site: String(row.site || ''),
  builiding: row.builiding || row.building || '',
  'builiding category': row['builiding category'] || row['building category'] || '',
  department: row.department || ''
})

const seedMeters = (assets = [], workOrders = []) => {
  const assetMeters = assets.slice(0, 6).map((asset, index) => ({
    meterId: `MTR-${String(index + 1).padStart(4, '0')}`,
    asset: asset.assetnum,
    location: asset.location,
    site: String(asset.site || '1031'),
    department: asset.department || asset['sub department'] || 'Facilities',
    meterType: index % 2 ? 'Water' : 'Energy',
    reading: String(1200 + index * 145),
    unit: index % 2 ? 'm³' : 'kWh',
    readingDate: `2026-07-${String(10 + index).padStart(2, '0')}`,
    status: 'Active'
  }))
  const workOrderMeters = workOrders
    .filter(order => order['METER READING'])
    .map((order, index) => ({
      meterId: `WO-MTR-${order.WORKORDER || index + 1}`,
      asset: order.ASSET || '',
      location: order['LOCATION '] || '',
      site: String(order.SITE || ''),
      department: order['DEPARTMENT '] || '',
      meterType: 'General',
      reading: order['METER READING'],
      unit: '',
      readingDate: order['METER READING DATE'] || '',
      status: 'Active'
    }))
  return [...assetMeters, ...workOrderMeters]
}

export function CafmDataProvider({ children }) {
  const [assets, setAssets] = useState(assetSeed)
  const [workOrders, setWorkOrders] = useState(workOrderSeed)
  const [serviceRequests, setServiceRequests] = useState(serviceRequestSeed)
  const [labor, setLabor] = useState(laborSeed)
  const [materials, setMaterials] = useState(materialSeed)
  const [tools, setTools] = useState(toolSeed)
  const [locations, setLocations] = useState(() => (workbookLocations?.length ? workbookLocations : locationSeed).map(normalizeLocationRow))
  const [pmSchedules, setPmSchedules] = useState(pmSeed)
  const [meters, setMeters] = useState(() => seedMeters(assetSeed, workOrderSeed))
  const [incidents, setIncidents] = useState(incidentSeed)
  const [users, setUsers] = useState(userSeed)
  const [jobTaskRecords, setJobTaskRecords] = useState(jobTasks.map(task => ({ ...task, status: task.status || 'ACTIVE' })))
  const [purchaseRequests, setPurchaseRequests] = useState([])
  const [purchaseOrders, setPurchaseOrders] = useState([])
  const [reservations, setReservations] = useState([])

  const updateAsset = (assetnum, patch) => setAssets(rows => rows.map(row => row.assetnum === assetnum ? { ...row, ...patch } : row))
  const updateLocation = (locationId, patch) => setLocations(rows => rows.map(row => row.location === locationId ? { ...row, ...patch } : row))
  const updateLabor = (personId, patch) => setLabor(rows => rows.map(row => row.personId === personId ? { ...row, ...patch } : row))
  const updateMaterial = (itemNumber, patch) => setMaterials(rows => rows.map(row => row.itemNumber === itemNumber ? { ...row, ...patch } : row))
  const updateTool = (toolNumber, patch) => setTools(rows => rows.map(row => row.toolNumber === toolNumber ? { ...row, ...patch } : row))
  const updateMeter = (meterId, patch) => setMeters(rows => rows.map(row => row.meterId === meterId ? { ...row, ...patch } : row))
  const updateIncident = (incidentNumber, patch) => setIncidents(rows => rows.map(row => row.incidentNumber === incidentNumber ? { ...row, ...patch } : row))
  const updateUser = (userId, patch) => setUsers(rows => rows.map(row => row.userId === userId ? { ...row, ...patch } : row))

  const updateJobPlan = (reference, patch) => setJobTaskRecords(rows => rows.map(row => row.JPNUM === reference ? { ...row, ...patch } : row))
  const updateWorkOrder = (number, patch) => setWorkOrders(rows => rows.map(order => String(order.WORKORDER) === String(number) ? { ...order, ...patch } : order))

  const createWorkOrder = form => {
    const next = Math.max(...workOrders.map(order => Number(order.WORKORDER) || 0), 56545134) + 1
    const created = {
      WORKORDER: String(next),
      'DESCRIPITION ': form.description,
      'LOCATION ': form.location,
      'LOCATION PRIORTY': toLocationPriority(form.priority),
      ASSET: form.asset,
      STATUS: 'WAPPR',
      'WORK TYPE ': form.type,
      'STATUS DESCRIPITION': 'Waiting for Approval',
      'DEPARTMENT ': '',
      'SUB DEPARTMENT  NAME': '',
      PRIORTY: Number(String(form.priority).charAt(0)) || 3,
      SITE: form.site,
      'TARGET START ': null,
      'TARGET FINISH ': null
    }
    setWorkOrders(rows => [...rows, created])
    return created
  }

  const convertRequest = request => {
    const number = String(56545135 + workOrders.filter(order => String(order.WORKORDER).startsWith('56545')).length - 3)
    const cm = {
      WORKORDER: number,
      'DESCRIPITION ': request.description,
      'LOCATION ': request.location,
      'LOCATION PRIORTY': toLocationPriority(request.priority),
      ASSET: request.asset || 'Unassigned',
      STATUS: 'WAPPR',
      'WORK TYPE ': 'CM',
      'STATUS DESCRIPITION': 'Waiting for Approval',
      'DEPARTMENT ': request.assignedDepartment || request.department,
      'SUB DEPARTMENT  NAME': request.subDepartment || '',
      PRIORTY: request.priority === 'Emergency' ? 1 : request.priority === 'High' ? 2 : 3,
      SITE: request.site,
      'TARGET START ': null,
      'TARGET FINISH ': null,
      'SOURCE SR': request.sr,
      'FAILURE CODE': request.failureCode || '',
      'PROBLEM CODE': request.problemCode || '',
      'CAUSE CODE': request.causeCode || '',
      'REMEDY CODE': request.remedyCode || ''
    }
    setWorkOrders(rows => rows.some(order => order['SOURCE SR'] === request.sr) ? rows : [...rows, cm])
    return cm
  }

  const generatePmWorkOrder = (pm, tasks) => setWorkOrders(rows => {
    if (rows.some(order => order['PM NUMBER'] === pm.pmNumber && order['PM CYCLE'] === pm.cycle)) return rows
    const assetRecord = assetFromMaster(pm.asset, assets)
    const inheritedLocation = pm.location || assetRecord?.location || ''
    const inheritedSite = pm.site || assetRecord?.site || '1031'
    return [...rows, {
      WORKORDER: pm.workOrder,
      'DESCRIPITION ': pm.description,
      'LOCATION ': inheritedLocation,
      'LOCATION PRIORTY': 3,
      ASSET: pm.asset,
      'ASSET DESCRIPTION': assetRecord?.description?.trim() || '',
      STATUS: pm.woStatus || 'WSCH',
      'WORK TYPE ': 'PM',
      'STATUS DESCRIPITION': maximoWorkOrderStatusDescriptions[pm.woStatus || 'WSCH'] || 'Waiting for Schedule',
      'DEPARTMENT ': pm.department,
      'SUB DEPARTMENT  NAME': pm.subDepartment,
      'ASSIGNED DEPARTMENT': pm.department,
      PRIORTY: 3,
      SITE: inheritedSite,
      'TARGET START ': pm.startDate,
      'TARGET FINISH ': pm.startDate,
      'PM NUMBER': pm.pmNumber,
      'PM CYCLE': pm.cycle,
      'JOB PLAN': pm.jobPlan,
      'JOB PLAN TASKS': tasks,
      'ESTIMATED DURATION': tasks.map(taskToPlanRow).reduce((sum, task) => sum + Number(task.duration || 0), 0),
      ROUTE: pm.route,
      'LEAD TIME (DAYS)': pm.leadTime,
      FREQUENCY: pm.frequency,
      FREQUNIT: pm.freqUnit,
      PMCOUNTER: pm.pmCounter,
      STORELOC: pm.storeLocation,
      SUPERVISOR: pm.supervisor,
      LEAD: pm.lead,
      PERSONGROUP: pm.personGroup,
      'PM STATUS': pm.pmStatus
    }]
  })

  const createPurchaseRequest = record => {
    const existing = purchaseRequests.find(row => row.workOrder === record.workOrder && row.item === record.item)
    if (existing) return existing
    const created = { purchaseRequest: `PR-2026-${String(purchaseRequests.length + 1).padStart(4, '0')}`, status: 'WAPPR', statusDescription: statusDescription('purchaseRequisition', 'WAPPR'), createdAt: todayStamp(), ...record }
    setPurchaseRequests(rows => rows.some(row => row.workOrder === created.workOrder && row.item === created.item) ? rows : [created, ...rows])
    return created
  }

  const createPurchaseOrderFromRequest = request => {
    const existing = purchaseOrders.find(order => order.purchaseRequest === request.purchaseRequest)
    if (existing) return existing
    const created = { purchaseOrder: `PO-2026-${String(purchaseOrders.length + 1).padStart(4, '0')}`, purchaseRequest: request.purchaseRequest, workOrder: request.workOrder, type: request.type, item: request.item, quantity: request.quantity, source: request.source, site: request.site, department: request.department, status: 'WAPPR', statusDescription: statusDescription('purchaseOrder', 'WAPPR'), createdAt: todayStamp() }
    setPurchaseOrders(rows => rows.some(order => order.purchaseRequest === request.purchaseRequest) ? rows : [created, ...rows])
    setPurchaseRequests(rows => rows.map(row => row.purchaseRequest === request.purchaseRequest ? { ...row, status: 'APPR', statusDescription: statusDescription('purchaseRequisition', 'APPR'), purchaseOrder: created.purchaseOrder, approvedAt: todayStamp() } : row))
    return created
  }

  const createReservation = record => {
    const existing = reservations.find(row => row.workOrder === record.workOrder && row.item === record.item && row.status === record.status)
    if (existing) return existing
    const prefix = record.type === 'Material' ? 'RSV' : 'ALC'
    const created = { reservation: `${prefix}-2026-${String(reservations.length + 1).padStart(4, '0')}`, status: 'ENTERED', statusDescription: statusDescription('inventoryUsage', 'ENTERED'), createdAt: todayStamp(), arrangedQuantity: 0, releasedQuantity: 0, deliveredQuantity: 0, ...record }
    setReservations(rows => rows.some(row => row.workOrder === created.workOrder && row.item === created.item && row.status === created.status) ? rows : [created, ...rows])
    return created
  }

  const value = useMemo(() => ({
    assets, setAssets, updateAsset,
    workOrders, setWorkOrders, updateWorkOrder, createWorkOrder,
    serviceRequests, setServiceRequests, convertRequest,
    labor, setLabor, updateLabor,
    materials, setMaterials, updateMaterial,
    tools, setTools, updateTool,
    locations, setLocations, updateLocation,
    pmSchedules, setPmSchedules, generatePmWorkOrder,
    meters, setMeters, updateMeter,
    incidents, setIncidents, updateIncident,
    users, setUsers, updateUser,
    jobTasks,
    jobTaskRecords, setJobTaskRecords, updateJobPlan,
    failureCodes, failureClassOptions, uniqueCodeOptions,
    statusMatrix, pmRecords, departments, excelDate, toDateTimeInput, slaBreached,
    purchaseRequests, setPurchaseRequests,
    purchaseOrders, setPurchaseOrders,
    reservations, setReservations,
    createPurchaseRequest,
    createPurchaseOrderFromRequest,
    createReservation,
    updatePurchaseRequest: (reference, patch) => setPurchaseRequests(rows => rows.map(row => row.purchaseRequest === reference ? { ...row, ...patch, statusDescription: patch.status ? statusDescription('purchaseRequisition', patch.status) : row.statusDescription } : row)),
    updatePurchaseOrder: (reference, patch) => setPurchaseOrders(rows => rows.map(row => row.purchaseOrder === reference ? { ...row, ...patch, statusDescription: patch.status ? statusDescription('purchaseOrder', patch.status) : row.statusDescription } : row)),
    updateReservation: (reference, patch) => setReservations(rows => rows.map(row => row.reservation === reference ? { ...row, ...patch } : row))
  }), [assets, workOrders, serviceRequests, labor, materials, tools, locations, pmSchedules, meters, incidents, users, jobTaskRecords, purchaseRequests, purchaseOrders, reservations])

  return <CafmDataContext.Provider value={value}>{children}</CafmDataContext.Provider>
}

export function useCafmData() {
  const context = useContext(CafmDataContext)
  if (!context) throw new Error('useCafmData must be used inside CafmDataProvider')
  return context
}

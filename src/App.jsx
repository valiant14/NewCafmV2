import { useEffect, useMemo, useRef, useState } from 'react'
import departments from './data/departments.json'
import jobPlanSeed from './data/jobPlans.json'
import laborMaster from './data/labor.json'
import materialMaster from './data/materials.json'
import toolMaster from './data/tools.json'
import ServiceRequestsPage from './pages/ServiceRequestsPage'
import WorkOrdersPage from './pages/WorkOrdersPage'
import LaborPage from './pages/LaborPage'
import MaterialsPage from './pages/MaterialsPage'
import StoresPage from './pages/StoresPage'
import ToolsPage from './pages/ToolsPage'
import PreventiveMaintenancePage from './pages/PreventiveMaintenancePage'
import AssetsPage from './pages/AssetsPage'
import RegisterPage from './pages/RegisterPage'
import LocationsPage from './pages/LocationsPage'
import OverviewPage from './pages/OverviewPage'
import SettingsPage from './pages/SettingsPage'
import IncidentsPage from './pages/IncidentsPage'
import RolesPermissionsPage from './pages/RolesPermissionsPage'
import MetersPage from './pages/MetersPage'
import LoginPage from './pages/LoginPage'
import PurchaseRequestsPage from './pages/PurchaseRequestsPage'
import PurchaseOrdersPage from './pages/PurchaseOrdersPage'
import ReservationsPage from './pages/ReservationsPage'
import UsersPage from './pages/UsersPage'
import AppShell from './components/layout/AppShell'
import JobPlanDetailPage from './components/job-plans/JobPlanDetailPage'
import FailureLibraryDetailPage from './components/failure-library/FailureLibraryDetailPage'
import WorkOrderDocumentsTab from './components/work-orders/WorkOrderDocumentsTab'
import WorkOrderPrintReport from './components/work-orders/WorkOrderPrintReport'
import WorkOrderPlanTab from './components/work-orders/WorkOrderPlanTab'
import WorkOrderActualTab from './components/work-orders/WorkOrderActualTab'
import WorkOrderFailureTab from './components/work-orders/WorkOrderFailureTab'
import WorkOrderMaterialRequestsTab from './components/work-orders/WorkOrderMaterialRequestsTab'
import WorkOrderOverviewTab from './components/work-orders/WorkOrderOverviewTab'
import WorkOrderMetersTab from './components/work-orders/WorkOrderMetersTab'
import WorkOrderHeader, { workOrderOutlineButtonClass, workOrderPrimaryButtonClass } from './components/work-orders/WorkOrderHeader'
import WorkOrderTabs from './components/work-orders/WorkOrderTabs'
import { navigationItems, pathForPage, routeToPage } from './config/navigation'
import { assets, workOrders, pmRecords, jobTasks, failureCodes, locations, statusMatrix, failureClassOptions, uniqueCodeOptions, excelDate, toDateTimeInput, slaBreached } from './data/cafmData'
import { incidentSeed } from './data/incidents'
import { serviceRequestSeed } from './data/serviceRequests'
import workOrderSeeds from './data/workOrderSeeds'
import { useAuth } from './providers/AuthProvider'
import { nowLocalDate, nowLocalDateTime } from './lib/datetime'
import { printWithoutBrowserTitle } from './lib/print'
import { systemNamesForDepartment, workGroupsForDepartment } from './lib/departments'
import { storeLabel, storesHolding, totalAvailable } from './lib/inventory'
import { readProjectName, writeProjectName } from './lib/projectSettings'
import { canTransitionWorkOrder, statusDescription, statusOptions, workOrderTransitions } from './lib/statusMatrix'
import { HOLD_MATERIAL, effectiveTargetTime, endHold, holdSince, isOnHold, startHold } from './lib/holdPeriods'


const buildWorkOrderNotifications = rows => {
  const now = Date.now()
  const upcomingWindow = now + 30 * 24 * 60 * 60 * 1000
  return rows
    .map(order => {
      const target = toDateTimeInput(order['TARGET FINISH ']) || toDateTimeInput(order['TARGET START '])
      const rawDue = target ? new Date(target).getTime() : null
      if (!rawDue) return null
      const closed = ['COMP', 'COMPLETED', 'CLOSE', 'CLOSED'].includes(String(order.STATUS || '').toUpperCase())
      if (closed) return null
      // A job waiting on stock is not late - its clock is stopped, so it is reported as
      // paused rather than counted against the SLA.
      if (isOnHold(order)) return {
        type: 'paused',
        workOrder: order.WORKORDER,
        description: order['DESCRIPITION '] || order.DESCRIPTION || 'Work order',
        message: `SLA Paused – awaiting material since ${new Date(holdSince(order)).toLocaleString()}.`
      }
      // Time already spent on hold is given back before judging lateness.
      const due = effectiveTargetTime(rawDue, order, now)
      if (due < now) return {
        type: 'overdue',
        workOrder: order.WORKORDER,
        description: order['DESCRIPITION '] || order.DESCRIPTION || 'Work order',
        message: `Target date passed on ${new Date(due).toLocaleString()}. SLA Met? No – SLA Breached.`
      }
      if (due <= upcomingWindow) return {
        type: 'upcoming',
        workOrder: order.WORKORDER,
        description: order['DESCRIPITION '] || order.DESCRIPTION || 'Work order',
        message: `Target date is ${new Date(due).toLocaleString()}.`
      }
      return null
    })
    .filter(Boolean)
}


const workOrderTabs = ['Overview', 'Plan', 'Failure', 'Material Requests', 'PTW & Files', 'Meters', 'Actual']
const workOrderBodyClass = 'grid gap-3 p-0'
const toLocationPriority = value => {
  const text = String(value || '').trim()
  if (text.startsWith('1') || text === 'Emergency') return 1
  if (text.startsWith('2') || text === 'High') return 2
  return 3
}
const maximoWorkOrderStatusDescriptions = new Proxy({}, { get: (_, status) => statusDescription('workOrder', status) })
const cleanText = value => String(value ?? '').trim()
const normalizeWoStatus = value => {
  const status = cleanText(value).toUpperCase()
  return statusOptions('workOrder').includes(status) ? status : 'WAPPR'
}
const getWorkOrderJobPlan = order => cleanText(order['JOB PLAN'] || order.JPNUM || order.JPNUMBER || order['JOP PLAN '] || order['JOP PLAN'] || order.jobPlan)
const taskToPlanRow = (task, index = 0) => ({
  sequence: task.sequence ?? task['JOB TASK SEQUENCE'] ?? task.SEQUENCE ?? index + 1,
  description: task.description ?? task['JOB TASK DESCRIPTION'] ?? task.DESCRIPTION ?? '',
  duration: task.duration ?? Math.max(5, Math.round(Number(task['TASK DURATION IN HOUR'] || 0) * 1440))
})
const assetFromMaster = (assetNumber, masterAssets = []) => masterAssets.find(asset => cleanText(asset.assetnum) === cleanText(assetNumber))
const assetDescriptionFromMaster = (assetNumber, masterAssets = []) => masterAssets.find(asset => cleanText(asset.assetnum) === cleanText(assetNumber))?.description?.trim() || ''

function WorkOrderWorkflowNotice({ status, missing = [], nextStep }) {
  const clear = missing.length === 0
  return (
    <section className={`rounded-2xl border px-4 py-3 ${clear ? 'border-[var(--app-line)] bg-[var(--app-badge-green-bg)] text-[var(--app-badge-green-text)]' : 'border-[var(--app-badge-orange-text)]/20 bg-[var(--app-badge-orange-bg)] text-[var(--app-badge-orange-text)]'}`}>
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0">
          <p className="text-[9px] font-extrabold uppercase tracking-[.16em] opacity-80">Workflow guidance</p>
          <h3 className="mt-1 text-sm font-extrabold">{clear ? 'Ready for the next workflow action' : 'Update needed before the next workflow action'}</h3>
          <div className="mt-2 flex flex-wrap gap-2">
            {clear ? (
              <span className="rounded-full bg-[color-mix(in_srgb,var(--app-panel)_70%,transparent)] px-2.5 py-1 text-[10px] font-bold">No blocking fields</span>
            ) : missing.map(item => (
              <span className="rounded-full bg-[color-mix(in_srgb,var(--app-panel)_70%,transparent)] px-2.5 py-1 text-[10px] font-bold" key={item}>{item}</span>
            ))}
          </div>
        </div>
        <div className="rounded-xl bg-[color-mix(in_srgb,var(--app-panel)_70%,transparent)] px-3 py-2 text-xs">
          <span className="block text-[9px] font-extrabold uppercase tracking-[.14em] opacity-70">Current status</span>
          <strong>{status}</strong>
          <span className="mx-2 opacity-50">·</span>
          <span>{nextStep}</span>
        </div>
      </div>
    </section>
  )
}

function WorkOrderEditor({ order, onClose, page = false, projectName, initialTab, onCreatePurchaseRequest, onCreateReservation, onUpdateWorkOrder }) {
  const { user } = useAuth()
  // Pausing the SLA clock is an administrative decision, so the hold controls belong to
  // the Facility Manager rather than to whoever is executing the job.
  const canManageHold = user?.role === 'Facility Manager'
  const workType=(order['WORK TYPE'] || order['WORK TYPE '] || order['WORK TYPE  '] || 'CM').trim()
  const isPM = workType === 'PM'
  const isCM = workType === 'CM'
  const [tab, setTab] = useState(workOrderTabs.includes(initialTab) ? initialTab : 'Overview')
  const [autoSaveState,setAutoSaveState]=useState('Saved')
  const saveReady = useRef(false)
  const [selectedStatus,setSelectedStatus]=useState(normalizeWoStatus(order.STATUS))
  const [heldFrom,setHeldFrom]=useState(order['HELD FROM']||'')
  const [holdPeriods,setHoldPeriods]=useState(Array.isArray(order.holdPeriods)?order.holdPeriods:[])
  // The editor seeds its state from `order` once, but the parent swaps that object
  // whenever the stored work order changes - Save, or the hold/resume buttons. Keyed on
  // the stored STATUS so it re-syncs on those, and never stomps an unsaved selection made
  // in the status dropdown (which does not change the stored order).
  useEffect(()=>{
    setSelectedStatus(normalizeWoStatus(order.STATUS))
    setHeldFrom(order['HELD FROM']||'')
    setHoldPeriods(Array.isArray(order.holdPeriods)?order.holdPeriods:[])
  },[order.WORKORDER,order.STATUS])
  const [workCompleted,setWorkCompleted]=useState(['COMP','COMPLETED','CLOSE','CLOSED'].includes(String(order.STATUS||'').toUpperCase()))
  const [workClosed,setWorkClosed]=useState(['CLOSE','CLOSED'].includes(String(order.STATUS||'').toUpperCase()))
  const [workStarted,setWorkStarted]=useState(['INPRG','COMP','COMPLETED','CLOSE','CLOSED'].includes(String(order.STATUS||'').toUpperCase()))
  const [workApproved,setWorkApproved]=useState(['APPR','WSCH','SCHED','INPRG','COMP','COMPLETED','CLOSE','CLOSED'].includes(String(order.STATUS||'').toUpperCase()))
  const [workWaitingSchedule,setWorkWaitingSchedule]=useState(['WSCH','SCHED','INPRG','COMP','COMPLETED','CLOSE','CLOSED'].includes(String(order.STATUS||'').toUpperCase()))
  const [workScheduled,setWorkScheduled]=useState(['SCHED','INPRG','COMP','COMPLETED','CLOSE','CLOSED'].includes(String(order.STATUS||'').toUpperCase()))
  const [description,setDescription]=useState(order['DESCRIPITION ']||'')
  const [longDescription,setLongDescription]=useState(order['LONG DESCRIPTION']||order['LONG DESCRIPTION ']||'')
  const [priority,setPriority]=useState(String(order['PRIORTY']||'2'))
  const [department,setDepartment]=useState(String(order['DEPARTMENT ']||''))
  const [subDepartment,setSubDepartment]=useState(String(order['SUB DEPARTMENT  NAME']||''))
  const [assignedDepartment,setAssignedDepartment]=useState(String(order['DEPARTMENT ']||''))
  const [workGroup,setWorkGroup]=useState(isPM?'C1-HVAC':'')
  const [supervisor,setSupervisor]=useState('')
  const [laborCraft,setLaborCraft]=useState(isPM?'HVAC-TECH':'')
  const [siteValue,setSiteValue]=useState(String(order.SITE||'1031'))
  const [assetValue,setAssetValue]=useState(order.ASSET||'')
  const [assetDescription,setAssetDescription]=useState(assetDescriptionFromMaster(order.ASSET, assets) || order['ASSET DESCRIPTION'] || order['ASSET DESCRIPTION '] || '')
  const [locationValue,setLocationValue]=useState(order['LOCATION '] || assetFromMaster(order.ASSET, assets)?.location || '')
  const [systemValue,setSystemValue]=useState(order['SYSTEM']||assetFromMaster(order.ASSET, assets)?.system||'')
  const [failureClass,setFailureClass]=useState(order['FAILURE CODE']||'')
  const [problemCode,setProblemCode]=useState(order['PROBLEM CODE']||'')
  const [causeCode,setCauseCode]=useState(order['CAUSE CODE']||'')
  const [remedyCode,setRemedyCode]=useState(order['REMEDY CODE']||'')
  const jobPlanNumber = getWorkOrderJobPlan(order)
  const jobPlanTaskRows = order['JOB PLAN TASKS']?.length ? order['JOB PLAN TASKS'] : jobPlanNumber ? jobTasks.filter(task => cleanText(task.JPNUM) === jobPlanNumber) : []
  // saveChanges writes these back onto the order, so reopening a saved work order must
  // read them again - otherwise planned rows silently vanish on every revisit.
  const [plannedLabor,setPlannedLabor]=useState(order['PLANNED LABOR']?.length?order['PLANNED LABOR']:isPM?[{craft:'HVAC Technician',hours:'2',crew:'HVAC Team A'}]:[{craft:'',hours:'',crew:''}])
  const [plannedResources,setPlannedResources]=useState(order['PLANNED RESOURCES']?.length?order['PLANNED RESOURCES']:[])
  const [plannedTasks,setPlannedTasks]=useState(isPM?jobPlanTaskRows.map(taskToPlanRow):[{sequence:10,description:'',duration:''}])
  const tasksFromJobPlan=isPM&&jobPlanTaskRows.length>0
  // Written by convertRequest but, until now, never read anywhere except its own dedupe guard.
  const sourceRequest=order['SOURCE SR']?{sr:order['SOURCE SR'],reportedBy:order['REPORTED BY']||'',reportedDate:toDateTimeInput(order['REPORTED DATE '])||'',priority:order['SOURCE SR PRIORITY']||'',requestType:order['SOURCE SR TYPE']||''}:null
  const [ptwRequired,setPtwRequired]=useState(Boolean(order['PTW REQUIRED']))
  const [ptwFiles,setPtwFiles]=useState(order['PTW FILES']||[])
  const [generalFiles,setGeneralFiles]=useState(order['GENERAL FILES']||[{name:'site-inspection-photo.jpg',size:'1.8 MB',type:'Image'}])
  const [technicianRemarks,setTechnicianRemarks]=useState(order['TECHNICIAN REMARKS']||'')
  const [completionNotes,setCompletionNotes]=useState(order['COMPLETION NOTES']||'')
  const [actualLabor,setActualLabor]=useState(order['ACTUAL LABOR']||'')
  const [actualHours,setActualHours]=useState(order['ACTUAL HOURS']||'')
  const [actualMaterials,setActualMaterials]=useState(order['ACTUAL MATERIALS']||[])
  const [actualTools,setActualTools]=useState(order['ACTUAL TOOLS']||[])
  const [actualStart,setActualStart]=useState(toDateTimeInput(order['ACTUAL START ']) || '')
  const [actualFinish,setActualFinish]=useState(['COMP','COMPLETED','CLOSE','CLOSED'].includes(String(order.STATUS||'').toUpperCase())?toDateTimeInput(order['ACTUAL FINISH ']) : '')
  const [meterReading,setMeterReading]=useState(order['METER READING']||'')
  const [waterConsumption,setWaterConsumption]=useState(order['WATER CONSUMPTION']||'')
  const [energyConsumption,setEnergyConsumption]=useState(order['ENERGY CONSUMPTION']||'')
  const [meterReadingDate,setMeterReadingDate]=useState(toDateTimeInput(order['METER READING DATE'])||'')
  const [targetStart,setTargetStart]=useState(toDateTimeInput(order['TARGET START ']))
  const [targetFinish,setTargetFinish]=useState(toDateTimeInput(order['TARGET FINISH ']))
  const siteOptions=[...new Set([...assets.map(a=>String(a.site)),...workOrders.map(o=>String(o.SITE))].filter(Boolean))].sort()
  const departmentOptions=departments.map(item=>({value:item.name,label:item.code}))
  const selectedDepartment=departments.find(item=>item.name===department)
  const subDepartmentOptions=(selectedDepartment?.subDepartments||departments.flatMap(item=>item.subDepartments)).map(item=>({value:item.name,label:item.code}))
  const workGroupOptions=workGroupsForDepartment(assignedDepartment)
  const systemOptions=systemNamesForDepartment(department)
  const supervisorOptions=laborMaster.filter(person=>!assignedDepartment||person.department===assignedDepartment).map(person=>({value:person.name,label:`${person.craftCode} · ${person.craft}`}))
  const laborCraftOptions=[...new Map(laborMaster.map(person=>[person.craftCode,{value:person.craftCode,label:person.craft}])).values()]
  const plannedCraftOptions=[...new Map(laborMaster.map(person=>[person.craft,{value:person.craft,label:person.craftCode}])).values()]
  const plannedCrewOptions=laborMaster.map(person=>({value:person.name,label:`${person.personId} · ${person.craft} · ${person.availability}`}))
  const assetsForSite=assets.filter(a=>!siteValue||String(a.site)===siteValue)
  const assetOptions=assetsForSite.map(a=>({value:a.assetnum,label:a.description?.trim()}))
  const locationOptions=[...new Set([...assetsForSite.map(a=>a.location),...workOrders.filter(o=>!siteValue||String(o.SITE)===siteValue).map(o=>o['LOCATION '])].filter(Boolean))].sort()
  const changeSite=e=>{setSiteValue(e.target.value);setAssetValue('');setLocationValue('')}
  const changeAsset=e=>{const value=e.target.value;setAssetValue(value);const match=assets.find(a=>cleanText(a.assetnum)===cleanText(value));setAssetDescription(match?.description?.trim()||'');if(match?.location)setLocationValue(match.location);if(match?.site)setSiteValue(String(match.site));if(match?.system)setSystemValue(current=>current||match.system)}
  const matchingFailures=failureCodes.filter(row=>!failureClass||row['FAILURE CLASS ID']===failureClass)
  const problemOptions=uniqueCodeOptions(matchingFailures,'PROBLEM CODE','PC - DESCRIPTION')
  const selectedProblems=matchingFailures.filter(row=>!problemCode||row['PROBLEM CODE']===problemCode)
  const causeOptions=uniqueCodeOptions(selectedProblems,'CAUSE CODE','CC - DESCRIPTION')
  const remedyOptions=uniqueCodeOptions(selectedProblems.filter(row=>!causeCode||row['CAUSE CODE']===causeCode),'REMEDY CODE','RC - DESCRIPTION')
  const failureDescription=failureCodes.find(row=>row['FAILURE CLASS ID']===failureClass)?.DESCRIPTION||''
  const problemDescription=failureCodes.find(row=>row['FAILURE CLASS ID']===failureClass&&row['PROBLEM CODE']===problemCode)?.['PC - DESCRIPTION']||''
  const causeDescription=failureCodes.find(row=>row['PROBLEM CODE']===problemCode&&row['CAUSE CODE']===causeCode)?.['CC - DESCRIPTION']||''
  const remedyDescription=failureCodes.find(row=>row['PROBLEM CODE']===problemCode&&row['REMEDY CODE']===remedyCode)?.['RC - DESCRIPTION']||''
  const changeFailure=e=>{setFailureClass(e.target.value);setProblemCode('');setCauseCode('');setRemedyCode('')}
  const updatePlanRow=(setter,index,key,value)=>setter(rows=>rows.map((row,rowIndex)=>rowIndex===index?{...row,[key]:value}:row))
  const updateActualRow=(setter,index,value)=>setter(rows=>rows.map((row,rowIndex)=>rowIndex===index?{...row,actualQuantity:value}:row))
  const updatePlannedResource=(index,value)=>setPlannedResources(rows=>rows.map((row,rowIndex)=>rowIndex===index?{...row,item:value,requestStatus:''}:row))
  const updatePlannedResourceField=(index,key,value)=>setPlannedResources(rows=>rows.map((row,rowIndex)=>rowIndex===index?{...row,[key]:value,requestStatus:''}:row))
  const findPlannedInventory = resource => resource.type === 'Material'
    ? materialMaster.find(item => item.description === resource.item || item.itemNumber === resource.item)
    : toolMaster.find(item => item.description === resource.item || item.toolNumber === resource.item)
  const resourceAvailability = resource => {
    const inventory = findPlannedInventory(resource)
    if (!inventory) return { availability: 'Not Found', source: resource.type === 'Material' ? 'Materials master' : 'Tools master' }
    if (resource.type === 'Material') {
      const availableQuantity = totalAvailable(inventory.itemNumber)
      const requestedQuantity = Number(resource.quantity || 0)
      const holding = storesHolding(inventory.itemNumber)
      return {
        availability: requestedQuantity > 0 && availableQuantity >= requestedQuantity ? 'Available' : 'Purchase Required',
        source: holding.length ? holding.map(storeLabel).join(', ') : 'No store holds this item',
        availableQuantity,
        itemNumber: inventory.itemNumber
      }
    }
    const requestedQuantity = Number(resource.quantity || 0)
    const availableQuantity = inventory.status === 'Available' ? Number(inventory.quantity || 0) : 0
    return {
      availability: requestedQuantity > 0 && availableQuantity >= requestedQuantity ? 'Available' : 'Purchase Required',
      source: inventory.location || 'Tool Crib',
      availableQuantity,
      itemNumber: inventory.toolNumber,
      inventoryStatus: inventory.status
    }
  }
  const materialRequests=plannedResources.filter(resource=>resource.type==='Material')
  const resourceRequests=plannedResources.filter(resource=>['Material','Tool','Equipment'].includes(resource.type))
  const materialBlocked=materialRequests.some(resource=>resourceAvailability(resource).availability==='Purchase Required'&&resource.requestStatus!=='WAPPR')
  const ptwBlocked=ptwRequired&&ptwFiles.length===0
  const targetOutOfOrder=Boolean(targetStart&&targetFinish&&new Date(targetFinish)<new Date(targetStart))
  const overviewReady=Boolean(description.trim()&&siteValue&&assetValue&&assetDescription.trim()&&locationValue&&department&&assignedDepartment&&targetStart&&targetFinish&&!targetOutOfOrder)
  const overviewMissing=[!description.trim()&&'Description',!siteValue&&'Site',!assetValue&&'Asset',!assetDescription.trim()&&'Asset Description',!locationValue&&'Location',!department&&'Department',!assignedDepartment&&'Assigned Department',!targetStart&&'Target Start',!targetFinish&&'Target Finish',targetOutOfOrder&&'Target Finish must be on or after Target Start'].filter(Boolean)
  const plannedLaborReady=plannedLabor.some(row=>row.craft&&Number(row.hours)>0)
  const plannedMaterialsReady=plannedResources.some(row=>row.type==='Material'&&row.item&&Number(row.quantity)>0)
  const plannedToolsReady=plannedResources.some(row=>['Tool','Equipment'].includes(row.type)&&row.item&&Number(row.quantity)>0)
  const planReady=Boolean(plannedLaborReady&&(!isCM||(plannedMaterialsReady&&plannedToolsReady)))
  // "if applicable" - only demanded when the failure library holds entries for this problem.
  const causeApplicable=Boolean(isCM&&problemCode&&causeOptions.length)
  const remedyApplicable=Boolean(isCM&&problemCode&&remedyOptions.length)
  const failureReady=Boolean(!isCM||(failureClass&&problemCode&&(!causeApplicable||causeCode)&&(!remedyApplicable||remedyCode)))
  const actualMaterialsReady=!isCM||actualMaterials.some(row=>row.item&&Number(row.actualQuantity)>0)
  const actualToolsReady=!isCM||actualTools.some(row=>row.item&&Number(row.actualQuantity)>0)
  const actualReady=Boolean(technicianRemarks.trim()&&completionNotes.trim()&&actualLabor.trim()&&Number(actualHours)>0&&actualMaterialsReady&&actualToolsReady&&failureReady)
  const preparationReady=overviewReady&&planReady
  const status = selectedStatus
  const changeStatus=value=>{
    const next=normalizeWoStatus(value)
    // The select disables invalid options, but guard here too so no other caller can
    // drive the work order off the workflow.
    if(!canTransitionWorkOrder(selectedStatus,next,heldFrom)) return
    const wasHold=['HOLD',HOLD_MATERIAL].includes(selectedStatus)
    if(['HOLD',HOLD_MATERIAL].includes(next)) setHeldFrom(selectedStatus)
    else if(wasHold) setHeldFrom('')
    // Only the material hold stops the SLA clock, so only it opens a hold period. Going
    // via the status select and via the header buttons must produce the same record.
    if(next===HOLD_MATERIAL) setHoldPeriods(current=>startHold({holdPeriods:current}))
    else if(selectedStatus===HOLD_MATERIAL) setHoldPeriods(current=>endHold({holdPeriods:current}))
    setSelectedStatus(next)
    setWorkApproved(['APPR','WSCH','SCHED','INPRG','COMP','CLOSE'].includes(next))
    setWorkWaitingSchedule(['WSCH','SCHED','INPRG','COMP','CLOSE'].includes(next))
    setWorkScheduled(['SCHED','INPRG','COMP','CLOSE'].includes(next))
    setWorkStarted(['INPRG','COMP','CLOSE'].includes(next))
    setWorkCompleted(['COMP','CLOSE'].includes(next))
    setWorkClosed(next==='CLOSE')
    if(['INPRG','COMP','CLOSE'].includes(next)) setActualStart(current=>current||toDateTimeInput(new Date()))
    if(['COMP','CLOSE'].includes(next)) setActualFinish(current=>current||toDateTimeInput(new Date()))
  }
  const planMissing=[!plannedLaborReady&&'Plan: labor and estimated hours',isCM&&!plannedMaterialsReady&&'Plan: required materials',isCM&&!plannedToolsReady&&'Plan: required tools'].filter(Boolean)
  const failureMissing=[isCM&&!failureClass&&'Failure: failure code',isCM&&!problemCode&&'Failure: problem code',causeApplicable&&!causeCode&&'Failure: cause code',remedyApplicable&&!remedyCode&&'Failure: remedy code'].filter(Boolean)
  const actualMissing=[!technicianRemarks.trim()&&'Actual: technician remarks',!completionNotes.trim()&&'Actual: completion notes',!actualLabor.trim()&&'Actual: labor',!Number(actualHours)&&'Actual: labor hours',!actualMaterialsReady&&'Actual: materials',!actualToolsReady&&'Actual: tools'].filter(Boolean)
  const holdMissing=[materialBlocked&&'Material Requests: create PR or resolve stock',ptwBlocked&&'PTW & Files: attach permit file'].filter(Boolean)
  // What must be true to REACH a given status. Evaluated for each candidate so the
  // header select can disable a transition rather than warn about it afterwards.
  const missingFor=target=>target==='APPR'?[...overviewMissing]
    :target==='WSCH'||target==='SCHED'?[...overviewMissing,...planMissing,...holdMissing]
    :target==='INPRG'?[...overviewMissing,...planMissing,...holdMissing]
    :target==='COMP'?[...failureMissing]
    :target==='CLOSE'?[...actualMissing,...failureMissing]
    :[]
  const workflowMissing=missingFor(status).length?missingFor(status):['HOLD',HOLD_MATERIAL].includes(status)?holdMissing:[]
  const allowedStatuses=workOrderTransitions(status,heldFrom)
  const workflowNextStep={
    WAPPR: overviewReady?'Approving automatically':'Complete Work Order overview fields',
    APPR: preparationReady?'Scheduling automatically':'Complete planning to move into the schedule',
    WSCH: preparationReady?'Scheduling automatically':'Complete overview and plan requirements',
    SCHED: preparationReady?'Start work from the Actual tab':'Complete planning before starting work',
    HOLD: 'Resolve material or permit hold before continuing',
    [HOLD_MATERIAL]: 'SLA is paused. Resume once the material is available',
    INPRG: failureReady?'Resolve / complete from the Actual tab':'Complete failure classification before completion',
    COMP: actualReady?'Close the work order from the Actual tab':'Complete Actual tab before closeout',
    CLOSE: 'Workflow complete'
  }[status] || 'Review the work order'

  // The status select is gone, so the preparation stages advance on their own the moment
  // their entry conditions are met. Only the stages that represent a human act - starting
  // work, completing it, closing it - still wait for a button, and holds are never left
  // automatically because the operator decides when material has actually arrived.
  const autoAdvanceTo=
    status==='WAPPR'&&!missingFor('APPR').length?'APPR'
    :status==='APPR'&&!missingFor('WSCH').length?'WSCH'
    :status==='WSCH'&&!missingFor('SCHED').length?'SCHED'
    :''
  useEffect(()=>{
    if(!autoAdvanceTo) return
    // Deferred a tick so a keystroke that completes the last required field is committed
    // before the status moves underneath the field being typed in.
    const timer=setTimeout(()=>changeStatus(autoAdvanceTo),0)
    return ()=>clearTimeout(timer)
  },[autoAdvanceTo])
  const closeWork=()=>changeStatus('CLOSE')
  const actualsEditable = true
  const number = order.WORKORDER || 'AUTO'
  const rawTargetFinishTime=targetFinish?new Date(targetFinish).getTime():null
  const actualFinishTime=actualFinish?new Date(actualFinish).getTime():null
  const onMaterialHold=status===HOLD_MATERIAL||isOnHold({holdPeriods})
  // The deadline moves forward by whatever time this order has already spent on hold, so
  // waiting on stock never eats into the SLA.
  const targetFinishTime=effectiveTargetTime(rawTargetFinishTime,{holdPeriods})
  const slaBreachedNow=Boolean(!onMaterialHold&&targetFinishTime&&((actualFinishTime&&actualFinishTime>targetFinishTime)||(!actualFinishTime&&Date.now()>targetFinishTime)))
  const slaLabel=onMaterialHold?'SLA Paused'
    :!targetFinishTime?'Not defined'
    :actualFinishTime?(slaBreachedNow?'No – SLA Breached':'Yes – SLA Met')
    :(slaBreachedNow?'No – SLA Breached':'Pending – Within SLA')
  const putOnMaterialHold=()=>{
    const periods=startHold({holdPeriods})
    setHoldPeriods(periods); setHeldFrom(status); setSelectedStatus(HOLD_MATERIAL)
    // Pushed straight to the shared list so the badge updates without waiting for Save.
    onUpdateWorkOrder?.(number,{STATUS:HOLD_MATERIAL,'STATUS DESCRIPITION':statusDescription('workOrder',HOLD_MATERIAL),'HELD FROM':status,holdPeriods:periods})
  }
  const resumeFromMaterialHold=()=>{
    const periods=endHold({holdPeriods})
    const resume=workOrderTransitions(HOLD_MATERIAL,heldFrom)[0]||'WAPPR'
    setHoldPeriods(periods); setHeldFrom(''); setSelectedStatus(resume)
    onUpdateWorkOrder?.(number,{STATUS:resume,'STATUS DESCRIPITION':statusDescription('workOrder',resume),'HELD FROM':'',holdPeriods:periods})
  }
  const close = () => onClose()
  const reroute=()=>{setTab('Overview');setAssignedDepartment('');setSupervisor('');setWorkStarted(false);setWorkScheduled(false);setWorkWaitingSchedule(false);setWorkApproved(false)}
  const addFiles=(setter)=>event=>{const files=Array.from(event.target.files||[]).map(file=>({name:file.name,size:file.size>1048576?`${(file.size/1048576).toFixed(1)} MB`:`${Math.max(1,Math.round(file.size/1024))} KB`,type:file.type||'Document'}));setter(current=>[...current,...files]);event.target.value=''}
  const downloadFile=file=>{const blob=new Blob([`Mock CAFM attachment\n\nName: ${file.name}\nType: ${file.type||'Document'}\nSize: ${file.size||'Unknown'}\n\nReal storage integration can replace this generated download.`],{type:'text/plain'});const url=URL.createObjectURL(blob);const link=document.createElement('a');link.href=url;link.download=file.name?.includes('.')?file.name:`${file.name||'attachment'}.txt`;document.body.appendChild(link);link.click();link.remove();URL.revokeObjectURL(url)}
  const completeWork=()=>{if(!failureReady){setTab('Failure');return}const now=toDateTimeInput(new Date());setActualFinish(now);setActualStart(current=>current||now);setActualMaterials(current=>current.length?current:plannedResources.filter(row=>row.type==='Material').map(row=>({...row,actualQuantity:''})));setActualTools(current=>current.length?current:plannedResources.filter(row=>['Tool','Equipment'].includes(row.type)).map(row=>({...row,actualQuantity:''})));setWorkCompleted(true);setSelectedStatus('COMP')}
  const printWorkOrder=()=>{if(isPM&&tab!=='Plan')setTab('Plan');printWithoutBrowserTitle()}
  const saveChanges=()=>{
    const updatedOrder = {
      ...order,
      WORKORDER: number,
      'DESCRIPITION ': description,
      'LONG DESCRIPTION': longDescription,
      PRIORTY: Number(String(priority).charAt(0)) || Number(priority) || 3,
      SITE: siteValue,
      ASSET: assetValue,
      'ASSET DESCRIPTION': assetDescription,
      'LOCATION ': locationValue,
      'DEPARTMENT ': department,
      'SUB DEPARTMENT  NAME': subDepartment,
      'ASSIGNED DEPARTMENT': assignedDepartment,
      'WORK GROUP': workGroup,
      'SYSTEM': systemValue,
      'HELD FROM': heldFrom,
      holdPeriods,
      SUPERVISOR: supervisor,
      'LABOR CRAFT CODE': laborCraft,
      STATUS: status,
      'STATUS DESCRIPITION': maximoWorkOrderStatusDescriptions[status] || status,
      'TARGET START ': targetStart,
      'TARGET FINISH ': targetFinish,
      'ACTUAL START ': actualStart,
      'ACTUAL FINISH ': actualFinish,
      'FAILURE CODE': failureClass,
      'PROBLEM CODE': problemCode,
      'CAUSE CODE': causeCode,
      'REMEDY CODE': remedyCode,
      'JOB PLAN': jobPlanNumber,
      'JOB PLAN TASKS': plannedTasks,
      'PLANNED LABOR': plannedLabor,
      'PLANNED RESOURCES': plannedResources,
      'PTW REQUIRED': ptwRequired,
      'PTW FILES': ptwFiles,
      'GENERAL FILES': generalFiles,
      'TECHNICIAN REMARKS': technicianRemarks,
      'COMPLETION NOTES': completionNotes,
      'ACTUAL LABOR': actualLabor,
      'ACTUAL HOURS': actualHours,
      'ACTUAL MATERIALS': actualMaterials,
      'ACTUAL TOOLS': actualTools,
      'METER READING': meterReading,
      'WATER CONSUMPTION': waterConsumption,
      'ENERGY CONSUMPTION': energyConsumption,
      'METER READING DATE': meterReadingDate
    }
    setAutoSaveState('Saving')
    onUpdateWorkOrder?.(number, updatedOrder)
    setTimeout(()=>setAutoSaveState('Saved'),350)
  }
  useEffect(()=>{if(!saveReady.current){saveReady.current=true;return}setAutoSaveState('Unsaved changes')},[description,longDescription,priority,department,subDepartment,assignedDepartment,workGroup,supervisor,laborCraft,siteValue,assetValue,assetDescription,locationValue,targetStart,targetFinish,failureClass,problemCode,causeCode,remedyCode,plannedLabor,plannedResources,plannedTasks,ptwRequired,ptwFiles,generalFiles,technicianRemarks,completionNotes,actualLabor,actualHours,actualMaterials,actualTools,actualStart,actualFinish,meterReading,waterConsumption,energyConsumption,meterReadingDate,selectedStatus,workApproved,workWaitingSchedule,workScheduled,workStarted,workCompleted,workClosed])
  return <div className={page?'w-full':'fixed inset-0 z-50 overflow-auto bg-[color:color-mix(in_srgb,var(--app-sidebar-bg)_72%,transparent)] p-6 backdrop-blur-sm'}><div className={`${page?'mx-auto w-full max-w-[1400px] space-y-3 bg-transparent p-0':'mx-auto max-w-7xl space-y-4 rounded-3xl bg-[var(--app-panel)] p-0 shadow-2xl'} wo-screen`}>
    <WorkOrderHeader number={number} workType={workType} status={status} statusDescription={maximoWorkOrderStatusDescriptions[status] || status} description={description || order.DESCRIPTION || 'Enter work order information'} isPM={isPM} autoSaveState={autoSaveState} onSave={saveChanges} overviewReady={overviewReady} preparationReady={preparationReady} failureReady={failureReady} actualReady={actualReady} close={close} printWorkOrder={printWorkOrder} onMaterialHold={putOnMaterialHold} onResume={resumeFromMaterialHold} onMaterialHoldStatus={status===HOLD_MATERIAL} canMaterialHold={allowedStatuses.includes(HOLD_MATERIAL)} canManageHold={canManageHold} />
    <WorkOrderTabs tabs={workOrderTabs} active={tab} onChange={setTab} showFailureDot={!isPM} />
    <WorkOrderWorkflowNotice status={status} missing={workflowMissing} nextStep={workflowNextStep} />
    <div className={workOrderBodyClass}>
      {tab==='Overview' && <WorkOrderOverviewTab projectName={projectName} sourceRequest={sourceRequest} number={number} status={status} workType={workType} priority={priority} setPriority={setPriority} description={description} setDescription={setDescription} siteValue={siteValue} changeSite={changeSite} siteOptions={siteOptions} longDescription={longDescription} setLongDescription={setLongDescription} assetValue={assetValue} changeAsset={changeAsset} assetOptions={assetOptions} locationValue={locationValue} setLocationValue={setLocationValue} locationOptions={locationOptions} assetDescription={assetDescription} setAssetDescription={setAssetDescription} department={department} setDepartment={setDepartment} departmentOptions={departmentOptions} subDepartment={subDepartment} setSubDepartment={setSubDepartment} subDepartmentOptions={subDepartmentOptions} assignedDepartment={assignedDepartment} setAssignedDepartment={setAssignedDepartment} setWorkGroup={setWorkGroup} setSupervisor={setSupervisor} workGroup={workGroup} workGroupOptions={workGroupOptions} systemValue={systemValue} setSystemValue={setSystemValue} systemOptions={systemOptions} supervisor={supervisor} supervisorOptions={supervisorOptions} laborCraft={laborCraft} setLaborCraft={setLaborCraft} laborCraftOptions={laborCraftOptions} reportedDate={toDateTimeInput(order['REPORTED DATE ']||order['REPORTED DATE']||order['REPORT DATE'])||nowLocalDateTime()} targetStart={targetStart} setTargetStart={setTargetStart} targetFinish={targetFinish} setTargetFinish={setTargetFinish} actualStart={actualStart} setActualStart={setActualStart} actualFinish={actualFinish} setActualFinish={setActualFinish} slaLabel={slaLabel} isPM={isPM} />}
      {tab==='Plan' && <WorkOrderPlanTab isPM={isPM} tasksLocked={tasksFromJobPlan} jobPlanNumber={jobPlanNumber} plannedLabor={plannedLabor} setPlannedLabor={setPlannedLabor} plannedResources={plannedResources} setPlannedResources={setPlannedResources} plannedTasks={plannedTasks} setPlannedTasks={setPlannedTasks} plannedCraftOptions={plannedCraftOptions} plannedCrewOptions={plannedCrewOptions} materialMaster={materialMaster} toolMaster={toolMaster} updatePlanRow={updatePlanRow} updatePlannedResource={updatePlannedResource} updatePlannedResourceField={updatePlannedResourceField} />}
      {tab==='Actual' && <WorkOrderActualTab actualsEditable={actualsEditable} status={status} preparationReady={preparationReady} planReady={planReady} setTab={setTab} setWorkStarted={value=>{setWorkStarted(value);if(value)setSelectedStatus('INPRG')}} completeWork={completeWork} outlineButtonClass={workOrderOutlineButtonClass} primaryButtonClass={workOrderPrimaryButtonClass} targetStart={targetStart} targetFinish={targetFinish} actualFinish={actualFinish} setActualFinish={setActualFinish} slaBreachedNow={slaBreachedNow} slaLabel={slaLabel} technicianRemarks={technicianRemarks} setTechnicianRemarks={setTechnicianRemarks} completionNotes={completionNotes} setCompletionNotes={setCompletionNotes} actualLabor={actualLabor} setActualLabor={setActualLabor} laborCraft={laborCraft} setLaborCraft={setLaborCraft} actualHours={actualHours} setActualHours={setActualHours} actualStart={actualStart} setActualStart={setActualStart} actualMaterials={actualMaterials} setActualMaterials={setActualMaterials} actualTools={actualTools} setActualTools={setActualTools} updateActualRow={updateActualRow} workClosed={workClosed} failureReady={failureReady} actualReady={actualReady} closeWork={closeWork} />}
      {tab==='Failure' && <WorkOrderFailureTab isCM={isCM} causeApplicable={causeApplicable} remedyApplicable={remedyApplicable} failureClass={failureClass} changeFailure={changeFailure} failureClassOptions={failureClassOptions} problemCode={problemCode} setProblemCode={setProblemCode} setCauseCode={setCauseCode} setRemedyCode={setRemedyCode} problemOptions={problemOptions} causeCode={causeCode} causeOptions={causeOptions} remedyCode={remedyCode} remedyOptions={remedyOptions} failureDescription={failureDescription} problemDescription={problemDescription} causeDescription={causeDescription} remedyDescription={remedyDescription} failureCount={failureCodes.length} />}
      {tab==='Material Requests' && <WorkOrderMaterialRequestsTab resourceRequests={resourceRequests} plannedResources={plannedResources} setPlannedResources={setPlannedResources} updatePlanRow={updatePlanRow} getAvailability={resourceAvailability} materialBlocked={materialBlocked} primaryButtonClass={workOrderPrimaryButtonClass} outlineButtonClass={workOrderOutlineButtonClass} setTab={setTab} workOrderContext={{ number, site: siteValue, department: department || assignedDepartment, assignedDepartment }} onCreatePurchaseRequest={onCreatePurchaseRequest} onCreateReservation={onCreateReservation} />}
      {tab==='PTW & Files' && <WorkOrderDocumentsTab ptwRequired={ptwRequired} setPtwRequired={setPtwRequired} ptwFiles={ptwFiles} setPtwFiles={setPtwFiles} generalFiles={generalFiles} setGeneralFiles={setGeneralFiles} addFiles={addFiles} downloadFile={downloadFile} />}
      {tab==='Meters' && <WorkOrderMetersTab meterReading={meterReading} setMeterReading={setMeterReading} waterConsumption={waterConsumption} setWaterConsumption={setWaterConsumption} energyConsumption={energyConsumption} setEnergyConsumption={setEnergyConsumption} meterReadingDate={meterReadingDate} setMeterReadingDate={setMeterReadingDate} />}
    </div>
  </div><WorkOrderPrintReport sourceRequest={sourceRequest} systemValue={systemValue} number={number} description={description || order['DESCRIPITION '] || 'Work order'} workType={workType} status={status} priority={priority} siteValue={siteValue} department={department} subDepartment={subDepartment} assignedDepartment={assignedDepartment} locationValue={locationValue} assetValue={assetValue} assetDescription={assetDescription} targetStart={targetStart} targetFinish={targetFinish} actualStart={actualStart} actualFinish={actualFinish} slaLabel={slaLabel} jobPlan={jobPlanNumber} estimatedDuration={order['ESTIMATED DURATION']} pmNumber={order['PM NUMBER']} pmCycle={order['PM CYCLE']} plannedTasks={plannedTasks} plannedLabor={plannedLabor} plannedResources={plannedResources} ptwRequired={ptwRequired} ptwFiles={ptwFiles} generalFiles={generalFiles} meterReading={meterReading} waterConsumption={waterConsumption} energyConsumption={energyConsumption} meterReadingDate={meterReadingDate} failureClass={failureClass} problemCode={problemCode} causeCode={causeCode} remedyCode={remedyCode} technicianRemarks={technicianRemarks} completionNotes={completionNotes} actualLabor={actualLabor} actualHours={actualHours} actualMaterials={actualMaterials} actualTools={actualTools} /></div>
}

export default function App() {
  const { isAuthenticated } = useAuth()
  const [active, setActive] = useState(()=>routeToPage(window.location.pathname))
  const [search, setSearch] = useState('')
  const [mobileOpen, setMobileOpen] = useState(false)
  // The workbook's work order sheet is header-only, so the seeds are what make the
  // material-hold and SLA-pause behaviour visible on first load.
  const [allWorkOrders,setAllWorkOrders]=useState([...workOrders,...workOrderSeeds])
  const [serviceRequests,setServiceRequests]=useState(serviceRequestSeed)
  const [incidents,setIncidents]=useState(incidentSeed)
  const [jobTaskRecords,setJobTaskRecords]=useState(jobTasks.map(task => ({ ...task, status: task.status || 'ACTIVE' })))
  // The task sheet carries no status column and cannot represent a plan with no task
  // lines, so identity and status live in a master file instead.
  const [jobPlanRecords,setJobPlanRecords]=useState(jobPlanSeed)
  const [purchaseRequests,setPurchaseRequests]=useState([])
  const [purchaseOrders,setPurchaseOrders]=useState([])
  const [reservations,setReservations]=useState([])
  const [projectName,setProjectName]=useState(readProjectName)
  const changeProjectName=name=>setProjectName(writeProjectName(name))
  const workOrderNotifications = buildWorkOrderNotifications(allWorkOrders)
  const navigate = name => { setActive(name); setSearch(''); setMobileOpen(false); window.history.pushState({},'',pathForPage(name)) }
  const jobPlanRouteId = decodeURIComponent(window.location.pathname.split('/job-plans/')[1] || '')
  // Memoised: rebuilt inline this array got a new identity every render, and
  // RegisterPage resyncs on `rows`, which silently wiped anything the user added.
  const jobPlanSummaryRows = useMemo(() => {
    const summarise = (jpnum, description, status) => {
      const tasks = jobTaskRecords.filter(row => row.JPNUM === jpnum)
      return {
        JPNUM: jpnum,
        DESCRIPTION: description || tasks[0]?.DESCRIPTION || '',
        status: status || 'ACTIVE',
        taskCount: tasks.length,
        totalMinutes: tasks.reduce((sum, row) => sum + Math.max(1, Math.round(Number(row['TASK DURATION IN HOUR'] || 0) * 1440)), 0)
      }
    }
    const fromMaster = jobPlanRecords.map(plan => summarise(plan.JPNUM, plan.DESCRIPTION, plan.status))
    const known = new Set(fromMaster.map(plan => plan.JPNUM))
    // Union in any plan that exists only as task rows, so the list can never drop one.
    const orphans = [...new Set(jobTaskRecords.map(task => task.JPNUM).filter(Boolean))]
      .filter(jpnum => !known.has(jpnum))
      .map(jpnum => summarise(jpnum))
    return [...fromMaster, ...orphans]
  }, [jobPlanRecords, jobTaskRecords])
  const [selectedJobPlan,setSelectedJobPlan]=useState(jobPlanSummaryRows.find(plan => plan.JPNUM === jobPlanRouteId) || null)
  const failureRouteId = decodeURIComponent(window.location.pathname.split('/failure-library/')[1] || '')
  const failureClassRows = [...new Map(failureCodes.map(row => [row['FAILURE CLASS ID'], row])).values()]
  const [selectedFailureClass,setSelectedFailureClass]=useState(failureClassRows.find(row => row['FAILURE CLASS ID'] === failureRouteId) || null)
  const convertRequest = request => {
    const number=String(56545135+allWorkOrders.filter(o=>String(o.WORKORDER).startsWith('56545')).length-3)
    const cm={'WORKORDER':number,'DESCRIPITION ':request.description,'LOCATION ':request.location,'LOCATION PRIORTY':toLocationPriority(request.priority),'ASSET':request.asset||'Unassigned','STATUS':'WAPPR','WORK TYPE ':'CM','STATUS DESCRIPITION':'Waiting for Approval','DEPARTMENT ':request.assignedDepartment||request.department,'SUB DEPARTMENT  NAME':request.subDepartment||'','PRIORTY':request.priority==='Emergency'?1:request.priority==='High'?2:3,'SITE':request.site,'TARGET START ':null,'TARGET FINISH ':null,'REPORTED DATE ':request.reportedDate||nowLocalDateTime(),'SOURCE SR':request.sr,'REPORTED BY':request.reportedBy||'','SOURCE SR PRIORITY':request.priority||'','SOURCE SR TYPE':request.requestType||'','FAILURE CODE':request.failureCode||'','PROBLEM CODE':request.problemCode||'','CAUSE CODE':request.causeCode||'','REMEDY CODE':request.remedyCode||''}
    setAllWorkOrders(rows=>rows.some(o=>o['SOURCE SR']===request.sr)?rows:[...rows,cm])
    return cm
  }
  const openConvertedWorkOrder=number=>{setActive('Work Orders');setSearch('');window.history.pushState({},'',`/work-orders/${number}`)}
  // Deep link carries the target number so the tab only applies to that order, never
  // to whichever work order the user opens next.
  const [workOrderDeepLink,setWorkOrderDeepLink]=useState(null)
  const openWorkOrderTab=(number,tab)=>{setWorkOrderDeepLink({number:String(number),tab});openConvertedWorkOrder(number)}
  const deepLinkTabFor=order=>String(order?.WORKORDER)===workOrderDeepLink?.number?workOrderDeepLink.tab:undefined
  const todayStamp=()=>nowLocalDate()
  const createPurchaseRequest=record=>{
    // Only dedupe within a work order. Without this guard two standalone requests for the
    // same item would collapse into one, because both have an undefined work order.
    const existing=record.workOrder?purchaseRequests.find(row=>row.workOrder===record.workOrder&&row.item===record.item):null
    if(existing) return existing
    const created={purchaseRequest:`PR-2026-${String(purchaseRequests.length+1).padStart(4,'0')}`,status:'WAPPR',statusDescription:statusDescription('purchaseRequisition','WAPPR'),createdAt:todayStamp(),...record}
    setPurchaseRequests(rows=>created.workOrder&&rows.some(row=>row.workOrder===created.workOrder&&row.item===created.item)?rows:[created,...rows])
    return created
  }
  const createPurchaseOrderFromRequest=request=>{
    const existing=purchaseOrders.find(order=>order.purchaseRequest===request.purchaseRequest)
    if(existing) return existing
    const created={purchaseOrder:`PO-2026-${String(purchaseOrders.length+1).padStart(4,'0')}`,purchaseRequest:request.purchaseRequest,workOrder:request.workOrder,type:request.type,item:request.item,quantity:request.quantity,source:request.source,site:request.site,department:request.department,status:'WAPPR',statusDescription:statusDescription('purchaseOrder','WAPPR'),createdAt:todayStamp()}
    setPurchaseOrders(rows=>rows.some(order=>order.purchaseRequest===request.purchaseRequest)?rows:[created,...rows])
    setPurchaseRequests(rows=>rows.map(row=>row.purchaseRequest===request.purchaseRequest?{...row,status:'APPR',statusDescription:statusDescription('purchaseRequisition','APPR'),purchaseOrder:created.purchaseOrder,approvedAt:todayStamp()}:row))
    return created
  }
  const updatePurchaseRequest=(reference,patch)=>setPurchaseRequests(rows=>rows.map(row=>row.purchaseRequest===reference?{...row,...patch,statusDescription:patch.status?statusDescription('purchaseRequisition',patch.status):row.statusDescription}:row))
  const updatePurchaseOrder=(reference,patch)=>setPurchaseOrders(rows=>rows.map(row=>row.purchaseOrder===reference?{...row,...patch,statusDescription:patch.status?statusDescription('purchaseOrder',patch.status):row.statusDescription}:row))
  const updateJobPlan=(reference,patch)=>{
    setJobPlanRecords(rows=>rows.map(row=>row.JPNUM===reference?{...row,...patch}:row))
    setJobTaskRecords(rows=>rows.map(row=>row.JPNUM===reference?{...row,...patch}:row))
    setSelectedJobPlan(current=>current?.JPNUM===reference?{...current,...patch}:current)
  }
  const createJobPlan=form=>{
    const jpnum=String(form.JPNUM||'').trim()
    if(!jpnum) return
    setJobPlanRecords(rows=>rows.some(row=>row.JPNUM===jpnum)?rows:[{JPNUM:jpnum,DESCRIPTION:form.DESCRIPTION||'',status:form.status||'DRAFT'},...rows])
    // The create modal collects no JOBTASKID, but the tasks table keys rows on it.
    if(form['JOB TASK DESCRIPTION']) setJobTaskRecords(rows=>[...rows,{...form,JPNUM:jpnum,JOBTASKID:form.JOBTASKID||`${jpnum}-${form['JOB TASK SEQUENCE']||rows.filter(row=>row.JPNUM===jpnum).length+1}`}])
  }
  const createReservation=record=>{
    const existing=reservations.find(row=>row.workOrder===record.workOrder&&row.item===record.item&&row.status===record.status)
    if(existing) return existing
    const prefix=record.type==='Material'?'RSV':'ALC'
    const created={reservation:`${prefix}-2026-${String(reservations.length+1).padStart(4,'0')}`,status:'ENTERED',statusDescription:statusDescription('inventoryUsage','ENTERED'),createdAt:todayStamp(),arrangedQuantity:0,releasedQuantity:0,deliveredQuantity:0,...record}
    setReservations(rows=>rows.some(row=>row.workOrder===created.workOrder&&row.item===created.item&&row.status===created.status)?rows:[created,...rows])
    return created
  }
  const updateReservation=(reference,patch)=>setReservations(rows=>rows.map(row=>row.reservation===reference?{...row,...patch}:row))
  const updateWorkOrder=(number,patch)=>setAllWorkOrders(rows=>rows.map(order=>String(order.WORKORDER)===String(number)?{...order,...patch}:order))
  const createWorkOrder=form=>{const next=Math.max(...allWorkOrders.map(order=>Number(order.WORKORDER)||0),56545134)+1;const created={'WORKORDER':String(next),'DESCRIPITION ':form.description,'LOCATION ':form.location,'LOCATION PRIORTY':toLocationPriority(form.priority),'ASSET':form.asset,'STATUS':'WAPPR','WORK TYPE ':form.type,'STATUS DESCRIPITION':'Waiting for Approval','DEPARTMENT ':form.department||'','SUB DEPARTMENT  NAME':form.subDepartment||'','ASSIGNED DEPARTMENT':form.department||'','ASSET DESCRIPTION':assetDescriptionFromMaster(form.asset, assets),'SYSTEM':assetFromMaster(form.asset, assets)?.system||'','PRIORTY':Number(String(form.priority).charAt(0))||3,'SITE':form.site,'TARGET START ':null,'TARGET FINISH ':null,'REPORTED DATE ':nowLocalDateTime()};setAllWorkOrders(rows=>[...rows,created]);return created}
  const generatePmWorkOrder=(pm,tasks)=>setAllWorkOrders(rows=>{
    if(rows.some(order=>order['PM NUMBER']===pm.pmNumber&&order['PM CYCLE']===pm.cycle)) return rows
    const assetRecord=assetFromMaster(pm.asset, assets)
    const inheritedLocation=pm.location || assetRecord?.location || ''
    const inheritedSite=pm.site || assetRecord?.site || '1031'
    return [...rows,{'WORKORDER':pm.workOrder,'DESCRIPITION ':pm.description,'LOCATION ':inheritedLocation,'LOCATION PRIORTY':3,'ASSET':pm.asset,'ASSET DESCRIPTION':assetRecord?.description?.trim() || '','STATUS':pm.woStatus||'WSCH','WORK TYPE ':'PM','STATUS DESCRIPITION':maximoWorkOrderStatusDescriptions[pm.woStatus||'WSCH']||'Waiting for Schedule','DEPARTMENT ':pm.department,'SUB DEPARTMENT  NAME':pm.subDepartment,'ASSIGNED DEPARTMENT':pm.department,'PRIORTY':3,'SITE':inheritedSite,'TARGET START ':pm.startDate,'TARGET FINISH ':pm.startDate,'REPORTED DATE ':nowLocalDateTime(),'PM NUMBER':pm.pmNumber,'PM CYCLE':pm.cycle,'JOB PLAN':pm.jobPlan,'JOB PLAN TASKS':tasks,'ESTIMATED DURATION':tasks.reduce((sum,task)=>sum+Number(task['TASK DURATION IN HOUR']||0),0)*24,'ROUTE':pm.route,'LEAD TIME (DAYS)':pm.leadTime,'FREQUENCY':pm.frequency,'FREQUNIT':pm.freqUnit,'PMCOUNTER':pm.pmCounter,'STORELOC':pm.storeLocation,'SUPERVISOR':pm.supervisor,'LEAD':pm.lead,'PERSONGROUP':pm.personGroup,'PM STATUS':pm.pmStatus}]
  })
  const pages = {
    'Job Requests': <ServiceRequestsPage onConvert={convertRequest} onOpenWorkOrder={openConvertedWorkOrder} requests={serviceRequests} setRequests={setServiceRequests} assets={assets} workOrders={allWorkOrders} failureOptions={failureClassOptions}/>,
    'Incidents': <IncidentsPage rows={incidents} setRows={setIncidents}/>,
    'Work Orders': <WorkOrdersPage rows={allWorkOrders} assets={assets} onCreate={createWorkOrder} onImportRows={setAllWorkOrders} EditorComponent={props => <WorkOrderEditor {...props} projectName={projectName} initialTab={deepLinkTabFor(props.order)} onCreatePurchaseRequest={createPurchaseRequest} onCreateReservation={createReservation} onUpdateWorkOrder={updateWorkOrder} />} excelDate={excelDate} slaBreached={slaBreached}/>,
    'Assets': <AssetsPage initialAssets={assets} workOrders={allWorkOrders} />,
    'Preventive Maintenance': <PreventiveMaintenancePage assets={assets} jobTasks={jobTasks} workOrders={allWorkOrders} onGenerate={generatePmWorkOrder} onOpenWorkOrder={openConvertedWorkOrder}/>,
    'Meters': <MetersPage assets={assets} workOrders={allWorkOrders} />,
    'Locations': <LocationsPage initialLocations={locations}/>,
    'Job Plans': selectedJobPlan ? <JobPlanDetailPage plan={selectedJobPlan} tasks={jobTaskRecords.filter(task=>task.JPNUM===selectedJobPlan.JPNUM)} workOrders={allWorkOrders.filter(order=>getWorkOrderJobPlan(order)===selectedJobPlan.JPNUM)} onBack={()=>{setSelectedJobPlan(null);window.history.pushState({},'','/job-plans')}} onUpdate={updateJobPlan}/> : <RegisterPage title="Job plans" eyebrow="MAINTENANCE" description="Standard task sequences and estimated durations for technicians." rows={jobPlanSummaryRows} onCreate={createJobPlan} search={search} setSearch={setSearch} action="New job plan" modalTitle="Add job plan" modalNote="Create a job plan task line with sequence, instructions, and estimated duration." modalFields={[
      { key: 'JPNUM', label: 'Job Plan', required: true, placeholder: 'JP415004' },
      { key: 'DESCRIPTION', label: 'Plan Description', required: true, full: true },
      { key: 'JOB TASK SEQUENCE', label: 'Task Sequence', required: true, type: 'number', defaultValue: 10 },
      { key: 'JOB TASK DESCRIPTION', label: 'Task Description', required: true, full: true },
      { key: 'TASK DURATION IN HOUR', label: 'Duration in Hours', required: true, type: 'number', defaultValue: 1 },
      { key: 'status', label: 'Status', required: true, options: ['DRAFT', 'ACTIVE', 'INACTIVE'], defaultValue: 'ACTIVE' }
    ]} mapFormToRow={form => ({ ...form, status: form.status || 'ACTIVE', 'TASK DURATION IN HOUR': Number(form['TASK DURATION IN HOUR'] || 0) })} statusTabs={['DRAFT', 'ACTIVE', 'INACTIVE']} rowKey="JPNUM" onRowClick={row=>{setSelectedJobPlan(row);window.history.pushState({},'',`/job-plans/${row.JPNUM}`)}} columns={[
      {key:'JPNUM',label:'Plan',render:v=><strong className="mono">{v}</strong>},{key:'DESCRIPTION',label:'Plan description'},{key:'taskCount',label:'Tasks'},{key:'totalMinutes',label:'Duration',render:v=>`${v} min`},{key:'status',label:'Status',render:v=>v||'ACTIVE'}
    ]}/>,
    'Failure Library': selectedFailureClass ? <FailureLibraryDetailPage failureClass={selectedFailureClass} rows={failureCodes.filter(row=>row['FAILURE CLASS ID']===selectedFailureClass['FAILURE CLASS ID'])} workOrders={allWorkOrders.filter(order=>order['FAILURE CODE']===selectedFailureClass['FAILURE CLASS ID'])} onBack={()=>{setSelectedFailureClass(null);window.history.pushState({},'','/failure-library')}}/> : <RegisterPage title="Failure library" eyebrow="RELIABILITY" description="Search the bilingual Maximo problem, cause, and remedy hierarchy." rows={failureClassRows.map(row=>({...row, problemCount: failureCodes.filter(item=>item['FAILURE CLASS ID']===row['FAILURE CLASS ID']&&item['PROBLEM CODE']).length, causeCount: failureCodes.filter(item=>item['FAILURE CLASS ID']===row['FAILURE CLASS ID']&&item['CAUSE CODE']).length, remedyCount: failureCodes.filter(item=>item['FAILURE CLASS ID']===row['FAILURE CLASS ID']&&item['REMEDY CODE']).length}))} search={search} setSearch={setSearch} action="Add code" modalTitle="Add failure code" modalNote="Create a failure hierarchy record. Cause and remedy can stay optional." modalFields={[
      { key: 'FAILURE CLASS ID', label: 'Failure Class ID', required: true, placeholder: 'HVAC' },
      { key: 'DESCRIPTION', label: 'Class Description', required: true, full: true },
      { key: 'PROBLEM CODE', label: 'Problem Code', required: true },
      { key: 'PC - DESCRIPTION', label: 'Problem Description', required: true, full: true },
      { key: 'CAUSE CODE', label: 'Cause Code' },
      { key: 'CC - DESCRIPTION', label: 'Cause Description', full: true },
      { key: 'REMEDY CODE', label: 'Remedy Code' },
      { key: 'RC - DESCRIPTION', label: 'Remedy Description', full: true }
    ]} rowKey="FAILURE CLASS ID" onRowClick={row=>{setSelectedFailureClass(row);window.history.pushState({},'',`/failure-library/${encodeURIComponent(row['FAILURE CLASS ID'])}`)}} columns={[
      {key:'FAILURE CLASS ID',label:'Class',render:v=><strong className="mono">{v}</strong>},{key:'DESCRIPTION',label:'Class description'},{key:'problemCount',label:'Problems'},{key:'causeCount',label:'Causes'},{key:'remedyCount',label:'Remedies'}
    ]}/>,
    'Labor': <LaborPage/>,
    'Materials': <MaterialsPage/>,
    'Stores': <StoresPage/>,
    'Purchase Requisitions': <PurchaseRequestsPage rows={purchaseRequests} onCreateRequest={createPurchaseRequest} onApproveRequest={createPurchaseOrderFromRequest} onUpdateRequest={updatePurchaseRequest}/>,
    'Purchase Orders': <PurchaseOrdersPage rows={purchaseOrders} onUpdateOrder={updatePurchaseOrder} onUpdateRequest={updatePurchaseRequest}/>,
    'Reservations': <ReservationsPage rows={reservations} onUpdate={updateReservation}/>,
    'Tools & Equipment': <ToolsPage/>,
    'Users': <UsersPage/>,
    'Roles & Permissions': <RolesPermissionsPage/>,
    'Settings': <SettingsPage projectName={projectName} onProjectNameChange={changeProjectName}/>
  }
  if (!isAuthenticated) return <LoginPage />

  return (
    <AppShell
      active={active}
      navigation={navigationItems}
      projectName={projectName}
      counters={{ workOrders: allWorkOrders.length }}
      overdueCount={workOrderNotifications.filter(item => item.type === 'overdue').length}
      notifications={workOrderNotifications}
      statusRuleCount={statusMatrix.length}
      mobileOpen={mobileOpen}
      onMobileOpen={() => setMobileOpen(true)}
      onMobileClose={() => setMobileOpen(false)}
      onNavigate={navigate}
      onOpenWorkOrders={() => { setActive('Work Orders'); setMobileOpen(false); window.history.pushState({}, '', '/work-orders') }}
    >
      {active === 'Overview' ? <OverviewPage onNavigate={navigate} onOpenWorkOrderTab={openWorkOrderTab} projectName={projectName} incidents={incidents} workOrders={allWorkOrders} purchaseRequests={purchaseRequests} purchaseOrders={purchaseOrders} reservations={reservations} /> : pages[active]}
    </AppShell>
  )
}




























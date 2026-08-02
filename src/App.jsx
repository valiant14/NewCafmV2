import { useEffect, useRef, useState } from 'react'
import ServiceRequestsPage from './pages/ServiceRequestsPage'
import WorkOrdersPage from './pages/WorkOrdersPage'
import LaborPage from './pages/LaborPage'
import MaterialsPage from './pages/MaterialsPage'
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
import { useAuth } from './providers/AuthProvider'
import { useCafmData } from './providers/CafmDataProvider'
import { printWithoutBrowserTitle } from './lib/print'
import { statusDescription, statusOptions } from './lib/statusMatrix'
import { assetDescriptionFromMaster, assetFromMaster, cleanText, getWorkOrderJobPlan, maximoWorkOrderStatusDescriptions, normalizeWoStatus, taskToPlanRow, toLocationPriority, WorkOrderWorkflowNotice, workOrderBodyClass, workOrderTabs } from './lib/workOrderUtils.jsx'
import { saveWorkOrder } from './services/mockCafmApi'


const buildWorkOrderNotifications = rows => {
  const now = Date.now()
  const upcomingWindow = now + 30 * 24 * 60 * 60 * 1000
  return rows
    .map(order => {
      const target = toDateTimeInput(order['TARGET FINISH ']) || toDateTimeInput(order['TARGET START '])
      const due = target ? new Date(target).getTime() : null
      if (!due) return null
      const closed = ['COMP', 'COMPLETED', 'CLOSE', 'CLOSED'].includes(String(order.STATUS || '').toUpperCase())
      if (closed) return null
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


function WorkOrderEditor({ order, onClose, page = false, onCreatePurchaseRequest, onCreateReservation, onUpdateWorkOrder, masterData }) {
  const { assets, workOrders, jobTasks, failureCodes, failureClassOptions, uniqueCodeOptions, departments, labor: laborMaster, materials: materialMaster, tools: toolMaster, toDateTimeInput } = masterData
  const workType=(order['WORK TYPE'] || order['WORK TYPE '] || order['WORK TYPE  '] || 'CM').trim()
  const isPM = workType === 'PM'
  const isCM = workType === 'CM'
  const [tab, setTab] = useState('Overview')
  const [autoSaveState,setAutoSaveState]=useState('Saved')
  const saveReady = useRef(false)
  const [selectedStatus,setSelectedStatus]=useState(normalizeWoStatus(order.STATUS))
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
  const [failureClass,setFailureClass]=useState(order['FAILURE CODE']||'')
  const [problemCode,setProblemCode]=useState(order['PROBLEM CODE']||'')
  const [causeCode,setCauseCode]=useState(order['CAUSE CODE']||'')
  const [remedyCode,setRemedyCode]=useState(order['REMEDY CODE']||'')
  const jobPlanNumber = getWorkOrderJobPlan(order)
  const jobPlanTaskRows = order['JOB PLAN TASKS']?.length ? order['JOB PLAN TASKS'] : jobPlanNumber ? jobTasks.filter(task => cleanText(task.JPNUM) === jobPlanNumber) : []
  const [plannedLabor,setPlannedLabor]=useState(isPM?[{craft:'HVAC Technician',hours:'2',crew:'HVAC Team A'}]:[{craft:'',hours:'',crew:''}])
  const [plannedResources,setPlannedResources]=useState([])
  const [plannedTasks,setPlannedTasks]=useState(isPM?jobPlanTaskRows.map(taskToPlanRow):[{sequence:10,description:'',duration:''}])
  const [ptwRequired,setPtwRequired]=useState(false)
  const [ptwFiles,setPtwFiles]=useState([])
  const [generalFiles,setGeneralFiles]=useState([{name:'site-inspection-photo.jpg',size:'1.8 MB',type:'Image'}])
  const [technicianRemarks,setTechnicianRemarks]=useState('')
  const [completionNotes,setCompletionNotes]=useState('')
  const [actualLabor,setActualLabor]=useState('')
  const [actualHours,setActualHours]=useState('')
  const [actualMaterials,setActualMaterials]=useState([])
  const [actualTools,setActualTools]=useState([])
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
  const workGroupOptions={Mechanics:['C1-HVAC','C1-PLUMBING','C1-MECHANICAL'],Electrical:['C1-ELECTRICAL','C1-POWER','C1-LIGHTING'],Civil:['C1-CIVIL','C1-CARPENTRY','C1-PAINTING'],Landscape:['C1-LANDSCAPE','C1-IRRIGATION'],Cleaning:['C1-CLEANING']}[assignedDepartment]||['C1-HVAC','C1-ELECTRICAL','C1-PLUMBING','C1-CIVIL']
  const supervisorOptions=laborMaster.filter(person=>!assignedDepartment||person.department===assignedDepartment).map(person=>({value:person.name,label:`${person.craftCode} · ${person.craft}`}))
  const laborCraftOptions=[...new Map(laborMaster.map(person=>[person.craftCode,{value:person.craftCode,label:person.craft}])).values()]
  const plannedCraftOptions=[...new Map(laborMaster.map(person=>[person.craft,{value:person.craft,label:person.craftCode}])).values()]
  const plannedCrewOptions=laborMaster.map(person=>({value:person.name,label:`${person.personId} · ${person.craft} · ${person.availability}`}))
  const assetsForSite=assets.filter(a=>!siteValue||String(a.site)===siteValue)
  const assetOptions=assetsForSite.map(a=>({value:a.assetnum,label:a.description?.trim()}))
  const locationOptions=[...new Set([...assetsForSite.map(a=>a.location),...workOrders.filter(o=>!siteValue||String(o.SITE)===siteValue).map(o=>o['LOCATION '])].filter(Boolean))].sort()
  const changeSite=e=>{setSiteValue(e.target.value);setAssetValue('');setLocationValue('')}
  const changeAsset=e=>{const value=e.target.value;setAssetValue(value);const match=assets.find(a=>cleanText(a.assetnum)===cleanText(value));setAssetDescription(match?.description?.trim()||'');if(match?.location)setLocationValue(match.location);if(match?.site)setSiteValue(String(match.site))}
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
      const availableQuantity = Math.max(0, Number(inventory.balance || 0) - Number(inventory.reserved || 0))
      const requestedQuantity = Number(resource.quantity || 0)
      return {
        availability: requestedQuantity > 0 && availableQuantity >= requestedQuantity ? 'Available' : 'Purchase Required',
        source: inventory.storeroom || 'Materials store',
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
  const overviewReady=Boolean(description.trim()&&siteValue&&assetValue&&assetDescription.trim()&&locationValue&&department&&assignedDepartment)
  const overviewMissing=[!description.trim()&&'Description',!siteValue&&'Site',!assetValue&&'Asset',!assetDescription.trim()&&'Asset Description',!locationValue&&'Location',!department&&'Department',!assignedDepartment&&'Assigned Department'].filter(Boolean)
  const plannedLaborReady=plannedLabor.some(row=>row.craft&&Number(row.hours)>0)
  const plannedMaterialsReady=plannedResources.some(row=>row.type==='Material'&&row.item&&Number(row.quantity)>0)
  const plannedToolsReady=plannedResources.some(row=>['Tool','Equipment'].includes(row.type)&&row.item&&Number(row.quantity)>0)
  const planReady=Boolean(plannedLaborReady&&(!isCM||(plannedMaterialsReady&&plannedToolsReady)))
  const failureReady=Boolean(!isCM||(failureClass&&problemCode))
  const actualMaterialsReady=!isCM||actualMaterials.some(row=>row.item&&Number(row.actualQuantity)>0)
  const actualToolsReady=!isCM||actualTools.some(row=>row.item&&Number(row.actualQuantity)>0)
  const actualReady=Boolean(technicianRemarks.trim()&&completionNotes.trim()&&actualLabor.trim()&&Number(actualHours)>0&&actualMaterialsReady&&actualToolsReady&&failureReady)
  const preparationReady=overviewReady&&planReady
  const status = selectedStatus
  const changeStatus=value=>{
    const next=normalizeWoStatus(value)
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
  const failureMissing=[isCM&&!failureClass&&'Failure: failure code',isCM&&!problemCode&&'Failure: problem code'].filter(Boolean)
  const actualMissing=[!technicianRemarks.trim()&&'Actual: technician remarks',!completionNotes.trim()&&'Actual: completion notes',!actualLabor.trim()&&'Actual: labor',!Number(actualHours)&&'Actual: labor hours',!actualMaterialsReady&&'Actual: materials',!actualToolsReady&&'Actual: tools'].filter(Boolean)
  const holdMissing=[materialBlocked&&'Material Requests: create PR or resolve stock',ptwBlocked&&'PTW & Files: attach permit file'].filter(Boolean)
  const workflowMissing=status==='WAPPR'?overviewMissing:status==='APPR'?[...overviewMissing]:status==='WSCH'||status==='SCHED'?[...overviewMissing,...planMissing,...holdMissing]:status==='HOLD'?holdMissing:status==='INPRG'?failureMissing:status==='COMP'?actualMissing:[]
  const workflowNextStep={
    WAPPR: overviewReady?'Select APPR when approval is granted':'Complete Work Order overview fields',
    APPR: 'Select WSCH when ready for scheduling',
    WSCH: preparationReady?'Select SCHED when scheduled':'Complete overview and plan requirements',
    SCHED: preparationReady?'Select INPRG when work starts':'Complete planning before starting work',
    HOLD: 'Resolve material or permit hold before continuing',
    INPRG: failureReady?'Select COMP when execution is completed':'Complete failure classification before completion',
    COMP: actualReady?'Select CLOSE after Actual tab is complete':'Complete Actual tab before closeout',
    CLOSE: 'Workflow complete'
  }[status] || 'Review the work order'
  const actualsEditable = true
  const number = order.WORKORDER || 'AUTO'
  const targetFinishTime=targetFinish?new Date(targetFinish).getTime():null
  const actualFinishTime=actualFinish?new Date(actualFinish).getTime():null
  const slaBreachedNow=Boolean(targetFinishTime&&((actualFinishTime&&actualFinishTime>targetFinishTime)||(!actualFinishTime&&Date.now()>targetFinishTime)))
  const slaLabel=!targetFinishTime?'Not defined':actualFinishTime?(slaBreachedNow?'No – SLA Breached':'Yes – SLA Met'):(slaBreachedNow?'No – SLA Breached':'Pending – Within SLA')
  const close = () => onClose()
  const reroute=()=>{setTab('Overview');setAssignedDepartment('');setSupervisor('');setWorkStarted(false);setWorkScheduled(false);setWorkWaitingSchedule(false);setWorkApproved(false)}
  const addFiles=(setter)=>event=>{const files=Array.from(event.target.files||[]).map(file=>({name:file.name,size:file.size>1048576?`${(file.size/1048576).toFixed(1)} MB`:`${Math.max(1,Math.round(file.size/1024))} KB`,type:file.type||'Document'}));setter(current=>[...current,...files]);event.target.value=''}
  const downloadFile=file=>{const blob=new Blob([`Mock CAFM attachment\n\nName: ${file.name}\nType: ${file.type||'Document'}\nSize: ${file.size||'Unknown'}\n\nReal storage integration can replace this generated download.`],{type:'text/plain'});const url=URL.createObjectURL(blob);const link=document.createElement('a');link.href=url;link.download=file.name?.includes('.')?file.name:`${file.name||'attachment'}.txt`;document.body.appendChild(link);link.click();link.remove();URL.revokeObjectURL(url)}
  const completeWork=()=>{if(!failureReady){setTab('Failure');return}const now=toDateTimeInput(new Date());setActualFinish(now);setActualStart(current=>current||now);setActualMaterials(current=>current.length?current:plannedResources.filter(row=>row.type==='Material').map(row=>({...row,actualQuantity:''})));setActualTools(current=>current.length?current:plannedResources.filter(row=>['Tool','Equipment'].includes(row.type)).map(row=>({...row,actualQuantity:''})));setWorkCompleted(true);setSelectedStatus('COMP')}
  const printWorkOrder=()=>{if(isPM&&tab!=='Plan')setTab('Plan');printWithoutBrowserTitle()}
  const saveChanges=async()=>{
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
      'METER READING': meterReading,
      'WATER CONSUMPTION': waterConsumption,
      'ENERGY CONSUMPTION': energyConsumption,
      'METER READING DATE': meterReadingDate
    }
    setAutoSaveState('Saving')
    const savedOrder = await saveWorkOrder(updatedOrder)
    onUpdateWorkOrder?.(number, savedOrder)
    setAutoSaveState('Saved')
  }
  useEffect(()=>{if(!saveReady.current){saveReady.current=true;return}setAutoSaveState('Unsaved changes')},[description,longDescription,priority,department,subDepartment,assignedDepartment,workGroup,supervisor,laborCraft,siteValue,assetValue,assetDescription,locationValue,targetStart,targetFinish,failureClass,problemCode,causeCode,remedyCode,plannedLabor,plannedResources,plannedTasks,ptwRequired,ptwFiles,generalFiles,technicianRemarks,completionNotes,actualLabor,actualHours,actualMaterials,actualTools,actualStart,actualFinish,meterReading,waterConsumption,energyConsumption,meterReadingDate,selectedStatus,workApproved,workWaitingSchedule,workScheduled,workStarted,workCompleted,workClosed])
  return <div className={page?'w-full':'fixed inset-0 z-50 overflow-auto bg-[color:color-mix(in_srgb,var(--app-sidebar-bg)_72%,transparent)] p-6 backdrop-blur-sm'}><div className={`${page?'mx-auto w-full max-w-[1400px] space-y-3 bg-transparent p-0':'mx-auto max-w-7xl space-y-4 rounded-3xl bg-[var(--app-panel)] p-0 shadow-2xl'} wo-screen`}>
    <WorkOrderHeader number={number} workType={workType} status={status} statusDescription={maximoWorkOrderStatusDescriptions[status] || status} description={description || order.DESCRIPTION || 'Enter work order information'} isPM={isPM} autoSaveState={autoSaveState} onSave={saveChanges} overviewReady={overviewReady} preparationReady={preparationReady} failureReady={failureReady} actualReady={actualReady} close={close} printWorkOrder={printWorkOrder} onStatusChange={changeStatus} statusOptions={statusOptions('workOrder').map(value=>({ value, label: statusDescription('workOrder', value) }))} />
    <WorkOrderTabs tabs={workOrderTabs} active={tab} onChange={setTab} showFailureDot={!isPM} />
    <WorkOrderWorkflowNotice status={status} missing={workflowMissing} nextStep={workflowNextStep} />
    <div className={workOrderBodyClass}>
      {tab==='Overview' && <WorkOrderOverviewTab number={number} status={status} workType={workType} priority={priority} setPriority={setPriority} description={description} setDescription={setDescription} siteValue={siteValue} changeSite={changeSite} siteOptions={siteOptions} longDescription={longDescription} setLongDescription={setLongDescription} assetValue={assetValue} changeAsset={changeAsset} assetOptions={assetOptions} locationValue={locationValue} setLocationValue={setLocationValue} locationOptions={locationOptions} assetDescription={assetDescription} setAssetDescription={setAssetDescription} department={department} setDepartment={setDepartment} departmentOptions={departmentOptions} subDepartment={subDepartment} setSubDepartment={setSubDepartment} subDepartmentOptions={subDepartmentOptions} assignedDepartment={assignedDepartment} setAssignedDepartment={setAssignedDepartment} setWorkGroup={setWorkGroup} setSupervisor={setSupervisor} workGroup={workGroup} workGroupOptions={workGroupOptions} supervisor={supervisor} supervisorOptions={supervisorOptions} laborCraft={laborCraft} setLaborCraft={setLaborCraft} laborCraftOptions={laborCraftOptions} reportedDate={toDateTimeInput(order['REPORTED DATE']||order['REPORT DATE'])||new Date().toISOString().slice(0,16)} targetStart={targetStart} setTargetStart={setTargetStart} targetFinish={targetFinish} setTargetFinish={setTargetFinish} actualStart={actualStart} setActualStart={setActualStart} actualFinish={actualFinish} setActualFinish={setActualFinish} slaLabel={slaLabel} isPM={isPM} />}
      {tab==='Plan' && <WorkOrderPlanTab isPM={isPM} plannedLabor={plannedLabor} setPlannedLabor={setPlannedLabor} plannedResources={plannedResources} setPlannedResources={setPlannedResources} plannedTasks={plannedTasks} setPlannedTasks={setPlannedTasks} plannedCraftOptions={plannedCraftOptions} plannedCrewOptions={plannedCrewOptions} materialMaster={materialMaster} toolMaster={toolMaster} updatePlanRow={updatePlanRow} updatePlannedResource={updatePlannedResource} updatePlannedResourceField={updatePlannedResourceField} />}
      {tab==='Actual' && <WorkOrderActualTab actualsEditable={actualsEditable} status={status} preparationReady={preparationReady} planReady={planReady} setTab={setTab} setWorkStarted={value=>{setWorkStarted(value);if(value)setSelectedStatus('INPRG')}} completeWork={completeWork} outlineButtonClass={workOrderOutlineButtonClass} primaryButtonClass={workOrderPrimaryButtonClass} targetStart={targetStart} targetFinish={targetFinish} actualFinish={actualFinish} setActualFinish={setActualFinish} slaBreachedNow={slaBreachedNow} slaLabel={slaLabel} technicianRemarks={technicianRemarks} setTechnicianRemarks={setTechnicianRemarks} completionNotes={completionNotes} setCompletionNotes={setCompletionNotes} actualLabor={actualLabor} setActualLabor={setActualLabor} laborCraft={laborCraft} setLaborCraft={setLaborCraft} actualHours={actualHours} setActualHours={setActualHours} actualStart={actualStart} setActualStart={setActualStart} actualMaterials={actualMaterials} setActualMaterials={setActualMaterials} actualTools={actualTools} setActualTools={setActualTools} updateActualRow={updateActualRow} workClosed={workClosed} />}
      {tab==='Failure' && <WorkOrderFailureTab isCM={isCM} failureClass={failureClass} changeFailure={changeFailure} failureClassOptions={failureClassOptions} problemCode={problemCode} setProblemCode={setProblemCode} setCauseCode={setCauseCode} setRemedyCode={setRemedyCode} problemOptions={problemOptions} causeCode={causeCode} causeOptions={causeOptions} remedyCode={remedyCode} remedyOptions={remedyOptions} failureDescription={failureDescription} problemDescription={problemDescription} causeDescription={causeDescription} remedyDescription={remedyDescription} failureCount={failureCodes.length} />}
      {tab==='Material Requests' && <WorkOrderMaterialRequestsTab resourceRequests={resourceRequests} plannedResources={plannedResources} setPlannedResources={setPlannedResources} updatePlanRow={updatePlanRow} getAvailability={resourceAvailability} materialBlocked={materialBlocked} primaryButtonClass={workOrderPrimaryButtonClass} outlineButtonClass={workOrderOutlineButtonClass} setTab={setTab} workOrderContext={{ number, site: siteValue, department: department || assignedDepartment, assignedDepartment }} onCreatePurchaseRequest={onCreatePurchaseRequest} onCreateReservation={onCreateReservation} />}
      {tab==='PTW & Files' && <WorkOrderDocumentsTab ptwRequired={ptwRequired} setPtwRequired={setPtwRequired} ptwFiles={ptwFiles} setPtwFiles={setPtwFiles} generalFiles={generalFiles} setGeneralFiles={setGeneralFiles} addFiles={addFiles} downloadFile={downloadFile} />}
      {tab==='Meters' && <WorkOrderMetersTab meterReading={meterReading} setMeterReading={setMeterReading} waterConsumption={waterConsumption} setWaterConsumption={setWaterConsumption} energyConsumption={energyConsumption} setEnergyConsumption={setEnergyConsumption} meterReadingDate={meterReadingDate} setMeterReadingDate={setMeterReadingDate} />}
    </div>
  </div><WorkOrderPrintReport number={number} description={description || order['DESCRIPITION '] || 'Work order'} workType={workType} status={status} priority={priority} siteValue={siteValue} department={department} subDepartment={subDepartment} assignedDepartment={assignedDepartment} locationValue={locationValue} assetValue={assetValue} assetDescription={assetDescription} targetStart={targetStart} targetFinish={targetFinish} actualStart={actualStart} actualFinish={actualFinish} slaLabel={slaLabel} jobPlan={jobPlanNumber} estimatedDuration={order['ESTIMATED DURATION']} pmNumber={order['PM NUMBER']} pmCycle={order['PM CYCLE']} plannedTasks={plannedTasks} plannedLabor={plannedLabor} plannedResources={plannedResources} ptwRequired={ptwRequired} ptwFiles={ptwFiles} generalFiles={generalFiles} meterReading={meterReading} waterConsumption={waterConsumption} energyConsumption={energyConsumption} meterReadingDate={meterReadingDate} failureClass={failureClass} problemCode={problemCode} causeCode={causeCode} remedyCode={remedyCode} technicianRemarks={technicianRemarks} completionNotes={completionNotes} actualLabor={actualLabor} actualHours={actualHours} actualMaterials={actualMaterials} actualTools={actualTools} /></div>
}

export default function App() {
  const { isAuthenticated } = useAuth()
  const cafm = useCafmData()
  const {
    assets,
    workOrders: allWorkOrders,
    setWorkOrders: setAllWorkOrders,
    serviceRequests,
    setServiceRequests,
    jobTasks,
    jobTaskRecords,
    setJobTaskRecords,
    purchaseRequests,
    purchaseOrders,
    reservations,
    failureCodes,
    failureClassOptions,
    uniqueCodeOptions,
    statusMatrix,
    excelDate,
    toDateTimeInput,
    slaBreached,
    locations,
    labor,
    materials,
    tools,
    departments,
    pmRecords,
    convertRequest,
    createPurchaseRequest,
    createPurchaseOrderFromRequest,
    updatePurchaseRequest,
    updatePurchaseOrder,
    createReservation,
    updateReservation,
    updateWorkOrder,
    createWorkOrder,
    generatePmWorkOrder,
    updateJobPlan
  } = cafm
  const [active, setActive] = useState(()=>routeToPage(window.location.pathname))
  const [search, setSearch] = useState('')
  const [mobileOpen, setMobileOpen] = useState(false)
  const workOrderNotifications = buildWorkOrderNotifications(allWorkOrders)
  const navigate = name => { setActive(name); setSearch(''); setMobileOpen(false); window.history.pushState({},'',pathForPage(name)) }
  const jobPlanRouteId = decodeURIComponent(window.location.pathname.split('/job-plans/')[1] || '')
  const jobPlanSummaryRows = [...new Map(jobTaskRecords.map(task => [task.JPNUM, {
    JPNUM: task.JPNUM,
    DESCRIPTION: task.DESCRIPTION,
    status: task.status || 'ACTIVE',
    taskCount: jobTaskRecords.filter(row => row.JPNUM === task.JPNUM).length,
    totalMinutes: jobTaskRecords.filter(row => row.JPNUM === task.JPNUM).reduce((sum, row) => sum + Math.max(1, Math.round(Number(row['TASK DURATION IN HOUR'] || 0) * 1440)), 0)
  }])).values()]
  const [selectedJobPlan,setSelectedJobPlan]=useState(jobPlanSummaryRows.find(plan => plan.JPNUM === jobPlanRouteId) || null)
  const failureRouteId = decodeURIComponent(window.location.pathname.split('/failure-library/')[1] || '')
  const failureClassRows = [...new Map(failureCodes.map(row => [row['FAILURE CLASS ID'], row])).values()]
  const [selectedFailureClass,setSelectedFailureClass]=useState(failureClassRows.find(row => row['FAILURE CLASS ID'] === failureRouteId) || null)
  useEffect(() => {
    const syncRoute = () => {
      const nextPage = routeToPage(window.location.pathname)
      setActive(nextPage)
      setSearch('')
      setMobileOpen(false)

      const nextJobPlanId = decodeURIComponent(window.location.pathname.split('/job-plans/')[1] || '')
      setSelectedJobPlan(jobPlanSummaryRows.find(plan => plan.JPNUM === nextJobPlanId) || null)

      const nextFailureId = decodeURIComponent(window.location.pathname.split('/failure-library/')[1] || '')
      setSelectedFailureClass(failureClassRows.find(row => row['FAILURE CLASS ID'] === nextFailureId) || null)
    }

    window.addEventListener('popstate', syncRoute)
    return () => window.removeEventListener('popstate', syncRoute)
  }, [jobPlanSummaryRows, failureClassRows])
  const openConvertedWorkOrder=number=>{setActive('Work Orders');setSearch('');window.history.pushState({},'',`/work-orders/${number}`)}
  const pages = {
    'Job Requests': <ServiceRequestsPage onConvert={convertRequest} onOpenWorkOrder={openConvertedWorkOrder} requests={serviceRequests} setRequests={setServiceRequests} assets={assets} workOrders={allWorkOrders} failureOptions={failureClassOptions}/>,
    'Incidents': <IncidentsPage rows={cafm.incidents} setRows={cafm.setIncidents} onUpdateIncident={cafm.updateIncident}/>,
    'Work Orders': <WorkOrdersPage rows={allWorkOrders} assets={assets} onCreate={createWorkOrder} onImportRows={setAllWorkOrders} EditorComponent={props => <WorkOrderEditor {...props} masterData={cafm} onCreatePurchaseRequest={createPurchaseRequest} onCreateReservation={createReservation} onUpdateWorkOrder={updateWorkOrder} />} excelDate={excelDate} slaBreached={slaBreached}/>,
    'Assets': <AssetsPage rows={assets} setRows={cafm.setAssets} workOrders={allWorkOrders} onUpdateAsset={cafm.updateAsset} />,
    'Preventive Maintenance': <PreventiveMaintenancePage plans={cafm.pmSchedules} setPlans={cafm.setPmSchedules} departments={departments} assets={assets} jobTasks={jobTasks} workOrders={allWorkOrders} onGenerate={generatePmWorkOrder} onOpenWorkOrder={openConvertedWorkOrder}/>,
    'Meters': <MetersPage rows={cafm.meters} setRows={cafm.setMeters} onUpdateMeter={cafm.updateMeter} assets={assets} workOrders={allWorkOrders} />,
    'Locations': <LocationsPage rows={locations} setRows={cafm.setLocations} assets={assets} workOrders={allWorkOrders} onUpdateLocation={cafm.updateLocation}/>,
    'Job Plans': selectedJobPlan ? <JobPlanDetailPage plan={selectedJobPlan} tasks={jobTaskRecords.filter(task=>task.JPNUM===selectedJobPlan.JPNUM)} workOrders={allWorkOrders.filter(order=>getWorkOrderJobPlan(order)===selectedJobPlan.JPNUM)} onBack={()=>{setSelectedJobPlan(null);window.history.pushState({},'','/job-plans')}} onUpdate={updateJobPlan}/> : <RegisterPage title="Job plans" eyebrow="MAINTENANCE" description="Standard task sequences and estimated durations for technicians." rows={jobPlanSummaryRows} search={search} setSearch={setSearch} action="New job plan" modalTitle="Add job plan" modalNote="Create a job plan task line with sequence, instructions, and estimated duration." modalFields={[
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
    'Labor': <LaborPage rows={labor} setRows={cafm.setLabor} workOrders={allWorkOrders} onUpdateLabor={cafm.updateLabor}/>,
    'Materials': <MaterialsPage rows={materials} setRows={cafm.setMaterials} workOrders={allWorkOrders} onUpdateMaterial={cafm.updateMaterial}/>,
    'Purchase Requisitions': <PurchaseRequestsPage rows={purchaseRequests} onApproveRequest={createPurchaseOrderFromRequest} onUpdateRequest={updatePurchaseRequest}/>,
    'Purchase Orders': <PurchaseOrdersPage rows={purchaseOrders} onUpdateOrder={updatePurchaseOrder} onUpdateRequest={updatePurchaseRequest}/>,
    'Reservations': <ReservationsPage rows={reservations} onUpdate={updateReservation}/>,
    'Tools & Equipment': <ToolsPage rows={tools} setRows={cafm.setTools} workOrders={allWorkOrders} onUpdateTool={cafm.updateTool}/>,
    'Users': <UsersPage rows={cafm.users} setRows={cafm.setUsers} laborRows={labor} onUpdateUser={cafm.updateUser}/>,
    'Roles & Permissions': <RolesPermissionsPage/>,
    'Settings': <SettingsPage/>
  }
  if (!isAuthenticated) return <LoginPage />

  return (
    <AppShell
      active={active}
      navigation={navigationItems}
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
      {active === 'Overview' ? <OverviewPage onNavigate={navigate} assets={assets} excelDate={excelDate} failureCodes={failureCodes} pmRecords={pmRecords} workOrders={allWorkOrders} purchaseRequests={purchaseRequests} purchaseOrders={purchaseOrders} reservations={reservations} /> : pages[active]}
    </AppShell>
  )
}




























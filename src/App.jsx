import { useEffect, useRef, useState } from 'react'
import departments from './data/departments.json'
import laborMaster from './data/labor.json'
import materialMaster from './data/materials.json'
import toolMaster from './data/tools.json'
import ServiceRequestsPage, { initialRequests as serviceRequestSeed } from './pages/ServiceRequestsPage'
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
import ReservationsPage from './pages/ReservationsPage'
import AppShell from './components/layout/AppShell'
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
import { useAuth } from './providers/AuthProvider'
import { statusDescription } from './lib/statusMatrix'


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


const workOrderTabs = ['Overview', 'Plan', 'Failure', 'Material Requests', 'PTW & Files', 'Meters', 'Actual']
const workOrderBodyClass = 'grid gap-3 p-0'
const toLocationPriority = value => {
  const text = String(value || '').trim()
  if (text.startsWith('1') || text === 'Emergency') return 1
  if (text.startsWith('2') || text === 'High') return 2
  return 3
}
const maximoWorkOrderStatusDescriptions = new Proxy({}, { get: (_, status) => statusDescription('workOrder', status) })

function WorkOrderEditor({ order, onClose, page = false, onCreatePurchaseRequest, onCreateReservation, onUpdateWorkOrder }) {
  const workType=(order['WORK TYPE '] || order['WORK TYPE  '] || 'CM').trim()
  const isPM = workType === 'PM'
  const isCM = workType === 'CM'
  const [tab, setTab] = useState('Overview')
  const [autoSaveState,setAutoSaveState]=useState('Saved')
  const saveReady = useRef(false)
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
  const [assetDescription,setAssetDescription]=useState(assets.find(asset=>asset.assetnum===order.ASSET)?.description?.trim()||'')
  const [locationValue,setLocationValue]=useState(order['LOCATION ']||'')
  const [failureClass,setFailureClass]=useState(order['FAILURE CODE']||'')
  const [problemCode,setProblemCode]=useState(order['PROBLEM CODE']||'')
  const [causeCode,setCauseCode]=useState(order['CAUSE CODE']||'')
  const [remedyCode,setRemedyCode]=useState(order['REMEDY CODE']||'')
  const jobPlanNumber = order['JOB PLAN'] || order.JPNUM || ''
  const jobPlanTaskRows = order['JOB PLAN TASKS']?.length ? order['JOB PLAN TASKS'] : jobPlanNumber ? jobTasks.filter(task => task.JPNUM === jobPlanNumber) : []
  const [plannedLabor,setPlannedLabor]=useState(isPM?[{craft:'HVAC Technician',hours:'2',crew:'HVAC Team A'}]:[{craft:'',hours:'',crew:''}])
  const [plannedResources,setPlannedResources]=useState([])
  const [plannedTasks,setPlannedTasks]=useState(isPM?jobPlanTaskRows.map(task=>({sequence:task['JOB TASK SEQUENCE'],description:task['JOB TASK DESCRIPTION'],duration:Math.max(5,Math.round(Number(task['TASK DURATION IN HOUR'])*1440))})):[{sequence:10,description:'',duration:''}])
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
  const changeAsset=e=>{const value=e.target.value;setAssetValue(value);const match=assets.find(a=>a.assetnum===value);setAssetDescription(match?.description?.trim()||'');if(match?.location)setLocationValue(match.location);if(match?.site)setSiteValue(String(match.site))}
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
  const status = workClosed ? 'CLOSE' : workCompleted ? 'COMP' : workStarted ? 'INPRG' : (materialBlocked || ptwBlocked) ? 'HOLD' : workScheduled ? 'SCHED' : workWaitingSchedule ? 'WSCH' : workApproved ? 'APPR' : 'WAPPR'
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
  const completeWork=()=>{if(!failureReady){setTab('Failure');return}const now=toDateTimeInput(new Date());setActualFinish(now);setActualStart(current=>current||now);setActualMaterials(current=>current.length?current:plannedResources.filter(row=>row.type==='Material').map(row=>({...row,actualQuantity:''})));setActualTools(current=>current.length?current:plannedResources.filter(row=>['Tool','Equipment'].includes(row.type)).map(row=>({...row,actualQuantity:''})));setWorkCompleted(true)}
  const printWorkOrder=()=>{if(isPM&&tab!=='Plan')setTab('Plan');setTimeout(()=>window.print(),60)}
  const saveChanges=()=>{
    const updatedOrder = {
      ...order,
      WORKORDER: number,
      'DESCRIPITION ': description,
      'LONG DESCRIPTION': longDescription,
      PRIORTY: Number(String(priority).charAt(0)) || Number(priority) || 3,
      SITE: siteValue,
      ASSET: assetValue,
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
      'JOB PLAN TASKS': plannedTasks,
      'PLANNED LABOR': plannedLabor,
      'PLANNED RESOURCES': plannedResources,
      'METER READING': meterReading,
      'WATER CONSUMPTION': waterConsumption,
      'ENERGY CONSUMPTION': energyConsumption,
      'METER READING DATE': meterReadingDate
    }
    setAutoSaveState('Saving')
    onUpdateWorkOrder?.(number, updatedOrder)
    setTimeout(()=>setAutoSaveState('Saved'),350)
  }
  useEffect(()=>{if(!saveReady.current){saveReady.current=true;return}setAutoSaveState('Unsaved changes')},[description,longDescription,priority,department,subDepartment,assignedDepartment,workGroup,supervisor,laborCraft,siteValue,assetValue,assetDescription,locationValue,targetStart,targetFinish,failureClass,problemCode,causeCode,remedyCode,plannedLabor,plannedResources,plannedTasks,ptwRequired,ptwFiles,generalFiles,technicianRemarks,completionNotes,actualLabor,actualHours,actualMaterials,actualTools,actualStart,actualFinish,meterReading,waterConsumption,energyConsumption,meterReadingDate,workApproved,workWaitingSchedule,workScheduled,workStarted,workCompleted,workClosed])
  return <div className={page?'w-full':'fixed inset-0 z-50 overflow-auto bg-[color:color-mix(in_srgb,var(--app-sidebar-bg)_72%,transparent)] p-6 backdrop-blur-sm'}><div className={`${page?'mx-auto w-full max-w-[1400px] space-y-3 bg-transparent p-0':'mx-auto max-w-7xl space-y-4 rounded-3xl bg-[var(--app-panel)] p-0 shadow-2xl'} wo-screen`}>
    <WorkOrderHeader number={number} workType={workType} status={status} statusDescription={maximoWorkOrderStatusDescriptions[status] || status} description={order['DESCRIPITION '] || order.DESCRIPTION || 'Enter work order information'} isPM={isPM} autoSaveState={autoSaveState} onSave={saveChanges} overviewReady={overviewReady} preparationReady={preparationReady} failureReady={failureReady} actualReady={actualReady} close={close} reroute={reroute} printWorkOrder={printWorkOrder} setWorkApproved={setWorkApproved} setWorkWaitingSchedule={setWorkWaitingSchedule} setWorkScheduled={setWorkScheduled} setWorkStarted={setWorkStarted} completeWork={completeWork} setWorkClosed={setWorkClosed} />
    <WorkOrderTabs tabs={workOrderTabs} active={tab} onChange={setTab} showFailureDot={!isPM} />
    <div className={workOrderBodyClass}>
      {tab==='Overview' && <WorkOrderOverviewTab number={number} status={status} workType={workType} priority={priority} setPriority={setPriority} description={description} setDescription={setDescription} siteValue={siteValue} changeSite={changeSite} siteOptions={siteOptions} longDescription={longDescription} setLongDescription={setLongDescription} assetValue={assetValue} changeAsset={changeAsset} assetOptions={assetOptions} locationValue={locationValue} setLocationValue={setLocationValue} locationOptions={locationOptions} assetDescription={assetDescription} setAssetDescription={setAssetDescription} department={department} setDepartment={setDepartment} departmentOptions={departmentOptions} subDepartment={subDepartment} setSubDepartment={setSubDepartment} subDepartmentOptions={subDepartmentOptions} assignedDepartment={assignedDepartment} setAssignedDepartment={setAssignedDepartment} setWorkGroup={setWorkGroup} setSupervisor={setSupervisor} workGroup={workGroup} workGroupOptions={workGroupOptions} supervisor={supervisor} supervisorOptions={supervisorOptions} laborCraft={laborCraft} setLaborCraft={setLaborCraft} laborCraftOptions={laborCraftOptions} reportedDate={toDateTimeInput(order['REPORTED DATE']||order['REPORT DATE'])||new Date().toISOString().slice(0,16)} targetStart={targetStart} setTargetStart={setTargetStart} targetFinish={targetFinish} setTargetFinish={setTargetFinish} actualStart={actualStart} setActualStart={setActualStart} actualFinish={actualFinish} setActualFinish={setActualFinish} slaLabel={slaLabel} isPM={isPM} />}
      {tab==='Plan' && <WorkOrderPlanTab isPM={isPM} plannedLabor={plannedLabor} setPlannedLabor={setPlannedLabor} plannedResources={plannedResources} setPlannedResources={setPlannedResources} plannedTasks={plannedTasks} setPlannedTasks={setPlannedTasks} plannedCraftOptions={plannedCraftOptions} plannedCrewOptions={plannedCrewOptions} materialMaster={materialMaster} toolMaster={toolMaster} updatePlanRow={updatePlanRow} updatePlannedResource={updatePlannedResource} updatePlannedResourceField={updatePlannedResourceField} />}
      {tab==='Actual' && <WorkOrderActualTab actualsEditable={actualsEditable} status={status} preparationReady={preparationReady} planReady={planReady} setTab={setTab} setWorkStarted={setWorkStarted} completeWork={completeWork} outlineButtonClass={workOrderOutlineButtonClass} primaryButtonClass={workOrderPrimaryButtonClass} targetStart={targetStart} targetFinish={targetFinish} actualFinish={actualFinish} setActualFinish={setActualFinish} slaBreachedNow={slaBreachedNow} slaLabel={slaLabel} technicianRemarks={technicianRemarks} setTechnicianRemarks={setTechnicianRemarks} completionNotes={completionNotes} setCompletionNotes={setCompletionNotes} actualLabor={actualLabor} setActualLabor={setActualLabor} laborCraft={laborCraft} setLaborCraft={setLaborCraft} actualHours={actualHours} setActualHours={setActualHours} actualStart={actualStart} setActualStart={setActualStart} actualMaterials={actualMaterials} setActualMaterials={setActualMaterials} actualTools={actualTools} setActualTools={setActualTools} updateActualRow={updateActualRow} workClosed={workClosed} />}
      {tab==='Failure' && <WorkOrderFailureTab isCM={isCM} failureClass={failureClass} changeFailure={changeFailure} failureClassOptions={failureClassOptions} problemCode={problemCode} setProblemCode={setProblemCode} setCauseCode={setCauseCode} setRemedyCode={setRemedyCode} problemOptions={problemOptions} causeCode={causeCode} causeOptions={causeOptions} remedyCode={remedyCode} remedyOptions={remedyOptions} failureDescription={failureDescription} problemDescription={problemDescription} causeDescription={causeDescription} remedyDescription={remedyDescription} failureCount={failureCodes.length} />}
      {tab==='Material Requests' && <WorkOrderMaterialRequestsTab resourceRequests={resourceRequests} plannedResources={plannedResources} setPlannedResources={setPlannedResources} updatePlanRow={updatePlanRow} getAvailability={resourceAvailability} materialBlocked={materialBlocked} primaryButtonClass={workOrderPrimaryButtonClass} outlineButtonClass={workOrderOutlineButtonClass} setTab={setTab} workOrderContext={{ number, site: siteValue, department: department || assignedDepartment, assignedDepartment }} onCreatePurchaseRequest={onCreatePurchaseRequest} onCreateReservation={onCreateReservation} />}
      {tab==='PTW & Files' && <WorkOrderDocumentsTab ptwRequired={ptwRequired} setPtwRequired={setPtwRequired} ptwFiles={ptwFiles} setPtwFiles={setPtwFiles} generalFiles={generalFiles} setGeneralFiles={setGeneralFiles} addFiles={addFiles} downloadFile={downloadFile} />}
      {tab==='Meters' && <WorkOrderMetersTab meterReading={meterReading} setMeterReading={setMeterReading} waterConsumption={waterConsumption} setWaterConsumption={setWaterConsumption} energyConsumption={energyConsumption} setEnergyConsumption={setEnergyConsumption} meterReadingDate={meterReadingDate} setMeterReadingDate={setMeterReadingDate} />}
    </div>
  </div><WorkOrderPrintReport number={number} description={description || order['DESCRIPITION '] || 'Work order'} workType={workType} status={status} priority={priority} siteValue={siteValue} department={department} subDepartment={subDepartment} assignedDepartment={assignedDepartment} locationValue={locationValue} assetValue={assetValue} assetDescription={assetDescription} targetStart={targetStart} targetFinish={targetFinish} actualStart={actualStart} actualFinish={actualFinish} slaLabel={slaLabel} jobPlan={order['JOB PLAN']} estimatedDuration={order['ESTIMATED DURATION']} pmNumber={order['PM NUMBER']} pmCycle={order['PM CYCLE']} plannedTasks={plannedTasks} plannedLabor={plannedLabor} plannedResources={plannedResources} ptwRequired={ptwRequired} ptwFiles={ptwFiles} generalFiles={generalFiles} meterReading={meterReading} waterConsumption={waterConsumption} energyConsumption={energyConsumption} meterReadingDate={meterReadingDate} failureClass={failureClass} problemCode={problemCode} causeCode={causeCode} remedyCode={remedyCode} technicianRemarks={technicianRemarks} completionNotes={completionNotes} actualLabor={actualLabor} actualHours={actualHours} actualMaterials={actualMaterials} actualTools={actualTools} /></div>
}

export default function App() {
  const { isAuthenticated } = useAuth()
  const [active, setActive] = useState(()=>routeToPage(window.location.pathname))
  const [search, setSearch] = useState('')
  const [mobileOpen, setMobileOpen] = useState(false)
  const [allWorkOrders,setAllWorkOrders]=useState(workOrders)
  const [serviceRequests,setServiceRequests]=useState(serviceRequestSeed)
  const [purchaseRequests,setPurchaseRequests]=useState([])
  const [purchaseOrders,setPurchaseOrders]=useState([])
  const [reservations,setReservations]=useState([])
  const workOrderNotifications = buildWorkOrderNotifications(allWorkOrders)
  const navigate = name => { setActive(name); setSearch(''); setMobileOpen(false); window.history.pushState({},'',pathForPage(name)) }
  const convertRequest = request => {
    const number=String(56545135+allWorkOrders.filter(o=>String(o.WORKORDER).startsWith('56545')).length-3)
    const cm={'WORKORDER':number,'DESCRIPITION ':request.description,'LOCATION ':request.location,'LOCATION PRIORTY':toLocationPriority(request.priority),'ASSET':request.asset||'Unassigned','STATUS':'WAPPR','WORK TYPE ':'CM','STATUS DESCRIPITION':'Waiting for Approval','DEPARTMENT ':request.assignedDepartment||request.department,'SUB DEPARTMENT  NAME':request.subDepartment||'','PRIORTY':request.priority==='Emergency'?1:request.priority==='High'?2:3,'SITE':request.site,'TARGET START ':null,'TARGET FINISH ':null,'SOURCE SR':request.sr,'FAILURE CODE':request.failureCode||'','PROBLEM CODE':request.problemCode||'','CAUSE CODE':request.causeCode||'','REMEDY CODE':request.remedyCode||''}
    setAllWorkOrders(rows=>rows.some(o=>o['SOURCE SR']===request.sr)?rows:[...rows,cm])
    return cm
  }
  const openConvertedWorkOrder=number=>{setActive('Work Orders');setSearch('');window.history.pushState({},'',`/work-orders/${number}`)}
  const todayStamp=()=>new Date().toISOString().slice(0,10)
  const createPurchaseRequest=record=>{
    const existing=purchaseRequests.find(row=>row.workOrder===record.workOrder&&row.item===record.item)
    if(existing) return existing
    const created={purchaseRequest:`PR-2026-${String(purchaseRequests.length+1).padStart(4,'0')}`,status:'WAPPR',statusDescription:statusDescription('purchaseRequisition','WAPPR'),createdAt:todayStamp(),...record}
    setPurchaseRequests(rows=>rows.some(row=>row.workOrder===created.workOrder&&row.item===created.item)?rows:[created,...rows])
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
  const createWorkOrder=form=>{const next=Math.max(...allWorkOrders.map(order=>Number(order.WORKORDER)||0),56545134)+1;const created={'WORKORDER':String(next),'DESCRIPITION ':form.description,'LOCATION ':form.location,'LOCATION PRIORTY':toLocationPriority(form.priority),'ASSET':form.asset,'STATUS':'WAPPR','WORK TYPE ':form.type,'STATUS DESCRIPITION':'Waiting for Approval','DEPARTMENT ':'','SUB DEPARTMENT  NAME':'','PRIORTY':Number(String(form.priority).charAt(0))||3,'SITE':form.site,'TARGET START ':null,'TARGET FINISH ':null};setAllWorkOrders(rows=>[...rows,created]);return created}
  const generatePmWorkOrder=(pm,tasks)=>setAllWorkOrders(rows=>rows.some(order=>order['PM NUMBER']===pm.pmNumber&&order['PM CYCLE']===pm.cycle)?rows:[...rows,{'WORKORDER':pm.workOrder,'DESCRIPITION ':pm.description,'LOCATION ':pm.location,'LOCATION PRIORTY':3,'ASSET':pm.asset,'STATUS':pm.woStatus||'WSCH','WORK TYPE ':'PM','STATUS DESCRIPITION':maximoWorkOrderStatusDescriptions[pm.woStatus||'WSCH']||'Waiting for Schedule','DEPARTMENT ':pm.department,'SUB DEPARTMENT  NAME':pm.subDepartment,'ASSIGNED DEPARTMENT':pm.department,'PRIORTY':3,'SITE':pm.site,'TARGET START ':pm.startDate,'TARGET FINISH ':pm.startDate,'PM NUMBER':pm.pmNumber,'PM CYCLE':pm.cycle,'JOB PLAN':pm.jobPlan,'JOB PLAN TASKS':tasks,'ESTIMATED DURATION':tasks.reduce((sum,task)=>sum+Number(task['TASK DURATION IN HOUR']||0),0)*24,'ROUTE':pm.route,'LEAD TIME (DAYS)':pm.leadTime,'FREQUENCY':pm.frequency,'FREQUNIT':pm.freqUnit,'PMCOUNTER':pm.pmCounter,'STORELOC':pm.storeLocation,'SUPERVISOR':pm.supervisor,'LEAD':pm.lead,'PERSONGROUP':pm.personGroup,'PM STATUS':pm.pmStatus}])
  const pages = {
    'Job Requests': <ServiceRequestsPage onConvert={convertRequest} onOpenWorkOrder={openConvertedWorkOrder} requests={serviceRequests} setRequests={setServiceRequests} assets={assets} workOrders={allWorkOrders} failureOptions={failureClassOptions}/>,
    'Incidents': <IncidentsPage/>,
    'Work Orders': <WorkOrdersPage rows={allWorkOrders} assets={assets} onCreate={createWorkOrder} onImportRows={setAllWorkOrders} EditorComponent={props => <WorkOrderEditor {...props} onCreatePurchaseRequest={createPurchaseRequest} onCreateReservation={createReservation} onUpdateWorkOrder={updateWorkOrder} />} excelDate={excelDate} slaBreached={slaBreached}/>,
    'Assets': <AssetsPage initialAssets={assets} workOrders={allWorkOrders} />,
    'Preventive Maintenance': <PreventiveMaintenancePage assets={assets} jobTasks={jobTasks} workOrders={allWorkOrders} onGenerate={generatePmWorkOrder} onOpenWorkOrder={openConvertedWorkOrder}/>,
    'Meters': <MetersPage assets={assets} workOrders={allWorkOrders} />,
    'Locations': <LocationsPage initialLocations={locations}/>,
    'Job Plans': <RegisterPage title="Job plans" eyebrow="MAINTENANCE" description="Standard task sequences and estimated durations for technicians." rows={jobTasks} search={search} setSearch={setSearch} action="New job plan" modalTitle="Add job plan" modalNote="Create a job plan task line with sequence, instructions, and estimated duration." modalFields={[
      { key: 'JPNUM', label: 'Job Plan', required: true, placeholder: 'JP415004' },
      { key: 'DESCRIPTION', label: 'Plan Description', required: true, full: true },
      { key: 'JOB TASK SEQUENCE', label: 'Task Sequence', required: true, type: 'number', defaultValue: 10 },
      { key: 'JOB TASK DESCRIPTION', label: 'Task Description', required: true, full: true },
      { key: 'TASK DURATION IN HOUR', label: 'Duration in Hours', required: true, type: 'number', defaultValue: 1 }
    ]} mapFormToRow={form => ({ ...form, 'TASK DURATION IN HOUR': Number(form['TASK DURATION IN HOUR'] || 0) })} columns={[
      {key:'JPNUM',label:'Plan',render:v=><strong className="mono">{v}</strong>},{key:'DESCRIPTION',label:'Plan description'},{key:'JOB TASK SEQUENCE',label:'Sequence'},{key:'JOB TASK DESCRIPTION',label:'Task'},{key:'TASK DURATION IN HOUR',label:'Duration',render:v=>`${Math.round(Number(v)*1440)} min`}
    ]}/>,
    'Failure Library': <RegisterPage title="Failure library" eyebrow="RELIABILITY" description="Search the bilingual Maximo problem, cause, and remedy hierarchy." rows={failureCodes} search={search} setSearch={setSearch} action="Add code" modalTitle="Add failure code" modalNote="Create a failure hierarchy record. Cause and remedy can stay optional." modalFields={[
      { key: 'FAILURE CLASS ID', label: 'Failure Class ID', required: true, placeholder: 'HVAC' },
      { key: 'DESCRIPTION', label: 'Class Description', required: true, full: true },
      { key: 'PROBLEM CODE', label: 'Problem Code', required: true },
      { key: 'PC - DESCRIPTION', label: 'Problem Description', required: true, full: true },
      { key: 'CAUSE CODE', label: 'Cause Code' },
      { key: 'CC - DESCRIPTION', label: 'Cause Description', full: true },
      { key: 'REMEDY CODE', label: 'Remedy Code' },
      { key: 'RC - DESCRIPTION', label: 'Remedy Description', full: true }
    ]} columns={[
      {key:'FAILURE CLASS ID',label:'Class',render:v=><strong className="mono">{v}</strong>},{key:'DESCRIPTION',label:'Class description'},{key:'PROBLEM CODE',label:'Problem code'},{key:'PC - DESCRIPTION',label:'Problem description'},{key:'CAUSE CODE',label:'Cause'}
    ]}/>,
    'Labor': <LaborPage/>,
    'Materials': <MaterialsPage/>,
    'Purchase Requests': <PurchaseRequestsPage rows={purchaseRequests} purchaseOrders={purchaseOrders} onApproveRequest={createPurchaseOrderFromRequest} onUpdateRequest={updatePurchaseRequest} onUpdateOrder={updatePurchaseOrder}/>,
    'Reservations': <ReservationsPage rows={reservations} onUpdate={updateReservation}/>,
    'Tools & Equipment': <ToolsPage/>,
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
      {active === 'Overview' ? <OverviewPage onNavigate={navigate} workOrders={allWorkOrders} purchaseRequests={purchaseRequests} purchaseOrders={purchaseOrders} reservations={reservations} /> : pages[active]}
    </AppShell>
  )
}




























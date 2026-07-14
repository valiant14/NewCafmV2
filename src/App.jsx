import { useEffect, useState } from 'react'
import {
  Bell, Boxes, CalendarClock, Check, ChevronRight, ClipboardList,
  Command, Filter, LayoutDashboard, MapPin, Menu, MoreHorizontal,
  ShieldCheck, SlidersHorizontal, Sparkles, Users, Wrench, X,
  Printer, RotateCcw, PackageCheck, Gauge, FileText, AlertTriangle
} from 'lucide-react'
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
import Badge from './components/ui/Badge'
import Button from './components/ui/Button'
import Field from './components/ui/Field'
import Section from './components/ui/Section'
import AppShell from './components/layout/AppShell'
import WorkOrderDocumentsTab from './components/work-orders/WorkOrderDocumentsTab'
import WorkOrderPrintReport from './components/work-orders/WorkOrderPrintReport'
import WorkOrderPlanTab from './components/work-orders/WorkOrderPlanTab'
import WorkOrderActualTab from './components/work-orders/WorkOrderActualTab'
import WorkOrderFailureTab from './components/work-orders/WorkOrderFailureTab'
import WorkOrderMaterialRequestsTab from './components/work-orders/WorkOrderMaterialRequestsTab'
import WorkOrderOverviewTab from './components/work-orders/WorkOrderOverviewTab'
import { navigationItems, pathForPage, routeToPage } from './config/navigation'
import { assets, workOrders, pmRecords, jobTasks, failureCodes, locations, statusMatrix, failureClassOptions, uniqueCodeOptions, excelDate, toDateTimeInput, slaBreached } from './data/cafmData'


const nav = [
  ['Overview', LayoutDashboard], ['Job Requests', FileText], ['Incidents', AlertTriangle], ['Work Orders', ClipboardList], ['Assets', Boxes],
  ['Preventive Maintenance', CalendarClock], ['Locations', MapPin], ['Job Plans', Wrench],
  ['Failure Library', ShieldCheck], ['Labor', Users], ['Materials', PackageCheck], ['Tools & Equipment', Wrench]
]

const initials = (name) => name.split(' ').map(part => part[0]).join('').slice(0, 2).toUpperCase()

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
const workOrderTabHelp = {
  Overview: 'Core information, asset, assignment, and execution notes.',
  Plan: 'Define the labor, job plan, tasks, materials, and tools expected for the work.',
  Failure: 'Classify the failure hierarchy. Required before closing CM work orders.',
  Actual: 'Section 7 Actual: record actual labor, spare parts, tools, equipment, and closeout details.',
  'Material Requests': 'Request materials, tools, and equipment directly from the work order.',
  'PTW & Files': 'Manage permits to work, photos, and supporting documents.',
  Meters: 'Capture optional asset, water, and energy readings.'
}

const formGridClass = 'grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4'
const workOrderBodyClass = 'grid gap-3 p-0'
const workOrderTabsClass = 'flex overflow-auto border-b border-[var(--app-line)] bg-transparent'
const workOrderTabClass = active => [
  'relative flex items-center gap-1.5 whitespace-nowrap px-3 py-3 text-[length:var(--app-tab-font-size)] text-[var(--app-muted)] transition hover:text-[var(--app-primary)]',
  active ? 'font-bold text-[var(--app-ink)] after:absolute after:bottom-0 after:left-2.5 after:right-2.5 after:h-0.5 after:bg-[var(--app-primary)]' : ''
].join(' ')
const workOrderTabIndexClass = 'text-[length:var(--app-tab-index-font-size)] font-bold text-[var(--app-muted)]'
const workOrderHeaderClass = 'grid gap-3 border-b border-[var(--app-line)] bg-transparent pb-3'
const workOrderHeaderTopClass = 'flex flex-wrap items-start justify-between gap-3'
const workOrderBackClass = 'inline-flex text-[length:var(--app-topbar-font-size)] font-bold text-[var(--app-muted)] transition hover:text-[var(--app-primary)]'
const workOrderTitleClass = 'text-[clamp(24px,var(--app-page-title-font-size),34px)] font-extrabold tracking-[-.045em] text-[var(--app-ink)]'
const workOrderDescriptionClass = 'mt-1 text-[length:var(--app-page-description-font-size)] text-[var(--app-muted)]'
const workOrderHeaderActionsClass = 'flex flex-wrap items-center justify-end gap-2'
const modeNoteClass = tone => [
  'flex items-start gap-3 rounded-2xl p-4',
  tone === 'warning' ? 'bg-[#fff7ef] text-[#9a5a2f]' : tone === 'actual' ? 'bg-[#eef7fb] text-[#44798b]' : 'bg-[#eef7f1] text-[#356c52]'
].join(' ')
const uploadZoneClass = 'relative grid min-h-28 cursor-pointer place-items-center content-center gap-2 rounded-2xl border border-dashed border-[#bfc9c1] bg-[#f8faf7] p-5 text-center text-[#728078]'
const documentRowClass = 'flex items-center gap-3 border-b border-[#edf0ec] p-3 last:border-b-0'
const autosaveClass = state => `inline-flex h-9 items-center gap-2 rounded-xl px-3 text-xs font-bold ${state === 'Saving' ? 'bg-[#f1f3f0] text-[#7b857f]' : 'bg-[#edf4ef] text-[#47785f]'}`
const autoStatusClass = 'inline-flex h-9 items-center gap-2 rounded-xl bg-[#f7faf7] px-3 text-xs text-[var(--app-muted)] [&_strong]:text-[var(--app-ink)]'
const woPrimaryButtonClass = 'inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-transparent bg-[var(--app-primary)] px-4 text-xs font-bold text-white shadow-[0_8px_20px_rgba(49,90,71,.18)] transition hover:brightness-95 disabled:cursor-not-allowed disabled:opacity-50'
const woOutlineButtonClass = 'inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-[#dfe5df] bg-white px-4 text-xs font-bold text-[#57645d] transition hover:bg-[#f7faf7] disabled:cursor-not-allowed disabled:opacity-50'

function WorkOrderEditor({ order, onClose, page = false }) {
  const workType=(order['WORK TYPE '] || order['WORK TYPE  '] || 'CM').trim()
  const isPM = workType === 'PM'
  const isCM = workType === 'CM'
  const [tab, setTab] = useState('Overview')
  const [autoSaveState,setAutoSaveState]=useState('Saved')
  const [workCompleted,setWorkCompleted]=useState(['COMP','COMPLETED','CLOSE','CLOSED'].includes(String(order.STATUS||'').toUpperCase()))
  const [workClosed,setWorkClosed]=useState(['CLOSE','CLOSED'].includes(String(order.STATUS||'').toUpperCase()))
  const [workStarted,setWorkStarted]=useState(['INPRG','COMP','COMPLETED','CLOSE','CLOSED'].includes(String(order.STATUS||'').toUpperCase()))
  const [workAssigned,setWorkAssigned]=useState(String(order.STATUS||'').toUpperCase()!=='WAITING')
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
  const [plannedLabor,setPlannedLabor]=useState(isPM?[{craft:'HVAC Technician',hours:'2',crew:'HVAC Team A'}]:[{craft:'',hours:'',crew:''}])
  const [plannedResources,setPlannedResources]=useState(isPM?[{type:'Material',item:'Air filter, 500 Ã— 500 mm',quantity:'2',availability:'Available'},{type:'Tool',item:'Digital multimeter',quantity:'1',availability:'Available'}]:[])
  const [plannedTasks,setPlannedTasks]=useState(isPM?(order['JOB PLAN TASKS']?.length?order['JOB PLAN TASKS']:jobTasks.slice(0,4)).map(task=>({sequence:task['JOB TASK SEQUENCE'],description:task['JOB TASK DESCRIPTION'],duration:Math.max(5,Math.round(Number(task['TASK DURATION IN HOUR'])*1440))})):[{sequence:10,description:'',duration:''}])
  const [ptwRequired,setPtwRequired]=useState(false)
  const [ptwFiles,setPtwFiles]=useState([])
  const [generalFiles,setGeneralFiles]=useState([{name:'site-inspection-photo.jpg',size:'1.8 MB',type:'Image'}])
  const [technicianRemarks,setTechnicianRemarks]=useState('')
  const [completionNotes,setCompletionNotes]=useState('')
  const [actualLabor,setActualLabor]=useState('')
  const [actualHours,setActualHours]=useState('')
  const [actualMaterials,setActualMaterials]=useState([])
  const [actualTools,setActualTools]=useState([])
  const [actualStart,setActualStart]=useState('')
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
  const supervisorOptions=laborMaster.filter(person=>!assignedDepartment||person.department===assignedDepartment).map(person=>({value:person.name,label:`${person.craftCode} Â· ${person.craft}`}))
  const laborCraftOptions=[...new Map(laborMaster.map(person=>[person.craftCode,{value:person.craftCode,label:person.craft}])).values()]
  const plannedCraftOptions=[...new Map(laborMaster.map(person=>[person.craft,{value:person.craft,label:person.craftCode}])).values()]
  const plannedCrewOptions=laborMaster.map(person=>({value:person.name,label:`${person.personId} Â· ${person.craft} Â· ${person.availability}`}))
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
  const updatePlannedResource=(index,value)=>updatePlanRow(setPlannedResources,index,'item',value)
  const materialRequests=plannedResources.filter(resource=>resource.type==='Material')
  const resourceRequests=plannedResources.filter(resource=>['Material','Tool','Equipment'].includes(resource.type))
  const materialBlocked=materialRequests.some(resource=>resource.availability==='Purchase Required')
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
  const status = materialBlocked ? 'Waiting for Spare Parts' : ptwBlocked ? 'Waiting for Permit' : workClosed ? 'CLOSE' : workCompleted ? 'COMP' : workStarted ? 'INPRG' : workAssigned&&overviewReady ? 'ASSIGNED' : isPM&&overviewReady ? 'Waiting' : 'WAPPR'
  const actualsEditable = true
  const number = order.WORKORDER || 'AUTO'
  const targetFinishTime=targetFinish?new Date(targetFinish).getTime():null
  const actualFinishTime=actualFinish?new Date(actualFinish).getTime():null
  const slaBreachedNow=Boolean(targetFinishTime&&((actualFinishTime&&actualFinishTime>targetFinishTime)||(!actualFinishTime&&Date.now()>targetFinishTime)))
  const slaLabel=!targetFinishTime?'Not defined':actualFinishTime?(slaBreachedNow?'No â€“ SLA Breached':'Yes â€“ SLA Met'):(slaBreachedNow?'No â€“ SLA Breached':'Pending â€“ Within SLA')
  const close = () => onClose()
  const reroute=()=>{setTab('Overview');setAssignedDepartment('');setSupervisor('');setWorkStarted(false)}
  const addFiles=(setter)=>event=>{const files=Array.from(event.target.files||[]).map(file=>({name:file.name,size:file.size>1048576?`${(file.size/1048576).toFixed(1)} MB`:`${Math.max(1,Math.round(file.size/1024))} KB`,type:file.type||'Document'}));setter(current=>[...current,...files]);event.target.value=''}
  const downloadFile=file=>{const blob=new Blob([`Mock CAFM attachment\n\nName: ${file.name}\nType: ${file.type||'Document'}\nSize: ${file.size||'Unknown'}\n\nReal storage integration can replace this generated download.`],{type:'text/plain'});const url=URL.createObjectURL(blob);const link=document.createElement('a');link.href=url;link.download=file.name?.includes('.')?file.name:`${file.name||'attachment'}.txt`;document.body.appendChild(link);link.click();link.remove();URL.revokeObjectURL(url)}
  const completeWork=()=>{if(!failureReady){setTab('Failure');return}const now=toDateTimeInput(new Date());setActualFinish(now);setActualStart(current=>current||now);setActualMaterials(current=>current.length?current:plannedResources.filter(row=>row.type==='Material').map(row=>({...row,actualQuantity:''})));setActualTools(current=>current.length?current:plannedResources.filter(row=>['Tool','Equipment'].includes(row.type)).map(row=>({...row,actualQuantity:''})));setWorkCompleted(true)}
  const printWorkOrder=()=>{if(isPM&&tab!=='Plan')setTab('Plan');setTimeout(()=>window.print(),60)}
  useEffect(()=>{setAutoSaveState('Saving');const timer=setTimeout(()=>setAutoSaveState('Saved'),450);return()=>clearTimeout(timer)},[description,longDescription,priority,department,subDepartment,assignedDepartment,workGroup,supervisor,laborCraft,siteValue,assetValue,assetDescription,locationValue,targetStart,targetFinish,failureClass,problemCode,causeCode,remedyCode,plannedLabor,plannedResources,plannedTasks,ptwRequired,ptwFiles,generalFiles,technicianRemarks,completionNotes,actualLabor,actualHours,actualMaterials,actualTools,actualStart,actualFinish,meterReading,waterConsumption,energyConsumption,meterReadingDate,workAssigned,workStarted,workCompleted,workClosed])
  return <div className={page?'w-full':'fixed inset-0 z-50 overflow-auto bg-[color:color-mix(in_srgb,var(--app-sidebar-bg)_72%,transparent)] p-6 backdrop-blur-sm'}><div className={`${page?'mx-auto w-full max-w-[1400px] space-y-3 bg-transparent p-0':'mx-auto max-w-7xl space-y-4 rounded-3xl bg-[var(--app-panel)] p-0 shadow-2xl'} wo-screen`}>
    <header className={workOrderHeaderClass}><div className={workOrderHeaderTopClass}><div><button className={workOrderBackClass} onClick={close}>Back to Work Order Tracking</button><div className="mt-2 flex flex-wrap items-center gap-3"><h2 className={workOrderTitleClass}>{number === 'AUTO' ? 'New work order' : `Work order #${number}`}</h2><Badge tone={isPM?'blue':'purple'}>{workType}</Badge><Badge tone="orange">{status}</Badge></div><p className={workOrderDescriptionClass}>{order['DESCRIPITION '] || order.DESCRIPTION || 'Enter work order information'}</p></div><div className={`${workOrderHeaderActionsClass} self-center`}><div className={autosaveClass(autoSaveState)}>{autoSaveState==='Saving'?<span className="h-2 w-2 animate-spin rounded-full border-2 border-[#a5aea9] border-t-[#557465]"/>:<Check size={13}/>}<span>{autoSaveState==='Saving'?'Saving…':'All changes saved'}</span></div><div className={autoStatusClass}><span>Automatic status</span><strong>{status}</strong></div>{status==='Waiting'&&<button className={woPrimaryButtonClass} disabled={!overviewReady} onClick={()=>setWorkAssigned(true)}><Users size={15}/>Assign department</button>}{status==='ASSIGNED'&&<button className={woPrimaryButtonClass} disabled={!preparationReady} onClick={()=>setWorkStarted(true)}><Wrench size={15}/>Start work</button>}{status==='INPRG'&&<button className={woPrimaryButtonClass} disabled={!failureReady} onClick={completeWork} title={!failureReady?'Failure Code and Problem Code are required before completion':''}><Check size={15}/>Resolve / complete</button>}{status==='COMP'&&<button className={woPrimaryButtonClass} disabled={!actualReady} onClick={()=>setWorkClosed(true)}><Check size={15}/>Close work order</button>}<button className={woOutlineButtonClass} onClick={reroute}><RotateCcw size={15}/> Re-route</button><button className={woOutlineButtonClass} onClick={printWorkOrder}><Printer size={15}/> Print</button></div></div></header>
    <div className={workOrderTabsClass}>{workOrderTabs.map((name,index)=><button key={name} className={workOrderTabClass(tab===name)} onClick={()=>setTab(name)}><small className={workOrderTabIndexClass}>{String(index+1).padStart(2,'0')}</small>{name}{name==='Failure'&&!isPM&&<i className="absolute right-2 top-2 h-1.5 w-1.5 rounded-full bg-[var(--orange)]"/>}</button>)}</div>
    <div className={workOrderBodyClass}>      {tab==='Overview' && <WorkOrderOverviewTab number={number} status={status} workType={workType} priority={priority} setPriority={setPriority} description={description} setDescription={setDescription} siteValue={siteValue} changeSite={changeSite} siteOptions={siteOptions} longDescription={longDescription} setLongDescription={setLongDescription} assetValue={assetValue} changeAsset={changeAsset} assetOptions={assetOptions} locationValue={locationValue} setLocationValue={setLocationValue} locationOptions={locationOptions} assetDescription={assetDescription} setAssetDescription={setAssetDescription} department={department} setDepartment={setDepartment} departmentOptions={departmentOptions} subDepartment={subDepartment} setSubDepartment={setSubDepartment} subDepartmentOptions={subDepartmentOptions} assignedDepartment={assignedDepartment} setAssignedDepartment={setAssignedDepartment} setWorkGroup={setWorkGroup} setSupervisor={setSupervisor} workGroup={workGroup} workGroupOptions={workGroupOptions} supervisor={supervisor} supervisorOptions={supervisorOptions} laborCraft={laborCraft} setLaborCraft={setLaborCraft} laborCraftOptions={laborCraftOptions} reportedDate={toDateTimeInput(order['REPORTED DATE']||order['REPORT DATE'])||new Date().toISOString().slice(0,16)} targetStart={targetStart} setTargetStart={setTargetStart} targetFinish={targetFinish} setTargetFinish={setTargetFinish} actualStart={actualStart} setActualStart={setActualStart} actualFinish={actualFinish} setActualFinish={setActualFinish} slaLabel={slaLabel} isPM={isPM} />}
      {tab==='Plan' && <WorkOrderPlanTab isPM={isPM} plannedLabor={plannedLabor} setPlannedLabor={setPlannedLabor} plannedResources={plannedResources} setPlannedResources={setPlannedResources} plannedTasks={plannedTasks} setPlannedTasks={setPlannedTasks} plannedCraftOptions={plannedCraftOptions} plannedCrewOptions={plannedCrewOptions} materialMaster={materialMaster} toolMaster={toolMaster} updatePlanRow={updatePlanRow} updatePlannedResource={updatePlannedResource} />}      {tab==='Actual' && <WorkOrderActualTab actualsEditable={actualsEditable} status={status} preparationReady={preparationReady} planReady={planReady} setTab={setTab} setWorkStarted={setWorkStarted} completeWork={completeWork} outlineButtonClass={woOutlineButtonClass} primaryButtonClass={woPrimaryButtonClass} targetStart={targetStart} targetFinish={targetFinish} actualFinish={actualFinish} slaBreachedNow={slaBreachedNow} slaLabel={slaLabel} technicianRemarks={technicianRemarks} setTechnicianRemarks={setTechnicianRemarks} completionNotes={completionNotes} setCompletionNotes={setCompletionNotes} actualLabor={actualLabor} setActualLabor={setActualLabor} laborCraft={laborCraft} setLaborCraft={setLaborCraft} actualHours={actualHours} setActualHours={setActualHours} actualStart={actualStart} setActualStart={setActualStart} actualMaterials={actualMaterials} setActualMaterials={setActualMaterials} actualTools={actualTools} setActualTools={setActualTools} updateActualRow={updateActualRow} workClosed={workClosed} />}      {tab==='Failure' && <WorkOrderFailureTab isCM={isCM} failureClass={failureClass} changeFailure={changeFailure} failureClassOptions={failureClassOptions} problemCode={problemCode} setProblemCode={setProblemCode} setCauseCode={setCauseCode} setRemedyCode={setRemedyCode} problemOptions={problemOptions} causeCode={causeCode} causeOptions={causeOptions} remedyCode={remedyCode} remedyOptions={remedyOptions} failureDescription={failureDescription} problemDescription={problemDescription} causeDescription={causeDescription} remedyDescription={remedyDescription} failureCount={failureCodes.length} />}      {tab==='Material Requests' && <WorkOrderMaterialRequestsTab resourceRequests={resourceRequests} plannedResources={plannedResources} setPlannedResources={setPlannedResources} updatePlanRow={updatePlanRow} materialBlocked={materialBlocked} primaryButtonClass={woPrimaryButtonClass} outlineButtonClass={woOutlineButtonClass} setTab={setTab} />}
      {tab==='PTW & Files' && <WorkOrderDocumentsTab ptwRequired={ptwRequired} setPtwRequired={setPtwRequired} ptwFiles={ptwFiles} setPtwFiles={setPtwFiles} generalFiles={generalFiles} setGeneralFiles={setGeneralFiles} addFiles={addFiles} downloadFile={downloadFile} />}
      {tab==='Meters' && <><div className={modeNoteClass('auto')}><Gauge size={18}/><div className="grid gap-1"><strong className="text-sm">Optional meter readings</strong><span className="text-xs text-[var(--app-muted)]">Complete only when readings are available or required by the related asset.</span></div></div><Section compact title="Meter Readings"><div className={formGridClass}><Field label="General Meter Reading" value={meterReading} onChange={e=>setMeterReading(e.target.value)} type="number"/><Field label="Water Consumption (m³)" value={waterConsumption} onChange={e=>setWaterConsumption(e.target.value)} type="number"/><Field label="Energy Consumption (kWh)" value={energyConsumption} onChange={e=>setEnergyConsumption(e.target.value)} type="number"/><Field label="Reading Date" value={meterReadingDate} onChange={e=>setMeterReadingDate(e.target.value)} type="datetime-local"/></div></Section></>}
    </div>  </div><WorkOrderPrintReport number={number} description={description || order['DESCRIPITION '] || 'Work order'} workType={workType} status={status} priority={priority} siteValue={siteValue} department={department} subDepartment={subDepartment} assignedDepartment={assignedDepartment} locationValue={locationValue} assetValue={assetValue} assetDescription={assetDescription} targetStart={targetStart} targetFinish={targetFinish} actualStart={actualStart} actualFinish={actualFinish} slaLabel={slaLabel} plannedTasks={plannedTasks} plannedLabor={plannedLabor} plannedResources={plannedResources} failureClass={failureClass} problemCode={problemCode} causeCode={causeCode} remedyCode={remedyCode} technicianRemarks={technicianRemarks} completionNotes={completionNotes} actualLabor={actualLabor} actualHours={actualHours} /></div>
}

export default function App() {
  const [active, setActive] = useState(()=>routeToPage(window.location.pathname))
  const [search, setSearch] = useState('')
  const [mobileOpen, setMobileOpen] = useState(false)
  const [allWorkOrders,setAllWorkOrders]=useState(workOrders)
  const [serviceRequests,setServiceRequests]=useState(serviceRequestSeed)
  const workOrderNotifications = buildWorkOrderNotifications(allWorkOrders)
  const navigate = name => { setActive(name); setSearch(''); setMobileOpen(false); window.history.pushState({},'',pathForPage(name)) }
  const convertRequest = request => {
    const number=String(56545135+allWorkOrders.filter(o=>String(o.WORKORDER).startsWith('56545')).length-3)
    const cm={'WORKORDER':number,'DESCRIPITION ':request.description,'LOCATION ':request.location,'LOCATION PRIORTY':request.priority,'ASSET':request.asset||'Unassigned','STATUS':'WAPPR','WORK TYPE ':'CM','STATUS DESCRIPITION':'Waiting for Approval','DEPARTMENT ':request.assignedDepartment||request.department,'SUB DEPARTMENT  NAME':request.subDepartment||'','PRIORTY':request.priority==='Emergency'?1:request.priority==='High'?2:3,'SITE':request.site,'TARGET START ':null,'TARGET FINISH ':null,'SOURCE SR':request.sr,'FAILURE CODE':request.failureCode||'','PROBLEM CODE':request.problemCode||'','CAUSE CODE':request.causeCode||'','REMEDY CODE':request.remedyCode||''}
    setAllWorkOrders(rows=>rows.some(o=>o['SOURCE SR']===request.sr)?rows:[...rows,cm])
    return cm
  }
  const openConvertedWorkOrder=number=>{setActive('Work Orders');setSearch('');window.history.pushState({},'',`/work-orders/${number}`)}
  const createWorkOrder=form=>{const next=Math.max(...allWorkOrders.map(order=>Number(order.WORKORDER)||0),56545134)+1;const created={'WORKORDER':String(next),'DESCRIPITION ':form.description,'LOCATION ':form.location,'LOCATION PRIORTY':form.priority,'ASSET':form.asset,'STATUS':'WAPPR','WORK TYPE ':form.type,'STATUS DESCRIPITION':'Waiting for Approval','DEPARTMENT ':'','SUB DEPARTMENT  NAME':'','PRIORTY':Number(String(form.priority).charAt(0))||3,'SITE':form.site,'TARGET START ':null,'TARGET FINISH ':null};setAllWorkOrders(rows=>[...rows,created]);return created}
  const generatePmWorkOrder=(pm,tasks)=>setAllWorkOrders(rows=>rows.some(order=>order['PM NUMBER']===pm.pmNumber&&order['PM CYCLE']===pm.cycle)?rows:[...rows,{'WORKORDER':pm.workOrder,'DESCRIPITION ':pm.description,'LOCATION ':pm.location,'LOCATION PRIORTY':'Routine','ASSET':pm.asset,'STATUS':'Waiting','WORK TYPE ':'PM','STATUS DESCRIPITION':'Waiting for Execution','DEPARTMENT ':pm.department,'SUB DEPARTMENT  NAME':pm.subDepartment,'PRIORTY':3,'SITE':pm.site,'TARGET START ':pm.startDate,'TARGET FINISH ':pm.startDate,'PM NUMBER':pm.pmNumber,'PM CYCLE':pm.cycle,'JOB PLAN':pm.jobPlan,'JOB PLAN TASKS':tasks,'ESTIMATED DURATION':tasks.reduce((sum,task)=>sum+Number(task['TASK DURATION IN HOUR']||0),0)*24}])
  const pages = {
    'Job Requests': <ServiceRequestsPage onConvert={convertRequest} onOpenWorkOrder={openConvertedWorkOrder} requests={serviceRequests} setRequests={setServiceRequests} assets={assets} workOrders={allWorkOrders} failureOptions={failureClassOptions}/>,
    'Incidents': <IncidentsPage/>,
    'Work Orders': <WorkOrdersPage rows={allWorkOrders} assets={assets} onCreate={createWorkOrder} onImportRows={setAllWorkOrders} EditorComponent={WorkOrderEditor} excelDate={excelDate} slaBreached={slaBreached}/>,
    'Assets': <AssetsPage initialAssets={assets} workOrders={allWorkOrders} />,
    'Preventive Maintenance': <PreventiveMaintenancePage assets={assets} jobTasks={jobTasks} workOrders={allWorkOrders} onGenerate={generatePmWorkOrder} onOpenWorkOrder={openConvertedWorkOrder}/>,
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
    'Tools & Equipment': <ToolsPage/>,
    'Roles & Permissions': <RolesPermissionsPage/>,
    'Settings': <SettingsPage/>
  }
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
      {active === 'Overview' ? <OverviewPage onNavigate={navigate} /> : pages[active]}
    </AppShell>
  )
}

























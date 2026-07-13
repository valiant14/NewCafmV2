import { useEffect, useState } from 'react'
import {
  Bell, Boxes, CalendarClock, Check, ChevronRight, ClipboardList,
  Command, Filter, LayoutDashboard, MapPin, Menu, MoreHorizontal, Plus, Search,
  ShieldCheck, SlidersHorizontal, Sparkles, Users, Wrench, X,
  Printer, Upload, RotateCcw, PackageCheck, Gauge, FileText, AlertTriangle
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
import Badge from './components/ui/Badge'
import Field from './components/ui/Field'
import Section from './components/ui/Section'
import { assets, workOrders, pmRecords, jobTasks, failureCodes, statusMatrix, failureClassOptions, uniqueCodeOptions, excelDate, toDateTimeInput, slaBreached } from './data/cafmData'


const nav = [
  ['Overview', LayoutDashboard], ['Service Requests', FileText], ['Work Orders', ClipboardList], ['Assets', Boxes],
  ['Preventive Maintenance', CalendarClock], ['Locations', MapPin], ['Job Plans', Wrench],
  ['Failure Library', ShieldCheck], ['Labor', Users], ['Materials', PackageCheck], ['Tools & Equipment', Wrench]
]

const initials = (name) => name.split(' ').map(part => part[0]).join('').slice(0, 2).toUpperCase()


const workOrderTabs = ['Overview', 'Plan', 'Failure', 'Materials', 'PTW & Files', 'Meters', 'Completion & Actuals']
const workOrderTabHelp = {
  Overview: 'Core information, asset, assignment, and execution notes.',
  Plan: 'Define the labor, job plan, tasks, materials, and tools expected for the work.',
  Failure: 'Classify the failure hierarchy. Required before closing CM work orders.',
  'Completion & Actuals': 'Complete execution notes and record the labor, parts, tools, and time actually used.',
  Materials: 'Request inventory items and track material availability.',
  'PTW & Files': 'Manage permits to work, photos, and supporting documents.',
  Meters: 'Capture optional asset, water, and energy readings.'
}

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
  const [plannedResources,setPlannedResources]=useState(isPM?[{type:'Material',item:'Air filter, 500 × 500 mm',quantity:'2',availability:'Available'},{type:'Tool',item:'Digital multimeter',quantity:'1',availability:'Available'}]:[])
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
  const actualsEditable = workCompleted
  const number = order.WORKORDER || 'AUTO'
  const targetFinishTime=targetFinish?new Date(targetFinish).getTime():null
  const actualFinishTime=actualFinish?new Date(actualFinish).getTime():null
  const slaBreachedNow=Boolean(targetFinishTime&&((actualFinishTime&&actualFinishTime>targetFinishTime)||(!actualFinishTime&&Date.now()>targetFinishTime)))
  const slaLabel=!targetFinishTime?'Not defined':actualFinishTime?(slaBreachedNow?'No – SLA Breached':'Yes – SLA Met'):(slaBreachedNow?'No – SLA Breached':'Pending – Within SLA')
  const close = () => onClose()
  const reroute=()=>{setTab('Overview');setAssignedDepartment('');setSupervisor('');setWorkStarted(false)}
  const addFiles=(setter)=>event=>{const files=Array.from(event.target.files||[]).map(file=>({name:file.name,size:file.size>1048576?`${(file.size/1048576).toFixed(1)} MB`:`${Math.max(1,Math.round(file.size/1024))} KB`,type:file.type||'Document'}));setter(current=>[...current,...files]);event.target.value=''}
  const completeWork=()=>{if(!failureReady){setTab('Failure');return}const now=toDateTimeInput(new Date());setActualFinish(now);setActualStart(current=>current||now);setActualMaterials(current=>current.length?current:plannedResources.filter(row=>row.type==='Material').map(row=>({...row,actualQuantity:''})));setActualTools(current=>current.length?current:plannedResources.filter(row=>['Tool','Equipment'].includes(row.type)).map(row=>({...row,actualQuantity:''})));setWorkCompleted(true)}
  useEffect(()=>{setAutoSaveState('Saving');const timer=setTimeout(()=>setAutoSaveState('Saved'),450);return()=>clearTimeout(timer)},[description,longDescription,priority,department,subDepartment,assignedDepartment,workGroup,supervisor,laborCraft,siteValue,assetValue,assetDescription,locationValue,targetStart,targetFinish,failureClass,problemCode,causeCode,remedyCode,plannedLabor,plannedResources,plannedTasks,ptwRequired,ptwFiles,generalFiles,technicianRemarks,completionNotes,actualLabor,actualHours,actualMaterials,actualTools,actualStart,actualFinish,workAssigned,workStarted,workCompleted,workClosed])
  return <div className={page?'work-order-detail-page':'wo-overlay'}><div className={`wo-editor ${page?'work-order-page-editor':''}`}>
    <header className="wo-editor-head"><div><button className="back-link" onClick={close}>← Work Order Tracking</button><div className="wo-title-line"><h2>{number === 'AUTO' ? 'New work order' : `Work order #${number}`}</h2><Badge tone={isPM?'blue':'purple'}>{workType}</Badge><Badge tone="orange">{status}</Badge></div><p>{order['DESCRIPITION '] || order.DESCRIPTION || 'Enter work order information'}</p></div>
      <div className="wo-head-actions"><div className={`autosave-indicator ${autoSaveState.toLowerCase()}`}>{autoSaveState==='Saving'?<span className="saving-dot"/>:<Check size={13}/>}<span>{autoSaveState==='Saving'?'Saving…':'All changes saved'}</span></div><div className={`auto-status ${status.toLowerCase().replaceAll(' ','-')}`}><span>Automatic status</span><strong>{status}</strong></div>{status==='Waiting'&&<button className="primary complete-action" disabled={!overviewReady} onClick={()=>setWorkAssigned(true)}><Users size={15}/>Assign department</button>}{status==='ASSIGNED'&&<button className="primary complete-action" disabled={!preparationReady} onClick={()=>setWorkStarted(true)}><Wrench size={15}/>Start work</button>}{status==='INPRG'&&<button className="primary complete-action" disabled={!failureReady} onClick={completeWork} title={!failureReady?'Failure Code and Problem Code are required before completion':''}><Check size={15}/>Resolve / complete</button>}{status==='COMP'&&<button className="primary complete-action" disabled={!actualReady} onClick={()=>setWorkClosed(true)}><Check size={15}/>Close work order</button>}<button className="outline" onClick={reroute}><RotateCcw size={15}/> Re-route</button><button className="outline" onClick={()=>window.print()}><Printer size={15}/> Print</button><button className="close-editor" onClick={close}><X size={20}/></button></div></header>
    <div className="wo-summary"><div><span>WORK TYPE</span><strong>{isPM?'Preventive Maintenance':'Corrective Maintenance'}</strong></div><div><span>SLA MET?</span><strong className={slaBreachedNow?'sla-breach':'sla-ok'}>{slaBreachedNow?<AlertTriangle size={14}/>:<Check size={14}/>} {slaLabel}</strong></div><div><span>PROJECT</span><strong>Royal Court Facilities</strong></div><div><span>PTW REQUIRED</span><strong>{ptwRequired?'Yes':'No'}</strong></div></div>
    <div className="wo-tabs simplified-tabs">{workOrderTabs.map((name,index)=><button key={name} className={tab===name?'active':''} onClick={()=>setTab(name)}><small>{String(index+1).padStart(2,'0')}</small>{name}{name==='Failure'&&!isPM&&<i/>}</button>)}</div>
    <div className="wo-tab-help"><div><strong>{tab}</strong><span>{workOrderTabHelp[tab]}</span></div></div>
    <div className="wo-body">
      {tab==='Overview' && <><div className={`overview-readiness ${overviewReady?'ready':'incomplete'}`}>{overviewReady?<Check size={17}/>:<AlertTriangle size={17}/>}<div><strong>{overviewReady?'Overview complete':'Complete the work-order overview'}</strong><span>{overviewReady?'Core details, asset context, and responsibility are ready.':`Missing: ${overviewMissing.join(', ')}`}</span></div><Badge tone={overviewReady?'green':'orange'}>{overviewReady?'Ready':'Action required'}</Badge></div><div className="wo-overview-layout"><div className="wo-overview-primary"><div className="overview-section-label"><ClipboardList size={14}/><span>Work order context</span></div>
        <Section title="Work Order Information" note="Core information used throughout the work-order lifecycle"><div className="field-grid four">
          <Field label="Work Order Number" value={String(number)} locked/><Field label="Status" value={status} locked/><Field label="Work Type" value={workType} required locked options={['CM','PM','Incident','SR']}/><Field label="Priority" value={priority} required onChange={e=>setPriority(e.target.value)} options={['1 - Emergency','2 - High','3 - Medium','4 - Low']}/>
          <Field label="Description" value={description} required onChange={e=>setDescription(e.target.value)}/><Field label="Site" value={siteValue} required onChange={changeSite} suggestions={siteOptions} placeholder="Search or select a site"/><Field label="Department" value={department} required onChange={e=>{setDepartment(e.target.value);setSubDepartment('')}} suggestions={departmentOptions} placeholder="Search department"/><Field label="Sub Department" value={subDepartment} onChange={e=>setSubDepartment(e.target.value)} suggestions={subDepartmentOptions} placeholder="Search sub department"/>
          <div className="span-2"><Field label="Long Description" value={longDescription} onChange={e=>setLongDescription(e.target.value)} type="textarea"/></div><Field label="Reported Date" value={toDateTimeInput(order['REPORTED DATE']||order['REPORT DATE'])||new Date().toISOString().slice(0,16)} type="datetime-local" locked/><Field label="Target Start" value={targetStart} onChange={e=>setTargetStart(e.target.value)} type="datetime-local" locked={isPM}/><Field label="Target Finish" value={targetFinish} onChange={e=>setTargetFinish(e.target.value)} type="datetime-local"/><Field label="Actual Start" value={actualStart} type="datetime-local" locked/><Field label="Actual Finish" value={actualFinish} type="datetime-local" locked/>
        </div></Section></div><aside className="wo-overview-side"><div className="overview-section-label"><MapPin size={14}/><span>Asset context</span></div><Section title="Asset & Location" note="Equipment, facility, and project relationship"><div className="field-grid"><Field label="Asset" value={assetValue} required onChange={changeAsset} suggestions={assetOptions} placeholder="Search asset number or description"/><Field label="Location" value={locationValue} required onChange={e=>setLocationValue(e.target.value)} suggestions={locationOptions} placeholder="Search or select a location"/><Field label="Asset Description" value={assetDescription} required onChange={e=>setAssetDescription(e.target.value)} placeholder="Required asset description"/><Field label="Project" value="Royal Court Facilities" required locked/></div></Section><div className="overview-section-label"><Users size={14}/><span>Ownership</span></div><Section title="Responsibility" note="Use Re-route to clear and reassign ownership"><div className="field-grid"><Field label="Assigned Department" value={assignedDepartment} required onChange={e=>{setAssignedDepartment(e.target.value);setWorkGroup('');setSupervisor('')}} suggestions={departmentOptions} placeholder="Search assigned department"/><Field label="Work Group" value={workGroup} onChange={e=>setWorkGroup(e.target.value)} suggestions={workGroupOptions} placeholder="Search or select a work group"/><Field label="Supervisor" value={supervisor} onChange={e=>setSupervisor(e.target.value)} suggestions={supervisorOptions} placeholder="Search supervisor name or craft"/><Field label="Labor Craft Code" value={laborCraft} onChange={e=>setLaborCraft(e.target.value)} suggestions={laborCraftOptions} placeholder="Search craft code or description"/></div></Section></aside></div></>}
      {tab==='Plan' && <><div className={`mode-note ${isPM?'auto':planReady?'actual':'warning'}`}><Sparkles size={18}/><div><strong>{isPM?'Automatically generated planned data':planReady?`${workType} planning complete`:`Complete mandatory ${workType} planning`}</strong><span>{isPM?'Copied from PM and job plan; values are locked after generation.':planReady?(isCM?'Labor, estimated hours, required materials, and required tools are ready.':'Required labor and estimated hours are ready.'):`Missing: ${[!plannedLaborReady&&'Labor and estimated hours',isCM&&!plannedMaterialsReady&&'Required material',isCM&&!plannedToolsReady&&'Required tool'].filter(Boolean).join(', ')}`}</span></div></div>
        <div className="plan-workspace"><div className="overview-section-label"><Users size={14}/><span>Labor plan</span></div><Section title="Planned Labor" note={isPM?'Generated from the linked job plan':'Add the crafts, crews, and estimated hours required'}>{!isPM&&<button className="inline-add plan-add" onClick={()=>setPlannedLabor(rows=>[...rows,{craft:'',hours:'',crew:''}])}><Plus size={15}/>Add labor</button>}<datalist id="planned-craft-options">{plannedCraftOptions.map(item=><option value={item.value} key={item.value}>{item.label}</option>)}</datalist><datalist id="planned-crew-options">{plannedCrewOptions.map(item=><option value={item.value} key={item.value}>{item.label}</option>)}</datalist><div className="planner-table"><div className="planner-head"><span>Labor craft</span><span>Estimated hours</span><span>Assigned crew</span><span></span></div>{plannedLabor.map((row,index)=><div className="planner-row" key={index}><input value={row.craft} list="planned-craft-options" readOnly={isPM} onChange={e=>updatePlanRow(setPlannedLabor,index,'craft',e.target.value)} placeholder="Search craft code or description"/><input value={row.hours} readOnly={isPM} type="number" onChange={e=>updatePlanRow(setPlannedLabor,index,'hours',e.target.value)} placeholder="Hours"/><input value={row.crew} list="planned-crew-options" readOnly={isPM} onChange={e=>updatePlanRow(setPlannedLabor,index,'crew',e.target.value)} placeholder="Search technician or crew"/>{!isPM&&<button onClick={()=>setPlannedLabor(rows=>rows.filter((_,i)=>i!==index))}><X size={14}/></button>}</div>)}</div></Section>
        <div className="overview-section-label"><PackageCheck size={14}/><span>Resource plan</span></div><Section title="Planned Materials & Tools" note="Request resources and enter the required count. Availability is managed in Materials.">{!isPM&&<div className="plan-actions"><button className="inline-add" onClick={()=>setPlannedResources(rows=>[...rows,{type:'Material',item:'',quantity:'',availability:'Available'}])}><Plus size={15}/>Add material</button><button className="inline-add secondary" onClick={()=>setPlannedResources(rows=>[...rows,{type:'Tool',item:'',quantity:'',availability:'Available'}])}><Plus size={15}/>Add tool</button></div>}<datalist id="planned-material-options">{materialMaster.map(item=><option value={item.description} key={item.itemNumber}>{item.itemNumber} · {item.category}</option>)}</datalist><datalist id="planned-tool-options">{toolMaster.map(item=><option value={item.description} key={item.toolNumber}>{item.toolNumber} · {item.category}</option>)}</datalist><div className="planner-table resources"><div className="planner-head"><span>Type</span><span>Item / description</span><span>Quantity</span><span></span></div>{plannedResources.length?plannedResources.map((row,index)=><div className="planner-row" key={index}><select value={row.type} disabled={isPM} onChange={e=>updatePlanRow(setPlannedResources,index,'type',e.target.value)}><option>Material</option><option>Tool</option><option>Equipment</option></select><input value={row.item} list={row.type==='Material'?'planned-material-options':'planned-tool-options'} readOnly={isPM} onChange={e=>updatePlannedResource(index,e.target.value)} placeholder={`Search ${row.type.toLowerCase()} number or description`}/><input value={row.quantity} type="number" min="1" step="1" readOnly={isPM} onChange={e=>updatePlanRow(setPlannedResources,index,'quantity',e.target.value)} placeholder="Enter count"/>{!isPM&&<button onClick={()=>setPlannedResources(rows=>rows.filter((_,i)=>i!==index))}><X size={14}/></button>}</div>):<div className="planner-empty">No planned materials or tools yet.</div>}</div></Section>
        <div className="overview-section-label"><ClipboardList size={14}/><span>Job task plan</span></div><Section title="Job Tasks" note="Configure sequence, instructions, and expected duration">{!isPM&&<button className="inline-add plan-add" onClick={()=>setPlannedTasks(rows=>[...rows,{sequence:(rows.length+1)*10,description:'',duration:''}])}><Plus size={15}/>Add task</button>}<div className="planner-table tasks"><div className="planner-head"><span>Sequence</span><span>Task instruction</span><span>Duration (min)</span><span></span></div>{plannedTasks.map((row,index)=><div className="planner-row" key={index}><input type="number" value={row.sequence} readOnly={isPM} onChange={e=>updatePlanRow(setPlannedTasks,index,'sequence',e.target.value)}/><input value={row.description} readOnly={isPM} onChange={e=>updatePlanRow(setPlannedTasks,index,'description',e.target.value)} placeholder="Describe the task to complete"/><input type="number" value={row.duration} readOnly={isPM} onChange={e=>updatePlanRow(setPlannedTasks,index,'duration',e.target.value)} placeholder="Minutes"/>{!isPM&&<button onClick={()=>setPlannedTasks(rows=>rows.filter((_,i)=>i!==index))}><X size={14}/></button>}</div>)}</div></Section></div></>}
      {tab==='Completion & Actuals' && <>{!actualsEditable?<div className="actuals-locked"><div className="actuals-lock-icon"><ShieldCheck size={22}/></div><div><strong>Available after work completion</strong><p>{status==='ASSIGNED'?'Complete Plan and Failure preparation, then select Start Work. When execution is finished, select Resolve / Complete.':'When physical work is finished, select Resolve / Complete in the header to unlock execution notes and actual consumption.'}</p><span>Current status: {status}</span>{status==='ASSIGNED'&&!preparationReady&&<button className="outline locked-next" onClick={()=>setTab(planReady?'Failure':'Plan')}>Complete {planReady?'Failure':'Plan'} preparation</button>}{status==='ASSIGNED'&&preparationReady&&<button className="primary locked-next" onClick={()=>setWorkStarted(true)}>Start work</button>}{status==='INPRG'&&<button className="primary locked-next" onClick={completeWork}>Resolve / complete work</button>}</div></div>:<><div className="mode-note actual"><Check size={18}/><div><strong>Completion and actual data</strong><span>Record execution results and actual consumption. Planned information remains unchanged.</span></div></div>
        <div className={`completion-timing ${slaBreachedNow?'breached':'met'}`}><div><span>Target Start<strong>{targetStart?new Date(targetStart).toLocaleString():'Not defined'}</strong></span><span>Target Finish<strong>{targetFinish?new Date(targetFinish).toLocaleString():'Not defined'}</strong></span><span>Actual Finish<strong>{actualFinish?new Date(actualFinish).toLocaleString():'Not recorded'}</strong></span></div><Badge tone={slaBreachedNow?'orange':'green'}>{slaLabel}</Badge></div><Section title="Execution Notes"><div className="field-grid"><Field label="Technician Remarks" value={technicianRemarks} onChange={e=>setTechnicianRemarks(e.target.value)} type="textarea" required/><Field label="Completion Notes" value={completionNotes} onChange={e=>setCompletionNotes(e.target.value)} type="textarea" required/></div></Section>
        <Section title="Actual Labor"><div className="field-grid"><Field label="Technician / Labor" value={actualLabor} onChange={e=>setActualLabor(e.target.value)} required/><Field label="Labor Craft Code" value={laborCraft} onChange={e=>setLaborCraft(e.target.value)} required/><Field label="Actual Labor Hours" value={actualHours} onChange={e=>setActualHours(e.target.value)} type="number" required/><Field label="Actual Start" value={actualStart} onChange={e=>setActualStart(e.target.value)} type="datetime-local"/></div></Section>
        <Section title="Actual Materials Used" note="Required for CM closeout"><div className="actual-resource-list">{actualMaterials.map((row,index)=><div key={`${row.item}-${index}`}><span><PackageCheck size={15}/><strong>{row.item}</strong></span><label>Actual quantity<input type="number" min="0" value={row.actualQuantity} onChange={e=>updateActualRow(setActualMaterials,index,e.target.value)} placeholder="0"/></label></div>)}</div></Section>
        <Section title="Actual Tools and Equipment Used" note="Required for CM closeout"><div className="actual-resource-list">{actualTools.map((row,index)=><div key={`${row.item}-${index}`}><span><Wrench size={15}/><strong>{row.item}</strong></span><label>Actual quantity<input type="number" min="0" value={row.actualQuantity} onChange={e=>updateActualRow(setActualTools,index,e.target.value)} placeholder="0"/></label></div>)}</div></Section><Section title="Automatic Closeout" note="System populated when the work order is closed"><div className="closeout-grid"><div><span>Completion Date</span><strong>{actualFinish?new Date(actualFinish).toLocaleString():'Pending'}</strong></div><div><span>Closed By</span><strong>{workClosed?'Ahmed Faisal':'Pending'}</strong></div><div><span>Close Status</span><strong>{workClosed?'CLOSE':'Pending'}</strong></div><div><span>Asset History Update</span><strong>{workClosed?'Updated automatically':'Pending close'}</strong></div></div></Section></>}</>}
      {tab==='Failure' && <Section title="Failure Classification" note={isCM?'Failure Class and Problem are required for corrective maintenance':'Optional for this work order type'}><div className="failure-fields"><Field label="Failure Code" value={failureClass} required={isCM} onChange={changeFailure} suggestions={failureClassOptions} placeholder="Search code or description"/><Field label="Problem Code" value={problemCode} required={isCM} onChange={e=>{setProblemCode(e.target.value);setCauseCode('');setRemedyCode('')}} suggestions={problemOptions} placeholder={failureClass?'Search matching problems':'Select failure code first'}/><Field label="Cause Code (Optional)" value={causeCode} onChange={e=>{setCauseCode(e.target.value);setRemedyCode('')}} suggestions={causeOptions} placeholder={problemCode?'Search cause code or description':'Select problem code first'}/><Field label="Remedy Code (Optional)" value={remedyCode} onChange={e=>setRemedyCode(e.target.value)} suggestions={remedyOptions} placeholder={problemCode?'Search remedy code or description':'Select problem code first'}/></div><div className="failure-selection-map">{[
          {step:'01',label:'Failure class',code:failureClass,description:failureDescription,required:true},
          {step:'02',label:'Problem',code:problemCode,description:problemDescription,required:true},
          {step:'03',label:'Cause',code:causeCode,description:causeDescription},
          {step:'04',label:'Remedy',code:remedyCode,description:remedyDescription}
        ].map((item,index)=><div className={`failure-stage ${item.code?'selected':''}`} key={item.label}><div className="failure-stage-top"><span>{item.step}</span><strong>{item.label}</strong><em>{item.required?'Required':'Optional'}</em></div>{item.code?<><b>{item.code}</b><p>{item.description||'Description not available for this code.'}</p></>:<p className="failure-empty-stage">{index===0?'Select a failure class to begin':`No ${item.label.toLowerCase()} selected`}</p>}</div>)}</div><div className="failure-library-note"><Search size={15}/><span>{failureCodes.length.toLocaleString()} Excel failure records available · codes and descriptions are filtered by hierarchy</span></div></Section>}
      {tab==='Materials' && <Section title="Materials, Tools & Equipment" note="Generated from resources requested in the Plan tab">{resourceRequests.length?<><div className="materials-request-table"><div className="materials-head"><span>Planned resource</span><span>Requested quantity</span><span>Store / source</span><span>Availability</span><span>Action</span></div>{plannedResources.map((resource,index)=>['Material','Tool','Equipment'].includes(resource.type)?<div className="materials-row" key={index}><div><span className={`material-cube ${resource.type.toLowerCase()}`}>{resource.type==='Material'?<PackageCheck size={16}/>:<Wrench size={16}/>}</span><div className="resource-name"><small>{resource.type}</small><strong>{resource.item||`Unnamed planned ${resource.type.toLowerCase()}`}</strong></div></div><span>{resource.quantity||'Not set'}</span><span>{resource.type==='Material'?'DIWAN-MAIN':'Tool Crib'}</span><select value={resource.availability} onChange={e=>updatePlanRow(setPlannedResources,index,'availability',e.target.value)}><option>Available</option><option>Purchase Required</option></select><button className={resource.availability==='Available'?'reserve-ready':'purchase-needed'}>{resource.availability==='Available'?(resource.type==='Material'?'Reserve':'Allocate'):'Create purchase request'}</button></div>:null)}</div><div className={`materials-summary ${materialBlocked?'blocked':'ready'}`}>{materialBlocked?<AlertTriangle size={18}/>:<Check size={18}/>}<div><strong>{materialBlocked?'Waiting for Spare Parts':'Resources ready for execution'}</strong><span>{materialBlocked?'One or more planned material items require purchase. Work Order status changed automatically to Waiting for Spare Parts.':'Planned materials, tools, and equipment are available for reservation or allocation.'}</span></div></div></>:<div className="materials-empty"><PackageCheck size={28}/><strong>No resources requested</strong><p>Add materials, tools, or equipment in the Plan tab.</p><button className="outline" onClick={()=>setTab('Plan')}>Go to Plan</button></div>}</Section>}
      {tab==='PTW & Files' && <div className="documents-workspace"><section className={`ptw-control-card ${ptwRequired?'required':'not-required'}`}><div className="ptw-control-copy"><span className="ptw-icon"><ShieldCheck size={20}/></span><div><strong>Permit to Work required?</strong><p>Default is No. Enable only when execution requires an approved permit.</p></div></div><div className="ptw-toggle"><button className={!ptwRequired?'active':''} onClick={()=>setPtwRequired(false)}>No</button><button className={ptwRequired?'active':''} onClick={()=>setPtwRequired(true)}>Yes</button></div></section>{ptwRequired?<section className="document-card"><header><div><span>PTW</span><h3>Permit documents</h3><p>Upload one or more approved permits before execution.</p></div><Badge tone={ptwFiles.length?'green':'orange'}>{ptwFiles.length?'Permit attached':'Permit missing'}</Badge></header><label className="compact-upload"><Upload size={18}/><div><strong>Add PTW documents</strong><span>PDF, DOCX, JPG or PNG · multiple files accepted</span></div><input type="file" multiple onChange={addFiles(setPtwFiles)}/></label>{ptwFiles.length>0&&<div className="document-list">{ptwFiles.map((file,index)=><div key={`${file.name}-${index}`}><span className="document-type"><FileText size={16}/></span><div><strong>{file.name}</strong><small>{file.size} · PTW document</small></div><Badge tone="green">Attached</Badge><button onClick={()=>setPtwFiles(files=>files.filter((_,i)=>i!==index))}><X size={14}/></button></div>)}</div>} {!ptwFiles.length&&<div className="permit-warning"><AlertTriangle size={16}/><span>Work Order status is Waiting for Permit until a PTW document is attached.</span></div>}</section>:<section className="no-permit-card"><Check size={18}/><div><strong>No permit required</strong><span>This work order can proceed without a Permit to Work.</span></div></section>}<section className="document-card"><header><div><span>FILES</span><h3>General attachments</h3><p>Photos, reports, drawings, and supporting documents.</p></div><Badge>{generalFiles.length} files</Badge></header><label className="compact-upload"><Upload size={18}/><div><strong>Add attachments</strong><span>Choose multiple files if needed</span></div><input type="file" multiple onChange={addFiles(setGeneralFiles)}/></label><div className="document-list">{generalFiles.map((file,index)=><div key={`${file.name}-${index}`}><span className="document-type"><FileText size={16}/></span><div><strong>{file.name}</strong><small>{file.size} · {file.type}</small></div><button onClick={()=>setGeneralFiles(files=>files.filter((_,i)=>i!==index))}><X size={14}/></button></div>)}</div></section></div>}
      {tab==='Meters' && <><div className="mode-note auto"><Gauge size={18}/><div><strong>Optional meter readings</strong><span>Complete only when readings are available or required by the related asset.</span></div></div><Section title="Meter Readings"><div className="field-grid"><Field label="General Meter Reading" type="number"/><Field label="Water Consumption (m³)" type="number"/><Field label="Energy Consumption (kWh)" type="number"/><Field label="Reading Date" type="datetime-local"/></div></Section></>}
    </div>
  </div></div>
}

const initialRequests = [{
  sr:'SR-2026-0041', description:'Water leak reported above meeting room', longDescription:'Active water staining and intermittent dripping from ceiling tile.',
  site:'1031', location:'RC-1031-RD-001-00-054', asset:'', department:'Civil', reportedBy:'Maha Alotaibi',
  reportedDate:'2026-07-12T10:15', priority:'High', requestType:'Service', failureCode:'', status:'WAPPR', attachments:1
}]
const blankServiceRequest = () => ({sr:'AUTO',description:'',longDescription:'',site:'',location:'',asset:'',department:'',reportedBy:'',reportedDate:new Date().toISOString().slice(0,16),priority:'Medium',requestType:'Service',failureCode:'',status:'NEW'})

function ServiceRequestEditor({ request, onClose, onSubmit, onApprove }) {
  const [form,setForm]=useState(request)
  const [submitError,setSubmitError]=useState('')
  const isNew=form.status==='NEW'
  const canSubmit=Boolean(form.description?.trim()&&form.site&&form.location&&form.reportedBy?.trim())
  const canConvert=Boolean(form.department?.trim()&&(form.assignedDepartment||form.department)?.trim())
  const update=key=>e=>setForm({...form,[key]:e.target.value})
  const now=new Date().toISOString().slice(0,16)
  const siteOptions=[...new Set([...assets.map(a=>String(a.site)),...workOrders.map(o=>String(o.SITE))].filter(Boolean))].sort()
  const assetsForSite=assets.filter(a=>!form.site||String(a.site)===String(form.site))
  const assetOptions=assetsForSite.map(a=>({value:a.assetnum,label:a.description?.trim()}))
  const locationOptions=[...new Set([
    ...assetsForSite.map(a=>a.location),
    ...workOrders.filter(o=>!form.site||String(o.SITE)===String(form.site)).map(o=>o['LOCATION '])
  ].filter(Boolean))].sort()
  const updateSite=e=>setForm({...form,site:e.target.value,location:'',asset:''})
  const updateAsset=e=>{const value=e.target.value;const match=assets.find(a=>a.assetnum===value);setForm({...form,asset:value,location:match?.location||form.location,site:match?.site?String(match.site):form.site})}
  const handlePrimary=()=>{
    if(isNew&&!canSubmit){setSubmitError('Complete Description, Site, Location, and Reported By before submitting.');return}
    if(!isNew&&!canConvert){setSubmitError('Complete Department and Assigned Department before converting to CM.');return}
    setSubmitError('')
    isNew?onSubmit(form):onApprove(form)
  }
  return <div className="sr-detail-page"><div className="wo-editor sr-editor sr-page-editor"><header className="wo-editor-head"><div><button className="back-link" onClick={onClose}>← All Service Requests</button><div className="wo-title-line"><h2>{form.sr==='AUTO'?'New service request':form.sr}</h2><Badge tone="orange">{form.status}</Badge></div><p>{isNew?'Tell us what happened and where. The maintenance team will configure the technical details.':'Review, configure, and convert this request without leaving the screen.'}</p></div><div className="wo-head-actions">{!isNew&&<button className="outline"><Printer size={15}/> Print</button>}</div></header>
    <div className="sr-flow"><span className="done">Request created</span><i/><span className={form.status==='WAPPR'?'current':'done'}>Department review</span><i/><span className={form.status==='CONVERTED'?'done':''}>CM work order</span></div>
    <div className="wo-body sr-form-body">
      {submitError&&<div className="form-error"><AlertTriangle size={17}/><span>{submitError}</span><button onClick={()=>setSubmitError('')}><X size={14}/></button></div>}
      <Section title={isNew?'Request Information':'Submitted Request'} note={isNew?'Provide the issue, location, and contact information.':'Original information submitted by the requester.'}><div className="field-grid sr-form-grid">
        <Field label="SR Number" value={form.sr} locked/><Field label="Status" value={form.status} locked/><Field label="Request Type" value="Service" required locked/><Field label="Priority" value={form.priority} required options={['Low','Medium','High','Emergency']} onChange={update('priority')}/>
        <Field label="Description" value={form.description} required onChange={update('description')}/><Field label="Site" value={form.site} required onChange={updateSite} suggestions={siteOptions} placeholder="Search or select a site"/><Field label="Location" value={form.location} required onChange={update('location')} suggestions={locationOptions} placeholder="Search or select a location"/><Field label="Asset" value={form.asset} onChange={updateAsset} suggestions={assetOptions} placeholder="Search asset number or description"/>
        <div className="span-2"><Field label="Long Description" value={form.longDescription} type="textarea" onChange={update('longDescription')}/></div><Field label="Reported By" value={form.reportedBy} required onChange={update('reportedBy')}/><Field label="Reported Date & Time" value={form.reportedDate||now} type="datetime-local" locked/>
      </div></Section>
      <Section title="Attachments" note="Add photos or documents that help explain the request"><div className="upload-zone"><Upload size={25}/><strong>Upload attachments</strong><span>Photos, PDFs and supporting documents · multiple files supported</span><input type="file" multiple/></div></Section>
      {!isNew&&<Section title="Department Review & Configuration" note="Completed by the reviewing engineer or supervisor before CM conversion"><div className="field-grid sr-form-grid"><Field label="Department" value={form.department} required onChange={update('department')}/><Field label="Sub Department" value={form.subDepartment||''} onChange={update('subDepartment')}/><Field label="Assigned Department" value={form.assignedDepartment||form.department} required onChange={update('assignedDepartment')}/><Field label="Failure Code" value={form.failureCode} onChange={update('failureCode')} suggestions={failureClassOptions} placeholder="Search code or description"/></div></Section>}
      <div className="mode-note warning"><AlertTriangle size={18}/><div><strong>{isNew?'Technical configuration happens after submission':'Ready for department review'}</strong><span>{isNew?'Department assignment and failure classification will be completed by maintenance staff.':'Confirm the department configuration before converting this request to CM.'}</span></div></div>
    </div><div className="sr-modal-footer"><button className="outline" onClick={onClose}>Cancel</button><button className="primary sr-submit" onClick={handlePrimary} disabled={form.status==='CONVERTED'}><Check size={15}/>{form.status==='CONVERTED'?'Converted':isNew?'Submit request':'Approve & convert to CM'}</button></div></div></div>
}

function ServiceRequests({ onConvert, requests, setRequests }) {
  const requestFromPath=()=>{const id=decodeURIComponent(window.location.pathname.split('/service-requests/')[1]||'');return id==='new'?blankServiceRequest():requests.find(r=>r.sr===id)||null}
  const [selected,setSelected]=useState(requestFromPath)
  useEffect(()=>{const handlePop=()=>setSelected(requestFromPath());window.addEventListener('popstate',handlePop);return()=>window.removeEventListener('popstate',handlePop)},[requests])
  const openRequest=request=>{setSelected(request);window.history.pushState({},'',`/service-requests/${request.sr==='AUTO'?'new':request.sr}`)}
  const closeRequest=()=>{setSelected(null);window.history.pushState({},'','/service-requests')}
  const submit=request=>{
    const sr=`SR-2026-${String(requests.length+42).padStart(4,'0')}`
    const submitted={...request,sr,status:'WAPPR',requestType:'Service'}
    setRequests(list=>[...list,submitted])
    setSelected(submitted)
    window.history.replaceState({},'',`/service-requests/${submitted.sr}`)
  }
  const approve=request=>{
    const sr=request.sr==='AUTO'?`SR-2026-${String(requests.length+42).padStart(4,'0')}`:request.sr
    const updated={...request,sr,status:'CONVERTED'}
    setRequests(list=>list.some(item=>item.sr===updated.sr)?list.map(item=>item.sr===updated.sr?updated:item):[...list,updated])
    setSelected(updated)
    onConvert(updated)
    window.history.replaceState({},'',`/service-requests/${updated.sr}`)
  }
  if(selected)return <ServiceRequestEditor request={selected} onClose={closeRequest} onSubmit={submit} onApprove={approve}/>
  return <><section className="page-heading"><div><p className="eyebrow">REQUEST INTAKE</p><h1>Service Requests</h1><p>Submit, review, approve, and convert requests into Corrective Maintenance work orders.</p></div><button className="primary" onClick={()=>openRequest(blankServiceRequest())}><Plus size={17}/>New service request</button></section>
    <div className="sub-tabs"><button className="active">All Service Requests <b>{requests.length}</b></button><button>Awaiting Review <b>{requests.filter(r=>r.status==='WAPPR').length}</b></button><button>Converted <b>{requests.filter(r=>r.status==='CONVERTED').length}</b></button></div>
    <section className="panel register"><div className="table-shell"><table><thead><tr><th>SR number</th><th>Description</th><th>Site / Location</th><th>Department</th><th>Reported by</th><th>Priority</th><th>Status</th><th></th></tr></thead><tbody>{requests.map(r=><tr className="click-row" key={r.sr} onClick={()=>openRequest(r)}><td><strong className="mono">{r.sr}</strong></td><td>{r.description}</td><td>{r.site}<small className="cell-sub">{r.location}</small></td><td>{r.department}</td><td>{r.reportedBy}</td><td><Badge tone={r.priority==='High'?'orange':'neutral'}>{r.priority}</Badge></td><td><Badge tone={r.status==='CONVERTED'?'green':'orange'}>{r.status}</Badge></td><td><ChevronRight size={17}/></td></tr>)}</tbody></table></div><div className="table-footer"><span>{requests.length} submitted requests</span><span>Departments and engineers can review all records</span></div></section></>
}

export default function App() {
  const [active, setActive] = useState(()=>window.location.pathname.startsWith('/service-requests')?'Service Requests':window.location.pathname.startsWith('/work-orders')?'Work Orders':window.location.pathname.startsWith('/assets')?'Assets':window.location.pathname.startsWith('/preventive-maintenance')?'Preventive Maintenance':window.location.pathname.startsWith('/labor')?'Labor':window.location.pathname.startsWith('/materials')?'Materials':window.location.pathname.startsWith('/tools')?'Tools & Equipment':'Overview')
  const [search, setSearch] = useState('')
  const [mobileOpen, setMobileOpen] = useState(false)
  const [allWorkOrders,setAllWorkOrders]=useState(workOrders)
  const [serviceRequests,setServiceRequests]=useState(serviceRequestSeed)
  const navigate = name => { setActive(name); setSearch(''); setMobileOpen(false);const paths={'Overview':'/','Service Requests':'/service-requests','Work Orders':'/work-orders','Assets':'/assets','Preventive Maintenance':'/preventive-maintenance','Labor':'/labor','Materials':'/materials','Tools & Equipment':'/tools'};if(paths[name])window.history.pushState({},'',paths[name]) }
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
    'Service Requests': <ServiceRequestsPage onConvert={convertRequest} onOpenWorkOrder={openConvertedWorkOrder} requests={serviceRequests} setRequests={setServiceRequests} assets={assets} workOrders={allWorkOrders} failureOptions={failureClassOptions}/>,
    'Work Orders': <WorkOrdersPage rows={allWorkOrders} assets={assets} onCreate={createWorkOrder} EditorComponent={WorkOrderEditor} excelDate={excelDate} slaBreached={slaBreached}/>,
    'Assets': <AssetsPage initialAssets={assets} workOrders={allWorkOrders} />,
    'Preventive Maintenance': <PreventiveMaintenancePage assets={assets} jobTasks={jobTasks} workOrders={allWorkOrders} onGenerate={generatePmWorkOrder} onOpenWorkOrder={openConvertedWorkOrder}/>,
    'Locations': <LocationsPage/>,
    'Job Plans': <RegisterPage title="Job plans" eyebrow="MAINTENANCE" description="Standard task sequences and estimated durations for technicians." rows={jobTasks} search={search} setSearch={setSearch} action="New job plan" columns={[
      {key:'JPNUM',label:'Plan',render:v=><strong className="mono">{v}</strong>},{key:'DESCRIPTION',label:'Plan description'},{key:'JOB TASK SEQUENCE',label:'Sequence'},{key:'JOB TASK DESCRIPTION',label:'Task'},{key:'TASK DURATION IN HOUR',label:'Duration',render:v=>`${Math.round(Number(v)*1440)} min`}
    ]}/>,
    'Failure Library': <RegisterPage title="Failure library" eyebrow="RELIABILITY" description="Search the bilingual Maximo problem, cause, and remedy hierarchy." rows={failureCodes} search={search} setSearch={setSearch} action="Add code" columns={[
      {key:'FAILURE CLASS ID',label:'Class',render:v=><strong className="mono">{v}</strong>},{key:'DESCRIPTION',label:'Class description'},{key:'PROBLEM CODE',label:'Problem code'},{key:'PC - DESCRIPTION',label:'Problem description'},{key:'CAUSE CODE',label:'Cause'}
    ]}/>,
    'Labor': <LaborPage/>,
    'Materials': <MaterialsPage/>,
    'Tools & Equipment': <ToolsPage/>
  }
  return <div className="app-shell">
    <aside className={`sidebar ${mobileOpen ? 'open' : ''}`}><div className="brand"><div><Command size={20}/></div><span>FACILITY<strong>COMMAND</strong></span><button className="mobile-close" onClick={()=>setMobileOpen(false)}><X/></button></div>
      <nav><span className="nav-label">WORKSPACE</span>{nav.map(([name, Icon]) => <button className={active===name?'active':''} onClick={()=>navigate(name)} key={name}><Icon size={18}/><span>{name}</span>{name==='Work Orders'&&<b>{workOrders.length}</b>}</button>)}</nav>
      <div className="sidebar-bottom"><div className="user"><div className="avatar">{initials('Ahmed Faisal')}</div><div><strong>Ahmed Faisal</strong><span>Facility Manager</span></div><MoreHorizontal size={18}/></div></div>
    </aside>
    <main><header className="topbar"><button className="menu-btn" onClick={()=>setMobileOpen(true)}><Menu/></button><div className="crumb"><span>Facility Command</span><ChevronRight size={14}/><strong>{active}</strong></div><div className="top-actions"><button className="global-search" onClick={()=>document.querySelector('.register input')?.focus()}><Search size={16}/><span>Search anything</span><kbd>⌘ K</kbd></button><button className="icon-button sla-notification" title={`${allWorkOrders.filter(slaBreached).length} overdue work orders`} onClick={()=>{setActive('Work Orders');setMobileOpen(false)}}><Bell size={19}/>{allWorkOrders.filter(slaBreached).length>0&&<b>{allWorkOrders.filter(slaBreached).length}</b>}</button><div className="top-avatar" title="Ahmed Faisal · Facility Manager">AF</div></div></header>
      <div className="content">{active==='Overview'?<OverviewPage onNavigate={navigate}/>:pages[active]}</div>
      <footer><span>Facility Command · Mock data generated from provided Excel files</span><span>{statusMatrix.length} Maximo status rules loaded</span></footer>
    </main>
  </div>
}

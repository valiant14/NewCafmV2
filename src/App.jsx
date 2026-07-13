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
import SettingsPage from './pages/SettingsPage'
import Badge from './components/ui/Badge'
import Button from './components/ui/Button'
import Field from './components/ui/Field'
import Section from './components/ui/Section'
import AppShell from './components/layout/AppShell'
import { navigationItems, pathForPage, routeToPage } from './config/navigation'
import { assets, workOrders, pmRecords, jobTasks, failureCodes, statusMatrix, failureClassOptions, uniqueCodeOptions, excelDate, toDateTimeInput, slaBreached } from './data/cafmData'


const nav = [
  ['Overview', LayoutDashboard], ['Job Requests', FileText], ['Work Orders', ClipboardList], ['Assets', Boxes],
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
const twoColumnGridClass = 'grid grid-cols-1 gap-4 md:grid-cols-2'
const srFormGridClass = 'grid grid-cols-1 gap-0'
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
const inlineAddClass = 'mb-2 inline-flex items-center gap-2 rounded-lg bg-[#edf3ee] px-2.5 py-1.5 text-xs font-bold text-[#386c52] transition hover:bg-[#e2eee7]'
const planWorkspaceClass = 'grid gap-3'
const planActionsClass = 'flex flex-wrap gap-2'
const plannerTableClass = 'overflow-hidden rounded-2xl border border-[var(--app-line)] bg-[var(--app-table-bg)]'
const plannerHeadClass = 'grid grid-cols-[1fr_120px_1fr_40px] gap-2 bg-[var(--app-table-header-bg)] px-3 py-2 text-[length:var(--app-table-header-font-size)] font-extrabold uppercase tracking-[.08em] text-[var(--app-table-heading)]'
const plannerResourceHeadClass = 'grid grid-cols-[120px_1fr_110px_40px] gap-2 bg-[var(--app-table-header-bg)] px-3 py-2 text-[length:var(--app-table-header-font-size)] font-extrabold uppercase tracking-[.08em] text-[var(--app-table-heading)]'
const plannerTaskHeadClass = 'grid grid-cols-[90px_1fr_120px_40px] gap-2 bg-[var(--app-table-header-bg)] px-3 py-2 text-[length:var(--app-table-header-font-size)] font-extrabold uppercase tracking-[.08em] text-[var(--app-table-heading)]'
const plannerRowClass = 'grid grid-cols-[1fr_120px_1fr_40px] items-center gap-2 border-t border-[var(--app-line)] px-3 py-2 text-[length:var(--app-table-font-size)] text-[var(--app-table-text)] hover:bg-[var(--app-table-hover-bg)] [&_input]:h-9 [&_input]:rounded-lg [&_input]:border [&_input]:border-[var(--app-line)] [&_input]:bg-[var(--app-table-bg)] [&_input]:px-2.5 [&_input]:text-[length:var(--app-table-font-size)] [&_input]:text-[var(--app-table-text)] [&_select]:h-9 [&_select]:rounded-lg [&_select]:border [&_select]:border-[var(--app-line)] [&_select]:bg-[var(--app-table-bg)] [&_select]:px-2.5 [&_select]:text-[length:var(--app-table-font-size)] [&_select]:text-[var(--app-table-text)] [&_button]:rounded-lg [&_button]:p-2 [&_button]:text-[var(--app-muted)] [&_button:hover]:bg-[var(--app-table-hover-bg)]'
const plannerResourceRowClass = plannerRowClass.replace('grid-cols-[1fr_120px_1fr_40px]', 'grid-cols-[120px_1fr_110px_40px]')
const plannerTaskRowClass = plannerRowClass.replace('grid-cols-[1fr_120px_1fr_40px]', 'grid-cols-[90px_1fr_120px_40px]')
const plannerEmptyClass = 'border-t border-[var(--app-line)] px-3 py-6 text-center text-sm text-[var(--app-muted)]'
const woOverviewLayoutClass = 'grid items-start gap-3 lg:grid-cols-2'
const woOverviewColumnClass = 'grid content-start gap-3'
const actualsLockedClass = 'mx-auto grid max-w-3xl gap-4 rounded-2xl border border-[var(--app-line)] bg-white p-5 text-left shadow-[0_8px_24px_rgba(32,55,45,.06)] md:grid-cols-[48px_1fr]'
const actualsIconClass = 'grid h-12 w-12 place-items-center rounded-xl bg-[#edf4ef] text-[#4f7963]'
const completionTimingClass = breached => [
  'flex flex-wrap items-center justify-between gap-4 rounded-2xl border bg-white p-0 overflow-hidden',
  breached ? 'border-[#f0cfbc]' : 'border-[var(--app-line)]'
].join(' ')
const completionTimingGridClass = 'grid flex-1 grid-cols-1 md:grid-cols-3'
const completionTimingCellClass = 'grid gap-1 border-b border-[#edf0ec] p-3 text-[9px] font-extrabold uppercase tracking-[.12em] text-[#7f8a84] md:border-b-0 md:border-r'
const actualResourceListClass = 'grid gap-2'
const actualResourceRowClass = 'flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[#e1e6e0] bg-[#f8faf7] p-3 [&>span]:flex [&>span]:items-center [&>span]:gap-2 [&>span]:text-[#527461] [&_strong]:text-sm [&_strong]:text-[var(--app-ink)] [&_label]:flex [&_label]:items-center [&_label]:gap-2 [&_label]:text-xs [&_label]:text-[var(--app-muted)] [&_input]:h-9 [&_input]:w-24 [&_input]:rounded-lg [&_input]:border [&_input]:border-[#d9e0d9] [&_input]:bg-white [&_input]:px-3 [&_input]:text-sm'
const closeoutGridClass = 'grid gap-3 md:grid-cols-4'
const closeoutCardClass = 'grid gap-1 rounded-xl border border-[#e1e6e0] bg-[#f8faf7] p-3 [&_span]:text-[9px] [&_span]:font-extrabold [&_span]:uppercase [&_span]:tracking-[.1em] [&_span]:text-[#7d8881] [&_strong]:text-sm [&_strong]:text-[var(--app-ink)]'
const materialsTableClass = 'overflow-hidden rounded-2xl border border-[var(--app-line)] bg-[var(--app-table-bg)]'
const materialsHeadClass = 'grid grid-cols-[1.4fr_130px_150px_170px_190px] gap-3 bg-[var(--app-table-header-bg)] px-4 py-3 text-[length:var(--app-table-header-font-size)] font-extrabold uppercase tracking-[.08em] text-[var(--app-table-heading)]'
const materialsRowClass = 'grid grid-cols-[1.4fr_130px_150px_170px_190px] items-center gap-3 border-t border-[var(--app-line)] px-4 py-3 text-[length:var(--app-table-font-size)] text-[var(--app-table-text)] hover:bg-[var(--app-table-hover-bg)]'
const resourceIconClass = type => `grid h-9 w-9 place-items-center rounded-xl ${type === 'Material' ? 'bg-[#eaf3ee] text-[#47785f]' : 'bg-[#eaf2f5] text-[#47798c]'}`
const materialsSummaryClass = blocked => `mt-3 flex items-start gap-3 rounded-2xl p-4 ${blocked ? 'bg-[#fff0e6] text-[#ad5c32]' : 'bg-[#eaf3ee] text-[#397458]'}`
const materialsEmptyClass = 'grid min-h-40 place-items-center content-center gap-2 rounded-2xl border border-dashed border-[#d8e1da] bg-[#fbfcfa] p-6 text-center text-[var(--app-muted)]'
const documentsWorkspaceClass = 'grid gap-3 lg:grid-cols-2'
const ptwCardClass = required => `flex flex-wrap items-center justify-between gap-4 rounded-2xl border bg-white p-3 ${required ? 'border-[#f0cfbc]' : 'border-[var(--app-line)]'} lg:col-span-2`
const ptwToggleButtonClass = active => `rounded-lg px-4 py-2 text-xs font-bold transition ${active ? 'bg-white text-[#315a47] shadow-sm' : 'text-[#66746c] hover:text-[#315a47]'}`
const documentCardClass = 'rounded-2xl border border-[var(--app-line)] bg-white p-3 [&>header]:mb-3 [&>header]:flex [&>header]:items-start [&>header]:justify-between [&>header]:gap-3 [&>header]:border-b [&>header]:border-[#edf0ec] [&>header]:pb-3 [&_header_span]:text-[9px] [&_header_span]:font-extrabold [&_header_span]:uppercase [&_header_span]:tracking-[.12em] [&_header_span]:text-[#718079] [&_header_h3]:mt-1 [&_header_h3]:text-base [&_header_h3]:font-extrabold [&_header_h3]:text-[var(--app-ink)] [&_header_p]:mt-1 [&_header_p]:text-xs [&_header_p]:text-[var(--app-muted)]'
const compactUploadClass = 'relative mb-4 grid cursor-pointer place-items-center gap-2 rounded-2xl border border-dashed border-[#ccd8cf] bg-[#fbfcfa] p-6 text-center text-[var(--app-muted)]'
const documentListClass = 'grid overflow-hidden rounded-2xl border border-[#edf0ec] [&>div]:flex [&>div]:items-center [&>div]:gap-3 [&>div]:border-b [&>div]:border-[#edf0ec] [&>div]:p-3 [&>div:last-child]:border-b-0 [&_strong]:text-sm [&_strong]:text-[var(--app-ink)] [&_small]:text-xs [&_small]:text-[var(--app-muted)] [&_button]:ml-auto [&_button]:rounded-lg [&_button]:p-2 [&_button]:text-[#987365] [&_button:hover]:bg-[#fff0e6]'
const documentRowClass = 'flex items-center gap-3 border-b border-[#edf0ec] p-3 last:border-b-0'
const autosaveClass = state => `inline-flex h-9 items-center gap-2 rounded-xl px-3 text-xs font-bold ${state === 'Saving' ? 'bg-[#f1f3f0] text-[#7b857f]' : 'bg-[#edf4ef] text-[#47785f]'}`
const autoStatusClass = 'inline-flex h-9 items-center gap-2 rounded-xl bg-[#f7faf7] px-3 text-xs text-[var(--app-muted)] [&_strong]:text-[var(--app-ink)]'
const failureFieldsClass = 'grid grid-cols-1 gap-3 md:grid-cols-2'
const failureSelectionMapClass = 'mt-3 grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4'
const failureStageClass = selected => `rounded-2xl border p-3 ${selected ? 'border-[#b9d6c3] bg-[#f1f8f3]' : 'border-[#e4ebe4] bg-[#fbfcfa]'}`
const failureStageTopClass = 'mb-2 flex items-center justify-between gap-2 text-[9px] font-extrabold uppercase tracking-[.1em] text-[#7b8780]'
const failureEmptyClass = 'text-xs italic leading-relaxed text-[var(--app-muted)]'
const failureLibraryNoteClass = 'mt-3 flex items-center gap-2 rounded-2xl border border-[#dfe8df] bg-[#f8faf7] p-3 text-xs text-[var(--app-muted)]'
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
  const actualsEditable = workCompleted
  const number = order.WORKORDER || 'AUTO'
  const targetFinishTime=targetFinish?new Date(targetFinish).getTime():null
  const actualFinishTime=actualFinish?new Date(actualFinish).getTime():null
  const slaBreachedNow=Boolean(targetFinishTime&&((actualFinishTime&&actualFinishTime>targetFinishTime)||(!actualFinishTime&&Date.now()>targetFinishTime)))
  const slaLabel=!targetFinishTime?'Not defined':actualFinishTime?(slaBreachedNow?'No â€“ SLA Breached':'Yes â€“ SLA Met'):(slaBreachedNow?'No â€“ SLA Breached':'Pending â€“ Within SLA')
  const close = () => onClose()
  const reroute=()=>{setTab('Overview');setAssignedDepartment('');setSupervisor('');setWorkStarted(false)}
  const addFiles=(setter)=>event=>{const files=Array.from(event.target.files||[]).map(file=>({name:file.name,size:file.size>1048576?`${(file.size/1048576).toFixed(1)} MB`:`${Math.max(1,Math.round(file.size/1024))} KB`,type:file.type||'Document'}));setter(current=>[...current,...files]);event.target.value=''}
  const completeWork=()=>{if(!failureReady){setTab('Failure');return}const now=toDateTimeInput(new Date());setActualFinish(now);setActualStart(current=>current||now);setActualMaterials(current=>current.length?current:plannedResources.filter(row=>row.type==='Material').map(row=>({...row,actualQuantity:''})));setActualTools(current=>current.length?current:plannedResources.filter(row=>['Tool','Equipment'].includes(row.type)).map(row=>({...row,actualQuantity:''})));setWorkCompleted(true)}
  useEffect(()=>{setAutoSaveState('Saving');const timer=setTimeout(()=>setAutoSaveState('Saved'),450);return()=>clearTimeout(timer)},[description,longDescription,priority,department,subDepartment,assignedDepartment,workGroup,supervisor,laborCraft,siteValue,assetValue,assetDescription,locationValue,targetStart,targetFinish,failureClass,problemCode,causeCode,remedyCode,plannedLabor,plannedResources,plannedTasks,ptwRequired,ptwFiles,generalFiles,technicianRemarks,completionNotes,actualLabor,actualHours,actualMaterials,actualTools,actualStart,actualFinish,workAssigned,workStarted,workCompleted,workClosed])
  return <div className={page?'w-full':'fixed inset-0 z-50 overflow-auto bg-[color:color-mix(in_srgb,var(--app-sidebar-bg)_72%,transparent)] p-6 backdrop-blur-sm'}><div className={page?'mx-auto w-full max-w-[1400px] space-y-3 bg-transparent p-0':'mx-auto max-w-7xl space-y-4 rounded-3xl bg-[var(--app-panel)] p-0 shadow-2xl'}>
    <header className={workOrderHeaderClass}><div className={workOrderHeaderTopClass}><div><button className={workOrderBackClass} onClick={close}>Back to Work Order Tracking</button><div className="mt-2 flex flex-wrap items-center gap-3"><h2 className={workOrderTitleClass}>{number === 'AUTO' ? 'New work order' : `Work order #${number}`}</h2><Badge tone={isPM?'blue':'purple'}>{workType}</Badge><Badge tone="orange">{status}</Badge></div><p className={workOrderDescriptionClass}>{order['DESCRIPITION '] || order.DESCRIPTION || 'Enter work order information'}</p></div><div className={`${workOrderHeaderActionsClass} self-center`}><div className={autosaveClass(autoSaveState)}>{autoSaveState==='Saving'?<span className="h-2 w-2 animate-spin rounded-full border-2 border-[#a5aea9] border-t-[#557465]"/>:<Check size={13}/>}<span>{autoSaveState==='Saving'?'Saving…':'All changes saved'}</span></div><div className={autoStatusClass}><span>Automatic status</span><strong>{status}</strong></div>{status==='Waiting'&&<button className={woPrimaryButtonClass} disabled={!overviewReady} onClick={()=>setWorkAssigned(true)}><Users size={15}/>Assign department</button>}{status==='ASSIGNED'&&<button className={woPrimaryButtonClass} disabled={!preparationReady} onClick={()=>setWorkStarted(true)}><Wrench size={15}/>Start work</button>}{status==='INPRG'&&<button className={woPrimaryButtonClass} disabled={!failureReady} onClick={completeWork} title={!failureReady?'Failure Code and Problem Code are required before completion':''}><Check size={15}/>Resolve / complete</button>}{status==='COMP'&&<button className={woPrimaryButtonClass} disabled={!actualReady} onClick={()=>setWorkClosed(true)}><Check size={15}/>Close work order</button>}<button className={woOutlineButtonClass} onClick={reroute}><RotateCcw size={15}/> Re-route</button><button className={woOutlineButtonClass} onClick={()=>window.print()}><Printer size={15}/> Print</button></div></div></header>
    <div className={workOrderTabsClass}>{workOrderTabs.map((name,index)=><button key={name} className={workOrderTabClass(tab===name)} onClick={()=>setTab(name)}><small className={workOrderTabIndexClass}>{String(index+1).padStart(2,'0')}</small>{name}{name==='Failure'&&!isPM&&<i className="absolute right-2 top-2 h-1.5 w-1.5 rounded-full bg-[var(--orange)]"/>}</button>)}</div>
    <div className={workOrderBodyClass}>
      {tab==='Overview' && <><div className={woOverviewLayoutClass}><div className={woOverviewColumnClass}>
        <Section compact title="Work Order Details" note="Basic CM/PM information and request description"><div className={twoColumnGridClass}>
          <Field label="Work Order Number" value={String(number)} locked/><Field label="Status" value={status} locked/><Field label="Work Type" value={workType} required locked options={['CM','PM','Incident','SR']}/><Field label="Priority" value={priority} required onChange={e=>setPriority(e.target.value)} options={['1 - Emergency','2 - High','3 - Medium','4 - Low']}/>
          <Field label="Description" value={description} required onChange={e=>setDescription(e.target.value)}/><Field label="Site" value={siteValue} required onChange={changeSite} suggestions={siteOptions} placeholder="Search or select a site"/><div className="md:col-span-2"><Field label="Long Description" value={longDescription} onChange={e=>setLongDescription(e.target.value)} type="textarea"/></div>
        </div></Section>
        <Section compact title="Asset & Location" note="Equipment, facility, and project relationship"><div className={twoColumnGridClass}><Field label="Asset" value={assetValue} required onChange={changeAsset} suggestions={assetOptions} placeholder="Search asset number or description"/><Field label="Location" value={locationValue} required onChange={e=>setLocationValue(e.target.value)} suggestions={locationOptions} placeholder="Search or select a location"/><Field label="Asset Description" value={assetDescription} required onChange={e=>setAssetDescription(e.target.value)} placeholder="Required asset description"/><Field label="Project" value="Royal Court Facilities" required locked/></div></Section>
      </div><div className={woOverviewColumnClass}>
        <Section compact title="Department & Ownership" note="Responsible department, assignment, and craft routing"><div className={twoColumnGridClass}>
          <Field label="Department" value={department} required onChange={e=>{setDepartment(e.target.value);setSubDepartment('')}} suggestions={departmentOptions} placeholder="Search department"/><Field label="Sub Department" value={subDepartment} onChange={e=>setSubDepartment(e.target.value)} suggestions={subDepartmentOptions} placeholder="Search sub department"/><Field label="Assigned Department" value={assignedDepartment} required onChange={e=>{setAssignedDepartment(e.target.value);setWorkGroup('');setSupervisor('')}} suggestions={departmentOptions} placeholder="Search assigned department"/><Field label="Work Group" value={workGroup} onChange={e=>setWorkGroup(e.target.value)} suggestions={workGroupOptions} placeholder="Search or select a work group"/>
          <Field label="Supervisor" value={supervisor} onChange={e=>setSupervisor(e.target.value)} suggestions={supervisorOptions} placeholder="Search supervisor name or craft"/><Field label="Labor Craft Code" value={laborCraft} onChange={e=>setLaborCraft(e.target.value)} suggestions={laborCraftOptions} placeholder="Search craft code or description"/>
        </div></Section>
        <Section compact title="Target Dates" note="Schedule and actual timing for SLA tracking"><div className={twoColumnGridClass}>
          <Field label="Reported Date" value={toDateTimeInput(order['REPORTED DATE']||order['REPORT DATE'])||new Date().toISOString().slice(0,16)} type="datetime-local" locked/><Field label="Target Start" value={targetStart} onChange={e=>setTargetStart(e.target.value)} type="datetime-local" locked={isPM}/><Field label="Target Finish" value={targetFinish} onChange={e=>setTargetFinish(e.target.value)} type="datetime-local"/><Field label="Actual Start" value={actualStart} type="datetime-local" locked/><Field label="Actual Finish" value={actualFinish} type="datetime-local" locked/><Field label="SLA Met?" value={slaLabel} locked/>
        </div></Section>
      </div></div></>}
      {tab==='Plan' && <>
        <div className={planWorkspaceClass}><Section compact title="Planned Labor" note={isPM?'Generated from the linked job plan':'Add the crafts, crews, and estimated hours required'}>{!isPM&&<button className={inlineAddClass} onClick={()=>setPlannedLabor(rows=>[...rows,{craft:'',hours:'',crew:''}])}><Plus size={15}/>Add labor</button>}<datalist id="planned-craft-options">{plannedCraftOptions.map(item=><option value={item.value} key={item.value}>{item.label}</option>)}</datalist><datalist id="planned-crew-options">{plannedCrewOptions.map(item=><option value={item.value} key={item.value}>{item.label}</option>)}</datalist><div className={plannerTableClass}><div className={plannerHeadClass}><span>Labor craft</span><span>Estimated hours</span><span>Assigned crew</span><span></span></div>{plannedLabor.map((row,index)=><div className={plannerRowClass} key={index}><input value={row.craft} list="planned-craft-options" readOnly={isPM} onChange={e=>updatePlanRow(setPlannedLabor,index,'craft',e.target.value)} placeholder="Search craft code or description"/><input value={row.hours} readOnly={isPM} type="number" onChange={e=>updatePlanRow(setPlannedLabor,index,'hours',e.target.value)} placeholder="Hours"/><input value={row.crew} list="planned-crew-options" readOnly={isPM} onChange={e=>updatePlanRow(setPlannedLabor,index,'crew',e.target.value)} placeholder="Search technician or crew"/>{!isPM&&<button onClick={()=>setPlannedLabor(rows=>rows.filter((_,i)=>i!==index))}><X size={14}/></button>}</div>)}</div></Section>
        <Section compact title="Planned Materials & Tools" note="Request resources and enter the required count. Availability is managed in Materials.">{!isPM&&<div className={planActionsClass}><button className={inlineAddClass} onClick={()=>setPlannedResources(rows=>[...rows,{type:'Material',item:'',quantity:'',availability:'Available'}])}><Plus size={15}/>Add material</button><button className={inlineAddClass + ' bg-[#eaf2f5] text-[#47798c] hover:bg-[#dfeef3]'} onClick={()=>setPlannedResources(rows=>[...rows,{type:'Tool',item:'',quantity:'',availability:'Available'}])}><Plus size={15}/>Add tool</button></div>}<datalist id="planned-material-options">{materialMaster.map(item=><option value={item.description} key={item.itemNumber}>{item.itemNumber} Â· {item.category}</option>)}</datalist><datalist id="planned-tool-options">{toolMaster.map(item=><option value={item.description} key={item.toolNumber}>{item.toolNumber} Â· {item.category}</option>)}</datalist><div className={plannerTableClass}><div className={plannerResourceHeadClass}><span>Type</span><span>Item / description</span><span>Quantity</span><span></span></div>{plannedResources.length?plannedResources.map((row,index)=><div className={plannerResourceRowClass} key={index}><select value={row.type} disabled={isPM} onChange={e=>updatePlanRow(setPlannedResources,index,'type',e.target.value)}><option>Material</option><option>Tool</option><option>Equipment</option></select><input value={row.item} list={row.type==='Material'?'planned-material-options':'planned-tool-options'} readOnly={isPM} onChange={e=>updatePlannedResource(index,e.target.value)} placeholder={`Search ${row.type.toLowerCase()} number or description`}/><input value={row.quantity} type="number" min="1" step="1" readOnly={isPM} onChange={e=>updatePlanRow(setPlannedResources,index,'quantity',e.target.value)} placeholder="Enter count"/>{!isPM&&<button onClick={()=>setPlannedResources(rows=>rows.filter((_,i)=>i!==index))}><X size={14}/></button>}</div>):<div className={plannerEmptyClass}>No planned materials or tools yet.</div>}</div></Section>
        <Section compact title="Job Tasks" note="Configure sequence, instructions, and expected duration">{!isPM&&<button className={inlineAddClass} onClick={()=>setPlannedTasks(rows=>[...rows,{sequence:(rows.length+1)*10,description:'',duration:''}])}><Plus size={15}/>Add task</button>}<div className={plannerTableClass}><div className={plannerTaskHeadClass}><span>Sequence</span><span>Task instruction</span><span>Duration (min)</span><span></span></div>{plannedTasks.map((row,index)=><div className={plannerTaskRowClass} key={index}><input type="number" value={row.sequence} readOnly={isPM} onChange={e=>updatePlanRow(setPlannedTasks,index,'sequence',e.target.value)}/><input value={row.description} readOnly={isPM} onChange={e=>updatePlanRow(setPlannedTasks,index,'description',e.target.value)} placeholder="Describe the task to complete"/><input type="number" value={row.duration} readOnly={isPM} onChange={e=>updatePlanRow(setPlannedTasks,index,'duration',e.target.value)} placeholder="Minutes"/>{!isPM&&<button onClick={()=>setPlannedTasks(rows=>rows.filter((_,i)=>i!==index))}><X size={14}/></button>}</div>)}</div></Section></div></>}
      {tab==='Actual' && <>{!actualsEditable?<div className={actualsLockedClass}><div className={actualsIconClass}><ShieldCheck size={22}/></div><div><strong>Available after work completion</strong><p>{status==='ASSIGNED'?'Complete Plan and Failure preparation, then select Start Work. When execution is finished, select Resolve / Complete.':'When physical work is finished, select Resolve / Complete in the header to unlock execution notes and actual consumption.'}</p><span>Current status: {status}</span>{status==='ASSIGNED'&&!preparationReady&&<button className={woOutlineButtonClass} onClick={()=>setTab(planReady?'Failure':'Plan')}>Complete {planReady?'Failure':'Plan'} preparation</button>}{status==='ASSIGNED'&&preparationReady&&<button className={woPrimaryButtonClass} onClick={()=>setWorkStarted(true)}>Start work</button>}{status==='INPRG'&&<button className={woPrimaryButtonClass} onClick={completeWork}>Resolve / complete work</button>}</div></div>:<>
        <div className={completionTimingClass(slaBreachedNow)}><div className={completionTimingGridClass}><span className={completionTimingCellClass}>Target Start<strong className="text-xs normal-case tracking-normal text-[var(--app-ink)]">{targetStart?new Date(targetStart).toLocaleString():'Not defined'}</strong></span><span className={completionTimingCellClass}>Target Finish<strong className="text-xs normal-case tracking-normal text-[var(--app-ink)]">{targetFinish?new Date(targetFinish).toLocaleString():'Not defined'}</strong></span><span className={completionTimingCellClass}>Actual Finish<strong className="text-xs normal-case tracking-normal text-[var(--app-ink)]">{actualFinish?new Date(actualFinish).toLocaleString():'Not recorded'}</strong></span></div><div className="p-3"><Badge tone={slaBreachedNow?'orange':'green'}>{slaLabel}</Badge></div></div><Section compact title="Execution Notes"><div className={twoColumnGridClass}><Field label="Technician Remarks" value={technicianRemarks} onChange={e=>setTechnicianRemarks(e.target.value)} type="textarea" required/><Field label="Completion Notes" value={completionNotes} onChange={e=>setCompletionNotes(e.target.value)} type="textarea" required/></div></Section>
        <Section compact title="Actual Labor"><div className={formGridClass}><Field label="Technician / Labor" value={actualLabor} onChange={e=>setActualLabor(e.target.value)} required/><Field label="Labor Craft Code" value={laborCraft} onChange={e=>setLaborCraft(e.target.value)} required/><Field label="Actual Labor Hours" value={actualHours} onChange={e=>setActualHours(e.target.value)} type="number" required/><Field label="Actual Start" value={actualStart} onChange={e=>setActualStart(e.target.value)} type="datetime-local"/></div></Section>
        <Section compact title="Actual Materials Used" note="Required for CM closeout"><div className={actualResourceListClass}>{actualMaterials.map((row,index)=><div className={actualResourceRowClass} key={`${row.item}-${index}`}><span><PackageCheck size={15}/><strong>{row.item}</strong></span><label>Actual quantity<input type="number" min="0" value={row.actualQuantity} onChange={e=>updateActualRow(setActualMaterials,index,e.target.value)} placeholder="0"/></label></div>)}</div></Section>
        <Section compact title="Actual Tools and Equipment Used" note="Required for CM closeout"><div className={actualResourceListClass}>{actualTools.map((row,index)=><div className={actualResourceRowClass} key={`${row.item}-${index}`}><span><Wrench size={15}/><strong>{row.item}</strong></span><label>Actual quantity<input type="number" min="0" value={row.actualQuantity} onChange={e=>updateActualRow(setActualTools,index,e.target.value)} placeholder="0"/></label></div>)}</div></Section><Section compact title="Automatic Closeout" note="System populated when the work order is closed"><div className={closeoutGridClass}><div className={closeoutCardClass}><span>Completion Date</span><strong>{actualFinish?new Date(actualFinish).toLocaleString():'Pending'}</strong></div><div className={closeoutCardClass}><span>Closed By</span><strong>{workClosed?'Ahmed Faisal':'Pending'}</strong></div><div className={closeoutCardClass}><span>Close Status</span><strong>{workClosed?'CLOSE':'Pending'}</strong></div><div className={closeoutCardClass}><span>Asset History Update</span><strong>{workClosed?'Updated automatically':'Pending close'}</strong></div></div></Section></>}</>}
      {tab==='Failure' && <Section compact title="Failure Classification" note={isCM?'Failure Class and Problem are required for corrective maintenance':'Optional for this work order type'}><div className={failureFieldsClass}><Field label="Failure Code" value={failureClass} required={isCM} onChange={changeFailure} suggestions={failureClassOptions} placeholder="Search code or description"/><Field label="Problem Code" value={problemCode} required={isCM} onChange={e=>{setProblemCode(e.target.value);setCauseCode('');setRemedyCode('')}} suggestions={problemOptions} placeholder={failureClass?'Search matching problems':'Select failure code first'}/><Field label="Cause Code (Optional)" value={causeCode} onChange={e=>{setCauseCode(e.target.value);setRemedyCode('')}} suggestions={causeOptions} placeholder={problemCode?'Search cause code or description':'Select problem code first'}/><Field label="Remedy Code (Optional)" value={remedyCode} onChange={e=>setRemedyCode(e.target.value)} suggestions={remedyOptions} placeholder={problemCode?'Search remedy code or description':'Select problem code first'}/></div><div className={failureSelectionMapClass}>{[
          {step:'01',label:'Failure class',code:failureClass,description:failureDescription,required:true},
          {step:'02',label:'Problem',code:problemCode,description:problemDescription,required:true},
          {step:'03',label:'Cause',code:causeCode,description:causeDescription},
          {step:'04',label:'Remedy',code:remedyCode,description:remedyDescription}
        ].map((item,index)=><div className={failureStageClass(Boolean(item.code))} key={item.label}><div className={failureStageTopClass}><span>{item.step}</span><strong>{item.label}</strong><em>{item.required?'Required':'Optional'}</em></div>{item.code?<><b className="block text-sm font-extrabold text-[var(--app-ink)]">{item.code}</b><p className="mt-1 text-xs leading-relaxed text-[var(--app-muted)]">{item.description||'Description not available for this code.'}</p></>:<p className={failureEmptyClass}>{index===0?'Select a failure class to begin':`No ${item.label.toLowerCase()} selected`}</p>}</div>)}</div><div className={failureLibraryNoteClass}><Search size={15}/><span>{failureCodes.length.toLocaleString()} Excel failure records available Â· codes and descriptions are filtered by hierarchy</span></div></Section>}
        {tab==='Material Requests' && <Section compact title="Material Requests" note="Generated from resources requested in the Plan tab. Materials, tools, and equipment are handled directly inside this work order.">{resourceRequests.length?<><div className={materialsTableClass}><div className={materialsHeadClass}><span>Planned resource</span><span>Requested quantity</span><span>Store / source</span><span>Availability</span><span>Action</span></div>{plannedResources.map((resource,index)=>['Material','Tool','Equipment'].includes(resource.type)?<div className={materialsRowClass} key={index}><div className="flex min-w-0 items-center gap-3"><span className={resourceIconClass(resource.type)}>{resource.type==='Material'?<PackageCheck size={16}/>:<Wrench size={16}/>}</span><div className="grid min-w-0 gap-0.5"><small className="text-[10px] font-bold uppercase tracking-[.08em] text-[#8a938e]">{resource.type}</small><strong className="truncate text-sm text-[var(--app-ink)]">{resource.item||`Unnamed planned ${resource.type.toLowerCase()}`}</strong></div></div><span>{resource.quantity||'Not set'}</span><span>{resource.type==='Material'?'DIWAN-MAIN':'Tool Crib'}</span><select className="h-10 rounded-xl border border-[#d8ded8] bg-white px-3 text-sm" value={resource.availability} onChange={e=>updatePlanRow(setPlannedResources,index,'availability',e.target.value)}><option>Available</option><option>Purchase Required</option></select><button className={resource.availability==='Available'?woPrimaryButtonClass:woOutlineButtonClass}>{resource.availability==='Available'?(resource.type==='Material'?'Reserve':'Allocate'):'Create purchase request'}</button></div>:null)}</div><div className={materialsSummaryClass(materialBlocked)}>{materialBlocked?<AlertTriangle size={18}/>:<Check size={18}/>}<div className="grid gap-1"><strong className="text-sm">{materialBlocked?'Waiting for Spare Parts':'Resources ready for execution'}</strong><span className="text-xs">{materialBlocked?'One or more planned material items require purchase. Work Order status changed automatically to Waiting for Spare Parts.':'Planned materials, tools, and equipment are available for reservation or allocation.'}</span></div></div></>:<div className={materialsEmptyClass}><PackageCheck size={28}/><strong className="text-sm text-[var(--app-ink)]">No resources requested</strong><p className="text-xs">Add materials, tools, or equipment in the Plan tab.</p><button className={woOutlineButtonClass} onClick={()=>setTab('Plan')}>Go to Plan</button></div>}</Section>}
      {tab==='PTW & Files' && <div className={documentsWorkspaceClass}><section className={ptwCardClass(ptwRequired)}><div className="flex items-center gap-3"><span className="grid h-9 w-9 place-items-center rounded-xl bg-[#eaf3ee] text-[#47785f]"><ShieldCheck size={20}/></span><div><strong>Permit to Work required?</strong><p className="text-xs text-[var(--app-muted)]">Default is No. Enable only when execution requires an approved permit.</p></div></div><div className="flex rounded-xl border border-[#dfe5df] bg-[#f8faf7] p-1"><button className={ptwToggleButtonClass(!ptwRequired)} onClick={()=>setPtwRequired(false)}>No</button><button className={ptwToggleButtonClass(ptwRequired)} onClick={()=>setPtwRequired(true)}>Yes</button></div></section>{ptwRequired?<section className={documentCardClass}><header><div><span>PTW</span><h3>Permit documents</h3><p>Upload one or more approved permits before execution.</p></div><Badge tone={ptwFiles.length?'green':'orange'}>{ptwFiles.length?'Permit attached':'Permit missing'}</Badge></header><label className={compactUploadClass}><Upload size={18}/><div><strong>Add PTW documents</strong><span>PDF, DOCX, JPG or PNG Â· multiple files accepted</span></div><input type="file" multiple onChange={addFiles(setPtwFiles)}/></label>{ptwFiles.length>0&&<div className={documentListClass}>{ptwFiles.map((file,index)=><div key={`${file.name}-${index}`}><span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-[#edf4ef] text-[#47785f]"><FileText size={16}/></span><div><strong>{file.name}</strong><small>{file.size} Â· PTW document</small></div><Badge tone="green">Attached</Badge><button onClick={()=>setPtwFiles(files=>files.filter((_,i)=>i!==index))}><X size={14}/></button></div>)}</div>} {!ptwFiles.length&&<div className="m-3 flex items-center gap-2 rounded-xl bg-[#fff0e6] p-3 text-xs text-[#ad5c32]"><AlertTriangle size={16}/><span>Work Order status is Waiting for Permit until a PTW document is attached.</span></div>}</section>:<section className="flex min-h-40 items-center justify-center gap-3 rounded-2xl border border-[var(--app-line)] bg-white p-3 text-[#397458]"><Check size={18}/><div><strong>No permit required</strong><span className="block text-xs text-[var(--app-muted)]">This work order can proceed without a Permit to Work.</span></div></section>}<section className={documentCardClass}><header><div><span>FILES</span><h3>General attachments</h3><p>Photos, reports, drawings, and supporting documents.</p></div><Badge>{generalFiles.length} files</Badge></header><label className={compactUploadClass}><Upload size={18}/><div><strong>Add attachments</strong><span>Choose multiple files if needed</span></div><input type="file" multiple onChange={addFiles(setGeneralFiles)}/></label><div className={documentListClass}>{generalFiles.map((file,index)=><div key={`${file.name}-${index}`}><span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-[#edf4ef] text-[#47785f]"><FileText size={16}/></span><div><strong>{file.name}</strong><small>{file.size} Â· {file.type}</small></div><button onClick={()=>setGeneralFiles(files=>files.filter((_,i)=>i!==index))}><X size={14}/></button></div>)}</div></section></div>}
      {tab==='Meters' && <><div className={modeNoteClass('auto')}><Gauge size={18}/><div className="grid gap-1"><strong className="text-sm">Optional meter readings</strong><span className="text-xs text-[var(--app-muted)]">Complete only when readings are available or required by the related asset.</span></div></div><Section compact title="Meter Readings"><div className={formGridClass}><Field label="General Meter Reading" type="number"/><Field label="Water Consumption (mÂ³)" type="number"/><Field label="Energy Consumption (kWh)" type="number"/><Field label="Reading Date" type="datetime-local"/></div></Section></>}
    </div>
  </div></div>
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
    'Work Orders': <WorkOrdersPage rows={allWorkOrders} assets={assets} onCreate={createWorkOrder} EditorComponent={WorkOrderEditor} excelDate={excelDate} slaBreached={slaBreached}/>,
    'Assets': <AssetsPage initialAssets={assets} workOrders={allWorkOrders} />,
    'Preventive Maintenance': <PreventiveMaintenancePage assets={assets} jobTasks={jobTasks} workOrders={allWorkOrders} onGenerate={generatePmWorkOrder} onOpenWorkOrder={openConvertedWorkOrder}/>,
    'Locations': <LocationsPage/>,
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

















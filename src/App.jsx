import { useEffect, useId, useMemo, useState } from 'react'
import {
  Bell, Boxes, CalendarClock, Check, ChevronRight, CircleHelp, ClipboardList,
  Command, Filter, LayoutDashboard, MapPin, Menu, MoreHorizontal, Plus, Search,
  Settings, ShieldCheck, SlidersHorizontal, Sparkles, Users, Wrench, X,
  Printer, Upload, RotateCcw, PackageCheck, Gauge, FileText, Save, AlertTriangle
} from 'lucide-react'
import workbookData from './data/workbooks.json'
import ServiceRequestsPage, { initialRequests as serviceRequestSeed } from './pages/ServiceRequestsPage'
import WorkOrdersPage from './pages/WorkOrdersPage'

const excelDate = (value) => {
  if (!value || typeof value === 'string') return value || '—'
  const date = new Date(Date.UTC(1899, 11, 30) + value * 86400000)
  return new Intl.DateTimeFormat('en', { day: '2-digit', month: 'short', year: 'numeric' }).format(date)
}
const excelToDate = value => typeof value === 'number' ? new Date(Date.UTC(1899, 11, 30) + value * 86400000) : null
const slaBreached = order => {
  const finish = excelToDate(order['TARGET FINISH '])
  return Boolean(finish && finish < new Date() && !['COMP', 'CLOSE', 'CAN'].includes(order.STATUS))
}

const rowsToObjects = (rows = []) => {
  const headers = (rows[0] || []).map((header, index) => String(header || `Column ${index + 1}`).trim())
  return rows.slice(1).filter(row => row.some(value => value !== null && value !== '')).map(row =>
    Object.fromEntries(headers.map((header, index) => [header, row[index] ?? '']))
  )
}

const assets = rowsToObjects(workbookData.assets.assets)
const workOrders = rowsToObjects(workbookData['Work Order Tracking'].Sheet1)
const pmRecords = rowsToObjects(workbookData.PM['PREVENTIVE MAINTENANCE'])
const jobTasks = rowsToObjects(workbookData['JOB PLAN-TASKS']['JOB PLAN-TASKS'])
const failureCodes = rowsToObjects(workbookData['FAILURE CODE']['FAILURE CODE'])
const statusMatrix = rowsToObjects(workbookData.IBM_Maximo_Status_Matrix['Maximo Status Matrix'])
const uniqueCodeOptions = (rows, codeKey, descriptionKey) => [...new Map(rows.filter(row=>row[codeKey]).map(row=>[row[codeKey], { value: row[codeKey], label: row[descriptionKey] }])).values()]
const failureClassOptions = uniqueCodeOptions(failureCodes, 'FAILURE CLASS ID', 'DESCRIPTION')

const nav = [
  ['Overview', LayoutDashboard], ['Service Requests', FileText], ['Work Orders', ClipboardList], ['Assets', Boxes],
  ['Preventive Maintenance', CalendarClock], ['Locations', MapPin], ['Job Plans', Wrench],
  ['Failure Library', ShieldCheck]
]

const initials = (name) => name.split(' ').map(part => part[0]).join('').slice(0, 2).toUpperCase()

function Badge({ children, tone = 'neutral' }) {
  return <span className={`badge ${tone}`}><i />{children}</span>
}

function Metric({ label, value, detail, icon: Icon, tone }) {
  return <article className="metric-card">
    <div className={`metric-icon ${tone}`}><Icon size={19} /></div>
    <div><p>{label}</p><strong>{value}</strong><small>{detail}</small></div>
    <button aria-label={`View ${label}`}><ChevronRight size={18} /></button>
  </article>
}

function Donut({ value, label }) {
  return <div className="donut-wrap">
    <div className="donut" style={{ '--value': value }}><div><strong>{value}%</strong><span>{label}</span></div></div>
  </div>
}

function EmptyLocations() {
  return <div className="empty-state"><MapPin size={30} /><h3>No location records yet</h3><p>The Excel location file contains its field structure but no rows. Add locations when the source is ready.</p></div>
}

function DataTable({ rows, columns, search, pageSize = 12 }) {
  const normalized = search.toLowerCase().trim()
  const filtered = useMemo(() => !normalized ? rows : rows.filter(row =>
    Object.values(row).some(value => String(value).toLowerCase().includes(normalized))
  ), [rows, normalized])
  return <>
    <div className="table-shell"><table><thead><tr>{columns.map(column => <th key={column.key}>{column.label}</th>)}</tr></thead>
      <tbody>{filtered.slice(0, pageSize).map((row, index) => <tr key={index}>{columns.map(column =>
        <td key={column.key}>{column.render ? column.render(row[column.key], row) : (row[column.key] || '—')}</td>
      )}</tr>)}</tbody></table></div>
    <div className="table-footer"><span>Showing {Math.min(pageSize, filtered.length)} of {filtered.length.toLocaleString()} records</span><span>Source: Excel mock data</span></div>
  </>
}

function Overview({ onNavigate }) {
  const operating = assets.filter(a => a.status === 'OPERATING').length
  return <>
    <section className="welcome"><div><Badge tone="green">Live workspace</Badge><h1>Good morning, Ahmed.</h1><p>Here’s what needs attention across your facilities today.</p></div>
      <button className="primary" onClick={() => onNavigate('Work Orders')}><Plus size={17} /> New work order</button></section>
    <section className="metrics">
      <Metric label="Open work orders" value={workOrders.length} detail="All awaiting approval" icon={ClipboardList} tone="orange" />
      <Metric label="Assets online" value={`${operating}/${assets.length}`} detail="100% operational" icon={Boxes} tone="green" />
      <Metric label="PM programs" value={pmRecords.length} detail="Recurring schedules" icon={CalendarClock} tone="blue" />
      <Metric label="Failure codes" value={failureCodes.length.toLocaleString()} detail="Searchable library" icon={ShieldCheck} tone="purple" />
    </section>
    <section className="overview-grid">
      <article className="panel work-panel"><header><div><p className="eyebrow">OPERATIONS</p><h2>Active work orders</h2></div><button onClick={() => onNavigate('Work Orders')}>View all <ChevronRight size={16}/></button></header>
        <DataTable rows={workOrders} search="" pageSize={5} columns={[
          { key: 'WORKORDER', label: 'Order', render: v => <strong className="mono">#{v}</strong> },
          { key: 'DESCRIPITION', label: 'Description' },
          { key: 'LOCATION PRIORTY', label: 'Location', render: v => <Badge tone={v?.trim() === 'VIP' ? 'purple' : 'orange'}>{v}</Badge> },
          { key: 'STATUS', label: 'Status', render: v => <Badge tone="orange">{v}</Badge> },
          { key: 'TARGET START ', label: 'Target', render: excelDate }
        ]} />
      </article>
      <aside className="side-stack">
        <article className="panel health"><header><div><p className="eyebrow">PORTFOLIO</p><h2>Facility health</h2></div><MoreHorizontal /></header><Donut value={96} label="healthy" />
          <div className="health-row"><span><i className="green-dot"/>Operational</span><strong>{operating}</strong></div>
          <div className="health-row"><span><i className="orange-dot"/>Open orders</span><strong>{workOrders.length}</strong></div>
        </article>
        <article className="insight-card"><div className="spark"><Sparkles size={18}/></div><div><span>SMART INSIGHT</span><strong>All current work orders are PM-related.</strong><p>Bundle technician visits by site to reduce travel time.</p></div></article>
      </aside>
    </section>
    <section className="panel schedule"><header><div><p className="eyebrow">MAINTENANCE</p><h2>Preventive maintenance</h2></div><button onClick={() => onNavigate('Preventive Maintenance')}>Open schedule <ChevronRight size={16}/></button></header>
      <div className="pm-strip">{pmRecords.slice(0, 4).map((pm, index) => <div className="pm-item" key={pm.PMNUM}><div className="date-tile"><span>{String(index + 14).padStart(2, '0')}</span><small>JUL</small></div><div><strong>{pm['PM DESCRIPTION']}</strong><span>{pm.ASSETNUM} · {pm.FREQUENCY} {pm.FREQUNIT}</span></div><Badge tone={index === 0 ? 'orange' : 'blue'}>{index === 0 ? 'Due soon' : 'Scheduled'}</Badge></div>)}</div>
    </section>
  </>
}

function RegisterPage({ title, eyebrow, description, rows, columns, search, setSearch, action = 'Add record' }) {
  return <><section className="page-heading"><div><p className="eyebrow">{eyebrow}</p><h1>{title}</h1><p>{description}</p></div><button className="primary"><Plus size={17}/>{action}</button></section>
    <section className="panel register"><div className="register-tools"><div className="search-box"><Search size={17}/><input value={search} onChange={e => setSearch(e.target.value)} placeholder={`Search ${title.toLowerCase()}…`} /></div><button className="outline"><SlidersHorizontal size={16}/> Filter</button></div>
      <DataTable rows={rows} columns={columns} search={search}/></section></>
}

const workOrderTabs = ['Details', 'Planning', 'Actual', 'Failure Codes', 'Materials', 'PTW & Attachments', 'Meter Readings']

const Field = ({ label, value = '', required, locked, type = 'text', options, suggestions, onChange, placeholder }) => {
  const listId=useId()
  if (locked) return null
  return <label className="wo-field">
    <span>{label}{required && <b>*</b>}</span>
    {options ? <select value={value} onChange={onChange} disabled={locked}>{options.map(o=><option key={o}>{o}</option>)}</select> :
      type === 'textarea' ? <textarea value={value} onChange={onChange} readOnly={locked} rows="3"/> : <>
      <input type={type} value={value} onChange={onChange} readOnly={locked} list={suggestions?.length?listId:undefined} placeholder={placeholder}/>
      {suggestions?.length ? <datalist id={listId}>{suggestions.map(item=><option value={item.value??item} key={item.value??item}>{item.label||item.value||item}</option>)}</datalist> : null}</>}
  </label>
}

function WorkOrderEditor({ order, onClose, page = false }) {
  const isPM = (order['WORK TYPE '] || order['WORK TYPE  '] || 'CM').trim() === 'PM'
  const [tab, setTab] = useState('Details')
  const [saved, setSaved] = useState(false)
  const [materialAvailable, setMaterialAvailable] = useState('Available')
  const [siteValue,setSiteValue]=useState(String(order.SITE||'1031'))
  const [assetValue,setAssetValue]=useState(order.ASSET||'')
  const [locationValue,setLocationValue]=useState(order['LOCATION ']||'')
  const [failureClass,setFailureClass]=useState('')
  const [problemCode,setProblemCode]=useState('')
  const [causeCode,setCauseCode]=useState('')
  const [remedyCode,setRemedyCode]=useState('')
  const siteOptions=[...new Set([...assets.map(a=>String(a.site)),...workOrders.map(o=>String(o.SITE))].filter(Boolean))].sort()
  const assetsForSite=assets.filter(a=>!siteValue||String(a.site)===siteValue)
  const assetOptions=assetsForSite.map(a=>({value:a.assetnum,label:a.description?.trim()}))
  const locationOptions=[...new Set([...assetsForSite.map(a=>a.location),...workOrders.filter(o=>!siteValue||String(o.SITE)===siteValue).map(o=>o['LOCATION '])].filter(Boolean))].sort()
  const changeSite=e=>{setSiteValue(e.target.value);setAssetValue('');setLocationValue('')}
  const changeAsset=e=>{const value=e.target.value;setAssetValue(value);const match=assets.find(a=>a.assetnum===value);if(match?.location)setLocationValue(match.location);if(match?.site)setSiteValue(String(match.site))}
  const matchingFailures=failureCodes.filter(row=>!failureClass||row['FAILURE CLASS ID']===failureClass)
  const problemOptions=uniqueCodeOptions(matchingFailures,'PROBLEM CODE','PC - DESCRIPTION')
  const selectedProblems=matchingFailures.filter(row=>!problemCode||row['PROBLEM CODE']===problemCode)
  const causeOptions=uniqueCodeOptions(selectedProblems,'CAUSE CODE','CC - DESCRIPTION')
  const remedyOptions=uniqueCodeOptions(selectedProblems.filter(row=>!causeCode||row['CAUSE CODE']===causeCode),'REMEDY CODE','RC - DESCRIPTION')
  const changeFailure=e=>{setFailureClass(e.target.value);setProblemCode('');setCauseCode('');setRemedyCode('')}
  const status = materialAvailable === 'Purchase Required' ? 'Waiting for Spare Parts' : (order.STATUS || 'WAPPR')
  const number = order.WORKORDER || 'AUTO'
  const breached = slaBreached(order)
  const close = () => onClose()
  const save = () => { setSaved(true); setTimeout(()=>setSaved(false),2200) }
  return <div className={page?'work-order-detail-page':'wo-overlay'}><div className={`wo-editor ${page?'work-order-page-editor':''}`}>
    <header className="wo-editor-head"><div><button className="back-link" onClick={close}>← Work Order Tracking</button><div className="wo-title-line"><h2>{number === 'AUTO' ? 'New work order' : `Work order #${number}`}</h2><Badge tone={isPM?'blue':'purple'}>{isPM?'PM':'CM'}</Badge><Badge tone="orange">{status}</Badge></div><p>{order['DESCRIPITION '] || order.DESCRIPTION || 'Enter work order information'}</p></div>
      <div className="wo-head-actions"><button className="outline"><RotateCcw size={15}/> Re-route</button><button className="outline"><Printer size={15}/> Print</button><button className="primary" onClick={save}><Save size={15}/> Save changes</button><button className="close-editor" onClick={close}><X size={20}/></button></div></header>
    <div className="wo-summary"><div><span>WORK TYPE</span><strong>{isPM?'Preventive Maintenance':'Corrective Maintenance'}</strong></div><div><span>SLA MET?</span><strong className={breached?'sla-breach':'sla-ok'}>{breached?<AlertTriangle size={14}/>:<Check size={14}/>} {breached?'No – SLA Breached':'Yes · Within SLA'}</strong></div><div><span>PROJECT</span><strong>Royal Court Facilities</strong></div><div><span>PTW REQUIRED</span><strong>No</strong></div></div>
    <div className="wo-tabs">{workOrderTabs.map(name=><button key={name} className={tab===name?'active':''} onClick={()=>setTab(name)}>{name}{name==='Failure Codes'&&!isPM&&<i/>}</button>)}</div>
    <div className="wo-body">
      {tab==='Details' && <>
        <Section title="1. Work Order Information" note="Fields aligned with IBM Maximo CM structure"><div className="field-grid four">
          <Field label="Work Order Number" value={String(number)} locked/><Field label="Status" value={status} locked/><Field label="Work Type" value={isPM?'PM':'CM'} required locked={isPM} options={['CM','PM','Incident','SR']}/><Field label="Priority" value={String(order['PRIORTY']||'2')} required options={['1 - Emergency','2 - High','3 - Medium','4 - Low']}/>
          <Field label="Description" value={order['DESCRIPITION ']||''} required/><Field label="Site" value={siteValue} required onChange={changeSite} suggestions={siteOptions} placeholder="Search or select a site"/><Field label="Department" value={order['DEPARTMENT ']||'Mechanics'} required/><Field label="Sub Department" value={order['SUB DEPARTMENT  NAME']||'HVAC'}/>
          <div className="span-2"><Field label="Long Description" value="Preventive maintenance inspection and servicing activities." type="textarea"/></div><Field label="Reported Date" value="2026-07-12T09:30" type="datetime-local" locked/><Field label="Target Start" value="2026-07-14T08:00" type="datetime-local" locked={isPM}/><Field label="Target Finish" value="2026-07-14T10:00" type="datetime-local"/><Field label="Actual Start" value="" locked/><Field label="Actual Finish" value="" locked/>
        </div></Section>
        <Section title="2. Asset Information"><div className="field-grid"><Field label="Asset" value={assetValue} required onChange={changeAsset} suggestions={assetOptions} placeholder="Search asset number or description"/><Field label="Location" value={locationValue} required onChange={e=>setLocationValue(e.target.value)} suggestions={locationOptions} placeholder="Search or select a location"/><Field label="Asset Description" value="HVAC cooling unit" required/><Field label="Project" value="Royal Court Facilities" required/></div></Section>
        <Section title="3. Assignment"><div className="field-grid"><Field label="Assigned Department" value="Mechanics" required/><Field label="Work Group" value="C1-HVAC"/><Field label="Supervisor" value="Faisal Al Harbi"/><Field label="Labor Craft Code" value="HVAC-TECH"/></div></Section>
        <Section title="6. Execution & Closeout"><div className="field-grid"><Field label="Technician Remarks" type="textarea" required/><Field label="Completion Notes" type="textarea" required/><Field label="Completion Date" locked/><Field label="Closed By" locked/><Field label="Close Status" locked/><Field label="Asset History Update" value="Automatic on close" locked/></div></Section>
      </>}
      {tab==='Planning' && <><div className={`mode-note ${isPM?'auto':'manual'}`}><Sparkles size={18}/><div><strong>{isPM?'Automatically generated planned data':'Department-entered planned data'}</strong><span>{isPM?'Copied from PM and job plan; values are locked after generation.':'CM planning must be completed by the responsible department.'}</span></div></div>
        <Section title="5. Planned Labor"><div className="field-grid"><Field label="Labor Craft" value="HVAC Technician" required locked={isPM}/><Field label="Estimated Labor Hours" value="2" type="number" required locked={isPM}/><Field label="Assigned Crew" value="HVAC Team A" locked={isPM}/><Field label="Job Plan" value={order['JOP PLAN ']||'JP-FCU-PM'} locked={isPM}/></div></Section>
        <Section title="Planned Materials & Tools"><div className="line-items"><div className="line-head"><span>Type</span><span>Item / Description</span><span>Quantity</span><span>Availability</span></div><div><span>Material</span><strong>Air filter, 500 × 500 mm</strong><span>2 EA</span><Badge tone="green">Available</Badge></div><div><span>Tool</span><strong>Digital multimeter</strong><span>1 EA</span><Badge tone="green">Available</Badge></div></div></Section>
        <Section title="Job Tasks"><div className="task-list">{jobTasks.slice(0,4).map((task,i)=><div key={i}><span>{task['JOB TASK SEQUENCE']}</span><p>{task['JOB TASK DESCRIPTION']}</p><small>{Math.max(5,Math.round(Number(task['TASK DURATION IN HOUR'])*1440))} min</small></div>)}</div></Section></>}
      {tab==='Actual' && <><div className="mode-note actual"><Check size={18}/><div><strong>Actual data</strong><span>Record what was actually consumed during execution. This remains separate from planned quantities.</span></div></div>
        <Section title="7. Actual Labor"><div className="field-grid"><Field label="Technician / Labor" value="" required/><Field label="Labor Craft Code" value="HVAC-TECH" required/><Field label="Actual Labor Hours" value="" type="number" required/><Field label="Actual Start" value="" type="datetime-local"/></div></Section>
        <Section title="Actual Spare Parts Used"><button className="inline-add"><Plus size={15}/> Add spare part</button><div className="empty-inline"><PackageCheck size={24}/><span>No actual spare parts recorded</span></div></Section>
        <Section title="Actual Tools and Equipment Used"><button className="inline-add"><Plus size={15}/> Add tool or equipment</button><div className="empty-inline"><Wrench size={24}/><span>No actual tools recorded</span></div></Section></>}
      {tab==='Failure Codes' && <><div className={`mode-note ${isPM?'auto':'warning'}`}>{isPM?<CircleHelp size={18}/>:<AlertTriangle size={18}/>}<div><strong>{isPM?'Optional for PM work orders':'Mandatory for CM work orders'}</strong><span>Select the failure class and problem before completing this work order.</span></div></div>
        <Section title="4. Failure Information"><div className="field-grid"><Field label="Failure Code" value={failureClass} required={!isPM} onChange={changeFailure} suggestions={failureClassOptions} placeholder="Search code or description"/><Field label="Problem Code" value={problemCode} required={!isPM} onChange={e=>{setProblemCode(e.target.value);setCauseCode('');setRemedyCode('')}} suggestions={problemOptions} placeholder={failureClass?'Search matching problems':'Select failure code first'}/><Field label="Cause Code" value={causeCode} onChange={e=>{setCauseCode(e.target.value);setRemedyCode('')}} suggestions={causeOptions} placeholder="Search cause"/><Field label="Remedy Code" value={remedyCode} onChange={e=>setRemedyCode(e.target.value)} suggestions={remedyOptions} placeholder="Search remedy"/></div><div className="failure-library-note"><Search size={15}/><span>{failureCodes.length.toLocaleString()} Excel failure records available · selections are filtered by hierarchy</span></div></Section></>}
      {tab==='Materials' && <><Section title="Material Requests" note="Select directly from inventory"><div className="field-grid"><Field label="Inventory Item" value="Air filter, 500 × 500 mm"/><Field label="Requested Quantity" value="2" type="number"/><Field label="Material Availability" value={materialAvailable} options={['Available','Purchase Required']} onChange={e=>setMaterialAvailable(e.target.value)}/><Field label="Store Location" value="DIWAN-MAIN"/></div><div className={`availability ${materialAvailable==='Available'?'yes':'no'}`}>{materialAvailable==='Available'?<Check/>:<AlertTriangle/>}<div><strong>{materialAvailable}</strong><span>{materialAvailable==='Available'?'Stock can be reserved immediately.':'Status automatically changed to Waiting for Spare Parts.'}</span></div></div></Section></>}
      {tab==='PTW & Attachments' && <><Section title="Permit to Work (PTW)" note="Multiple documents supported"><div className="upload-zone"><Upload size={25}/><strong>Upload PTW documents</strong><span>PDF, DOCX, JPG or PNG · multiple files accepted</span><input type="file" multiple/></div></Section><Section title="General Attachments"><div className="attachment-row"><FileText/><div><strong>site-inspection-photo.jpg</strong><span>Uploaded today · 1.8 MB</span></div><button><X size={15}/></button></div></Section></>}
      {tab==='Meter Readings' && <><div className="mode-note auto"><Gauge size={18}/><div><strong>Optional meter readings</strong><span>Complete only when readings are available or required by the related asset.</span></div></div><Section title="Meter Readings"><div className="field-grid"><Field label="General Meter Reading" type="number"/><Field label="Water Consumption (m³)" type="number"/><Field label="Energy Consumption (kWh)" type="number"/><Field label="Reading Date" type="datetime-local"/></div></Section></>}
    </div>
    {saved&&<div className="save-toast"><Check size={17}/> Work order changes saved</div>}
  </div></div>
}

function Section({ title, note, children }) { return <section className="wo-section"><header><div><h3>{title}</h3>{note&&<p>{note}</p>}</div></header>{children}</section> }

function WorkOrderTracking({ search, setSearch, rows = workOrders }) {
  const [selected, setSelected] = useState(()=>{const id=decodeURIComponent(window.location.pathname.split('/work-orders/')[1]||'');return rows.find(order=>String(order.WORKORDER)===id)||null})
  const [typeFilter,setTypeFilter]=useState('All')
  const openOrder=order=>{setSelected(order);window.history.pushState({},'',`/work-orders/${order.WORKORDER||'new'}`)}
  const closeOrder=()=>{setSelected(null);window.history.pushState({},'','/work-orders')}
  const normalized=search.toLowerCase().trim()
  const orderType=order=>(order['WORK TYPE ']||order['WORK TYPE  ']||'PM').trim()
  const filtered=rows.filter(o=>(typeFilter==='All'||orderType(o)===typeFilter)&&(!normalized||Object.values(o).some(v=>String(v).toLowerCase().includes(normalized))))
  const breachedCount=rows.filter(slaBreached).length
  const typeCount=type=>rows.filter(order=>type==='All'||orderType(order)===type).length
  return <div className="work-orders-index"><section className="page-heading"><div><p className="eyebrow">MAINTENANCE OPERATIONS</p><h1>Work Orders</h1><p>Track, plan, execute, and close every maintenance work order.</p></div><div className="heading-actions"><button className="outline"><Printer size={16}/> Print selected</button><button className="primary" onClick={()=>openOrder({'WORK TYPE  ':'CM'})}><Plus size={17}/>New work order</button></div></section>
    <div className="sub-tabs work-order-tabs">{['All','PM','CM','Incident'].map(type=><button key={type} className={typeFilter===type?'active':''} onClick={()=>setTypeFilter(type)}>{type==='All'?'All Work Orders':type}<b>{typeCount(type)}</b></button>)}</div>
    <section className="work-order-glance"><span><i className="green-dot"/>Within SLA <strong>{Math.round(((rows.length-breachedCount)/rows.length)*100)}%</strong></span><span>Waiting approval <strong>{rows.filter(o=>o.STATUS==='WAPPR').length}</strong></span><span className={breachedCount?'attention':''}>Overdue <strong>{breachedCount}</strong></span></section>
    <section className="panel register work-order-table"><div className="register-tools"><div className="search-box"><Search size={17}/><input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search work order, asset, or location…"/></div><div className="tool-group"><button className="outline"><SlidersHorizontal size={16}/>Filters</button></div></div>
      <div className="table-shell"><table><thead><tr><th><input type="checkbox"/></th><th>Work order</th><th>Description</th><th>Type</th><th>Asset / Location</th><th>Status</th><th>SLA</th><th>Target start</th><th></th></tr></thead><tbody>{filtered.map((o,i)=>{const breached=slaBreached(o);return <tr key={i} className="click-row" onClick={()=>openOrder(o)}><td onClick={e=>e.stopPropagation()}><input type="checkbox"/></td><td><strong className="mono">#{o.WORKORDER}</strong></td><td>{o['DESCRIPITION ']}</td><td><Badge tone="blue">{o['WORK TYPE ']||'PM'}</Badge></td><td><strong>{o.ASSET}</strong><small className="cell-sub">{o['LOCATION ']}</small></td><td><Badge tone="orange">{o.STATUS}</Badge></td><td><Badge tone={breached?'orange':'green'}>{breached?'SLA Breached':'Met'}</Badge></td><td>{excelDate(o['TARGET START '])}</td><td><ChevronRight size={17}/></td></tr>})}</tbody></table></div><div className="table-footer"><span>{filtered.length} work orders across all types</span><span>Click any row to open the complete work order</span></div></section>
    {selected&&<WorkOrderEditor order={selected} onClose={closeOrder}/>}</div>
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
  const [active, setActive] = useState(()=>window.location.pathname.startsWith('/service-requests')?'Service Requests':window.location.pathname.startsWith('/work-orders')?'Work Orders':'Overview')
  const [search, setSearch] = useState('')
  const [mobileOpen, setMobileOpen] = useState(false)
  const [allWorkOrders,setAllWorkOrders]=useState(workOrders)
  const [serviceRequests,setServiceRequests]=useState(serviceRequestSeed)
  const navigate = name => { setActive(name); setSearch(''); setMobileOpen(false) }
  const convertRequest = request => {
    const number=String(56545135+allWorkOrders.filter(o=>String(o.WORKORDER).startsWith('56545')).length-3)
    const cm={'WORKORDER':number,'DESCRIPITION ':request.description,'LOCATION ':request.location,'LOCATION PRIORTY':request.priority,'ASSET':request.asset||'Unassigned','STATUS':'WAPPR','WORK TYPE ':'CM','STATUS DESCRIPITION':'Waiting for Approval','DEPARTMENT ':request.assignedDepartment||request.department,'SUB DEPARTMENT  NAME':request.subDepartment||'','PRIORTY':request.priority==='Emergency'?1:request.priority==='High'?2:3,'SITE':request.site,'TARGET START ':null,'TARGET FINISH ':null,'SOURCE SR':request.sr}
    setAllWorkOrders(rows=>rows.some(o=>o['SOURCE SR']===request.sr)?rows:[...rows,cm])
    return cm
  }
  const openConvertedWorkOrder=number=>{setActive('Work Orders');setSearch('');window.history.pushState({},'',`/work-orders/${number}`)}
  const createWorkOrder=form=>{const next=Math.max(...allWorkOrders.map(order=>Number(order.WORKORDER)||0),56545134)+1;const created={'WORKORDER':String(next),'DESCRIPITION ':form.description,'LOCATION ':form.location,'LOCATION PRIORTY':form.priority,'ASSET':form.asset,'STATUS':'WAPPR','WORK TYPE ':form.type,'STATUS DESCRIPITION':'Waiting for Approval','DEPARTMENT ':'','SUB DEPARTMENT  NAME':'','PRIORTY':Number(String(form.priority).charAt(0))||3,'SITE':form.site,'TARGET START ':null,'TARGET FINISH ':null};setAllWorkOrders(rows=>[...rows,created]);return created}
  const pages = {
    'Service Requests': <ServiceRequestsPage onConvert={convertRequest} onOpenWorkOrder={openConvertedWorkOrder} requests={serviceRequests} setRequests={setServiceRequests} assets={assets} workOrders={allWorkOrders} failureOptions={failureClassOptions}/>,
    'Work Orders': <WorkOrdersPage rows={allWorkOrders} assets={assets} onCreate={createWorkOrder} EditorComponent={WorkOrderEditor} excelDate={excelDate} slaBreached={slaBreached}/>,
    'Assets': <RegisterPage title="Asset register" eyebrow="PORTFOLIO" description="A complete view of maintainable equipment across every site." rows={assets} search={search} setSearch={setSearch} action="Add asset" columns={[
      {key:'assetnum',label:'Asset ID',render:v=><strong className="mono">{v}</strong>},{key:'description',label:'Description'},{key:'site',label:'Site'},{key:'department',label:'Department'},{key:'modelnum',label:'Model'},{key:'status',label:'Status',render:v=><Badge tone="green">{v}</Badge>}
    ]}/>,
    'Preventive Maintenance': <RegisterPage title="PM schedule" eyebrow="MAINTENANCE" description="Recurring maintenance programs generated from your PM workbook." rows={pmRecords} search={search} setSearch={setSearch} action="New PM" columns={[
      {key:'PMNUM',label:'PM number',render:v=><strong className="mono">{v}</strong>},{key:'PM DESCRIPTION',label:'Description'},{key:'ASSETNUM',label:'Asset'},{key:'JPNUM',label:'Job plan'},{key:'FREQUENCY',label:'Frequency',render:(v,r)=>`${v} ${r.FREQUNIT}`},{key:'WOSTATUS',label:'WO status',render:v=><Badge tone="blue">{v}</Badge>}
    ]}/>,
    'Locations': <><section className="page-heading"><div><p className="eyebrow">PORTFOLIO</p><h1>Locations</h1><p>Manage the facility hierarchy across sites and buildings.</p></div><button className="primary"><Plus size={17}/>Add location</button></section><section className="panel"><EmptyLocations/></section></>,
    'Job Plans': <RegisterPage title="Job plans" eyebrow="MAINTENANCE" description="Standard task sequences and estimated durations for technicians." rows={jobTasks} search={search} setSearch={setSearch} action="New job plan" columns={[
      {key:'JPNUM',label:'Plan',render:v=><strong className="mono">{v}</strong>},{key:'DESCRIPTION',label:'Plan description'},{key:'JOB TASK SEQUENCE',label:'Sequence'},{key:'JOB TASK DESCRIPTION',label:'Task'},{key:'TASK DURATION IN HOUR',label:'Duration',render:v=>`${Math.round(Number(v)*1440)} min`}
    ]}/>,
    'Failure Library': <RegisterPage title="Failure library" eyebrow="RELIABILITY" description="Search the bilingual Maximo problem, cause, and remedy hierarchy." rows={failureCodes} search={search} setSearch={setSearch} action="Add code" columns={[
      {key:'FAILURE CLASS ID',label:'Class',render:v=><strong className="mono">{v}</strong>},{key:'DESCRIPTION',label:'Class description'},{key:'PROBLEM CODE',label:'Problem code'},{key:'PC - DESCRIPTION',label:'Problem description'},{key:'CAUSE CODE',label:'Cause'}
    ]}/>
  }
  return <div className="app-shell">
    <aside className={`sidebar ${mobileOpen ? 'open' : ''}`}><div className="brand"><div><Command size={20}/></div><span>FACILITY<strong>COMMAND</strong></span><button className="mobile-close" onClick={()=>setMobileOpen(false)}><X/></button></div>
      <nav><span className="nav-label">WORKSPACE</span>{nav.map(([name, Icon]) => <button className={active===name?'active':''} onClick={()=>navigate(name)} key={name}><Icon size={18}/><span>{name}</span>{name==='Work Orders'&&<b>{workOrders.length}</b>}</button>)}</nav>
      <div className="sidebar-bottom"><nav><button><Users size={18}/><span>Team</span></button><button><Settings size={18}/><span>Settings</span></button><button><CircleHelp size={18}/><span>Help & support</span></button></nav><div className="user"><div className="avatar">{initials('Ahmed Faisal')}</div><div><strong>Ahmed Faisal</strong><span>Facility Manager</span></div><MoreHorizontal size={18}/></div></div>
    </aside>
    <main><header className="topbar"><button className="menu-btn" onClick={()=>setMobileOpen(true)}><Menu/></button><div className="crumb"><span>Facility Command</span><ChevronRight size={14}/><strong>{active}</strong></div><div className="top-actions"><button className="global-search" onClick={()=>document.querySelector('.register input')?.focus()}><Search size={16}/><span>Search anything</span><kbd>⌘ K</kbd></button><button className="icon-button"><Bell size={19}/><i/></button><div className="top-avatar">AF</div></div></header>
      <div className="content">{active==='Overview'?<Overview onNavigate={navigate}/>:pages[active]}</div>
      <footer><span>Facility Command · Mock data generated from provided Excel files</span><span>{statusMatrix.length} Maximo status rules loaded</span></footer>
    </main>
  </div>
}

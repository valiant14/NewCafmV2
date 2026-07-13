import { useEffect, useState } from 'react'
import { AlertTriangle, Building2, CalendarClock, Check, ChevronRight, MapPin, Plus, Printer, Upload, UserRound, X } from 'lucide-react'
import { Field, Section } from '../components/ui/FormControls'
import PageHeader from '../components/ui/PageHeader'
import departments from '../data/departments.json'

export const initialRequests = [{
  sr: 'SR-2026-0041', description: 'Water leak reported above meeting room', longDescription: 'Active water staining and intermittent dripping from ceiling tile.',
  site: '1031', location: 'RC-1031-RD-001-00-054', asset: '', department: 'Civil', reportedBy: 'Maha Alotaibi',
  reportedDate: '2026-07-12T10:15', priority: 'High', requestType: 'Service', failureCode: '', status: 'WAPPR', attachments: 1
}]

const blankRequest = () => ({ sr: 'AUTO', description: '', longDescription: '', site: '', location: '', asset: '', department: '', reportedBy: '', reportedDate: new Date().toISOString().slice(0, 16), priority: 'Medium', requestType: 'Service', failureCode: '', status: 'NEW' })

function Badge({ children, tone = 'neutral' }) { return <span className={`badge ${tone}`}><i />{children}</span> }

function ServiceRequestDetail({ request, assets, workOrders, failureOptions, onBack, onSubmit, onApprove, onOpenWorkOrder, modal = false }) {
  const [form, setForm] = useState(request)
  const [submitError, setSubmitError] = useState('')
  const [activeTab, setActiveTab] = useState('Request Details')
  const isNew = form.status === 'NEW'
  const canSubmit = Boolean(form.description?.trim() && form.site && form.location && form.reportedBy?.trim())
  const canConvert = Boolean(form.asset?.trim() && form.department?.trim() && form.subDepartment?.trim() && (form.assignedDepartment || form.department)?.trim() && form.failureCode?.trim())
  const missingConversionFields = [!form.asset?.trim()&&'Asset',!form.department?.trim()&&'Department',!form.subDepartment?.trim()&&'Sub Department',!(form.assignedDepartment||form.department)?.trim()&&'Assigned Department',!form.failureCode?.trim()&&'Failure Code'].filter(Boolean)
  const update = key => event => setForm({ ...form, [key]: event.target.value })
  const sites = [...new Set([...assets.map(asset => String(asset.site)), ...workOrders.map(order => String(order.SITE))].filter(Boolean))].sort()
  const siteAssets = assets.filter(asset => !form.site || String(asset.site) === String(form.site))
  const assetOptions = siteAssets.map(asset => ({ value: asset.assetnum, label: asset.description?.trim() }))
  const locations = [...new Set([...siteAssets.map(asset => asset.location), ...workOrders.filter(order => !form.site || String(order.SITE) === String(form.site)).map(order => order['LOCATION '])].filter(Boolean))].sort()
  const departmentOptions = departments.map(department => ({ value: department.name, label: department.code }))
  const selectedDepartment = departments.find(department => department.name === form.department)
  const subDepartmentOptions = (selectedDepartment?.subDepartments || departments.flatMap(department => department.subDepartments)).map(sub => ({ value: sub.name, label: sub.code }))
  const updateSite = event => setForm({ ...form, site: event.target.value, location: '', asset: '' })
  const updateAsset = event => { const value = event.target.value; const match = assets.find(asset => asset.assetnum === value); setForm({ ...form, asset: value, location: match?.location || form.location, site: match?.site ? String(match.site) : form.site }) }
  const updateDepartment = event => setForm({ ...form, department: event.target.value, subDepartment: '', assignedDepartment: form.assignedDepartment || event.target.value })
  const handlePrimary = () => {
    if (isNew && !canSubmit) return setSubmitError('Complete Description, Site, Location, and Reported By before submitting.')
    if (!isNew && !canConvert) { setActiveTab(form.asset?.trim() ? 'Department Review' : 'Request Details'); return setSubmitError('Complete Asset, Department, Sub Department, Assigned Department, and Failure Code before converting to CM.') }
    setSubmitError('')
    if (isNew) onSubmit(form)
    else { const converted=onApprove(form); setForm(converted) }
  }
  return <div className={`service-request-view ${modal ? 'service-request-modal' : ''}`}>
    <header className="record-page-header"><div className="record-header-copy"><div className="record-header-nav"><button className="back-link" onClick={onBack}>← All Service Requests</button>{!isNew&&<span className="record-kicker">SERVICE REQUEST · {form.requestType?.toUpperCase()}</span>}</div><div className="wo-title-line"><h1>{form.sr === 'AUTO' ? 'New service request' : form.sr}</h1><Badge tone={form.status==='CONVERTED'?'green':'orange'}>{form.status}</Badge></div><p>{isNew ? 'Tell us what happened and where. The maintenance team will configure the technical details.' : form.description}</p></div>{!isNew && <div className="record-header-actions"><button className="outline"><Printer size={15} /> Print</button>{form.status==='CONVERTED'&&form.convertedWorkOrder?<button className="primary wo-link-action" onClick={()=>onOpenWorkOrder(form.convertedWorkOrder)}>Open WO #{form.convertedWorkOrder} <ChevronRight size={15}/></button>:<button className="primary approve-action" onClick={handlePrimary} disabled={!canConvert}><Check size={15}/>Approve & convert to CM</button>}</div>}</header>
    <div className="sr-flow"><span className="done">Request created</span><i /><span className={form.status === 'WAPPR' ? 'current' : 'done'}>Department review</span><i /><span className={form.status === 'CONVERTED' ? 'done' : ''}>CM work order</span></div>
    {!isNew&&<section className="record-summary"><div><span className="summary-icon orange"><AlertTriangle size={16}/></span><p>Priority<strong>{form.priority}</strong></p></div><div><span className="summary-icon green"><MapPin size={16}/></span><p>Site & location<strong>{form.site} · {form.location}</strong></p></div><div><span className="summary-icon blue"><UserRound size={16}/></span><p>Reported by<strong>{form.reportedBy}</strong></p></div><div><span className="summary-icon purple"><Building2 size={16}/></span><p>Department<strong>{form.department||'Pending review'}</strong></p></div><div><span className="summary-icon green"><CalendarClock size={16}/></span><p>Reported<strong>{form.reportedDate?.replace('T',' · ')}</strong></p></div></section>}
    {!isNew && <nav className="record-tabs">{['Request Details','Attachments','Department Review'].map(tab=><button key={tab} className={activeTab===tab?'active':''} onClick={()=>setActiveTab(tab)}>{tab}</button>)}</nav>}
    {!isNew&&form.status!=='CONVERTED'&&!canConvert&&<div className="conversion-warning"><AlertTriangle size={18}/><div><strong>Complete required information before CM conversion</strong><span>Missing: {missingConversionFields.join(', ')}</span></div><button onClick={()=>setActiveTab(form.asset?.trim()?'Department Review':'Request Details')}>Complete fields <ChevronRight size={14}/></button></div>}
    <main className="service-request-content">
      {submitError && <div className="form-error"><AlertTriangle size={17} /><span>{submitError}</span><button onClick={() => setSubmitError('')}><X size={14} /></button></div>}
      {isNew && <Section title="Request Information" note="Provide the issue, location, and contact information."><div className="field-grid sr-form-grid">
        <Field label="Priority" value={form.priority} required options={['Low', 'Medium', 'High', 'Emergency']} onChange={update('priority')} />
        <Field label="Description" value={form.description} required onChange={update('description')} />
        <Field label="Site" value={form.site} required onChange={updateSite} suggestions={sites} placeholder="Search or select a site" />
        <Field label="Location" value={form.location} required onChange={update('location')} suggestions={locations} placeholder="Search or select a location" />
        <Field label="Asset" value={form.asset} onChange={updateAsset} suggestions={assetOptions} placeholder="Search asset number or description" />
        <Field label="Long Description" value={form.longDescription} type="textarea" onChange={update('longDescription')} />
        <Field label="Reported By" value={form.reportedBy} required onChange={update('reportedBy')} />
      </div></Section>}
      {!isNew && activeTab==='Request Details' && <div className="request-overview-layout">
        <section className="request-story-card"><div className="story-label">Reported issue</div><h2>{form.description}</h2><p>{form.longDescription||'No additional description was provided.'}</p><div className="story-footer"><span><UserRound size={14}/><b>Reported by</b>{form.reportedBy}</span><span><CalendarClock size={14}/><b>Reported</b>{form.reportedDate?.replace('T',' at ')}</span></div></section>
        <aside className="request-facts-card"><h3>Request information</h3><dl><div><dt>Priority</dt><dd><Badge tone="orange">{form.priority}</Badge></dd></div><div><dt>Site</dt><dd>{form.site}</dd></div><div><dt>Location</dt><dd>{form.location}</dd></div><div><dt>Request type</dt><dd>Service</dd></div></dl></aside>
        <section className={`asset-link-card ${form.asset?'linked':'required'}`}><div className="asset-link-copy"><span className="summary-icon green"><Building2 size={16}/></span><div><strong>{form.asset?'Linked asset':'Link an asset'}</strong><p>{form.asset?'This request is ready for technical classification.':'An asset must be linked before this request can be converted to CM.'}</p></div></div><div className="asset-link-field"><Field label="Asset" value={form.asset} required onChange={updateAsset} suggestions={assetOptions} placeholder="Search asset number or description" /></div></section>
      </div>}
      {(isNew || activeTab==='Attachments') && <Section title="Attachments" note="Add photos or documents that help explain the request"><div className="upload-zone"><Upload size={25} /><strong>Upload attachments</strong><span>Photos, PDFs and supporting documents · multiple files supported</span><input type="file" multiple /></div></Section>}
      {!isNew && activeTab==='Department Review' && <div className="review-configuration-layout">
        <section className="review-card routing-card"><header><span className="review-card-icon green"><Building2 size={18}/></span><div><span>Step 01</span><h3>Work routing</h3><p>Choose the teams responsible for reviewing and executing the work.</p></div><em className={form.department&&form.assignedDepartment?'complete':'pending'}>{form.department&&form.assignedDepartment?'Complete':'Required'}</em></header><div className="review-fields"><Field label="Department" value={form.department} required onChange={updateDepartment} suggestions={departmentOptions} placeholder="Search or select a department" /><Field label="Assigned Department" value={form.assignedDepartment || form.department} required onChange={update('assignedDepartment')} suggestions={departmentOptions} placeholder="Search or select an assigned department" /></div></section>
        <section className="review-card classification-card"><header><span className="review-card-icon orange"><AlertTriangle size={18}/></span><div><span>Step 02</span><h3>Technical classification</h3><p>Classify the maintenance discipline and reported failure.</p></div><em className={form.subDepartment&&form.failureCode?'complete':'pending'}>{form.subDepartment&&form.failureCode?'Complete':'Required'}</em></header><div className="review-fields"><Field label="Sub Department" value={form.subDepartment || ''} required onChange={update('subDepartment')} suggestions={subDepartmentOptions} placeholder="Search or select a sub department" /><Field label="Failure Code" value={form.failureCode} required onChange={update('failureCode')} suggestions={failureOptions} placeholder="Search code or description" /></div></section>
      </div>}
      {isNew && <div className="mode-note warning"><AlertTriangle size={18} /><div><strong>Technical configuration happens after submission</strong><span>Department assignment and failure classification will be completed by maintenance staff.</span></div></div>}
    </main>
    {isNew && <footer className="record-page-actions"><button className="outline" onClick={onBack}>Cancel</button><button className="primary sr-submit" onClick={handlePrimary}><Check size={15} />Submit request</button></footer>}
  </div>
}

export default function ServiceRequestsPage({ onConvert, onOpenWorkOrder, requests, setRequests, assets, workOrders, failureOptions }) {
  const requestFromPath = () => { const id = decodeURIComponent(window.location.pathname.split('/service-requests/')[1] || ''); return id === 'new' ? blankRequest() : requests.find(request => request.sr === id) || null }
  const [selected, setSelected] = useState(requestFromPath)
  useEffect(() => { const pop = () => setSelected(requestFromPath()); window.addEventListener('popstate', pop); return () => window.removeEventListener('popstate', pop) }, [requests])
  const open = request => { setSelected(request); window.history.pushState({}, '', `/service-requests/${request.sr === 'AUTO' ? 'new' : request.sr}`) }
  const close = () => { setSelected(null); window.history.pushState({}, '', '/service-requests') }
  const submit = request => { const submitted = { ...request, sr: `SR-2026-${String(requests.length + 42).padStart(4, '0')}`, status: 'WAPPR', requestType: 'Service' }; setRequests(list => [...list, submitted]); setSelected(submitted); window.history.replaceState({}, '', `/service-requests/${submitted.sr}`) }
  const approve = request => { const createdWorkOrder=onConvert(request); const updated = { ...request, status: 'CONVERTED', convertedWorkOrder: createdWorkOrder.WORKORDER }; setRequests(list => list.map(item => item.sr === updated.sr ? updated : item)); setSelected(updated); window.history.replaceState({}, '', `/service-requests/${updated.sr}`); return updated }
  const listView = <><PageHeader eyebrow="REQUEST INTAKE" title="Service Requests" description="Submit, review, approve, and convert requests into Corrective Maintenance work orders." actionLabel="New service request" actionIcon={Plus} onAction={() => open(blankRequest())} /><div className="sub-tabs"><button className="active">All Service Requests <b>{requests.length}</b></button><button>Awaiting Review <b>{requests.filter(request => request.status === 'WAPPR').length}</b></button><button>Converted <b>{requests.filter(request => request.status === 'CONVERTED').length}</b></button></div><section className="panel register"><div className="table-shell"><table><thead><tr><th>SR number</th><th>Description</th><th>Site / Location</th><th>Department</th><th>Reported by</th><th>Priority</th><th>Status</th><th /></tr></thead><tbody>{requests.map(request => <tr className="click-row" key={request.sr} onClick={() => open(request)}><td><strong className="mono">{request.sr}</strong></td><td>{request.description}</td><td>{request.site}<small className="cell-sub">{request.location}</small></td><td>{request.department || 'Pending review'}</td><td>{request.reportedBy}</td><td><Badge tone={request.priority === 'High' ? 'orange' : 'neutral'}>{request.priority}</Badge></td><td><Badge tone={request.status === 'CONVERTED' ? 'green' : 'orange'}>{request.status}</Badge></td><td><ChevronRight size={17} /></td></tr>)}</tbody></table></div></section></>
  if (selected?.status === 'NEW') return <>{listView}<div className="wo-overlay sr-create-overlay"><ServiceRequestDetail modal request={selected} assets={assets} workOrders={workOrders} failureOptions={failureOptions} onBack={close} onSubmit={submit} onApprove={approve} /></div></>
  if (selected) return <ServiceRequestDetail request={selected} assets={assets} workOrders={workOrders} failureOptions={failureOptions} onBack={close} onSubmit={submit} onApprove={approve} onOpenWorkOrder={onOpenWorkOrder} />
  return listView
}

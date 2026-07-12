import { useState } from 'react'
import { AlertTriangle, Check, ChevronRight, Plus, Printer, X } from 'lucide-react'
import { Field, Section } from '../components/ui/FormControls'

function Badge({ children, tone = 'neutral' }) { return <span className={`badge ${tone}`}><i />{children}</span> }

function CreateWorkOrderModal({ rows, assets, onCancel, onCreate }) {
  const [form,setForm]=useState({type:'CM',description:'',priority:'3',site:'',location:'',asset:''})
  const [error,setError]=useState('')
  const update=key=>event=>setForm({...form,[key]:event.target.value})
  const sites=[...new Set([...assets.map(asset=>String(asset.site)),...rows.map(order=>String(order.SITE))].filter(Boolean))].sort()
  const siteAssets=assets.filter(asset=>!form.site||String(asset.site)===form.site)
  const assetOptions=siteAssets.map(asset=>({value:asset.assetnum,label:asset.description?.trim()}))
  const locations=[...new Set([...siteAssets.map(asset=>asset.location),...rows.filter(order=>!form.site||String(order.SITE)===form.site).map(order=>order['LOCATION '])].filter(Boolean))].sort()
  const changeSite=event=>setForm({...form,site:event.target.value,location:'',asset:''})
  const changeAsset=event=>{const value=event.target.value;const match=assets.find(asset=>asset.assetnum===value);setForm({...form,asset:value,location:match?.location||form.location,site:match?.site?String(match.site):form.site})}
  const submit=()=>{if(!form.description.trim()||!form.site||!form.location||!form.asset)return setError('Complete Description, Site, Location, and Asset before creating the work order.');onCreate(form)}
  return <div className="wo-overlay create-wo-overlay"><div className="create-wo-modal"><header><div><span className="record-kicker">NEW MAINTENANCE RECORD</span><h2>Create work order</h2><p>Start with the essential information. Configure execution details after creation.</p></div><button onClick={onCancel}><X size={20}/></button></header><div className="create-wo-body">{error&&<div className="form-error"><AlertTriangle size={17}/><span>{error}</span><button onClick={()=>setError('')}><X size={14}/></button></div>}<Section title="Core Information" note="Required to create the work order"><div className="create-wo-grid"><Field label="Work Type" value={form.type} required options={['CM','Incident']} onChange={update('type')}/><Field label="Priority" value={form.priority} required options={['1 - Emergency','2 - High','3 - Medium','4 - Low']} onChange={update('priority')}/><div className="create-span-2"><Field label="Description" value={form.description} required onChange={update('description')}/></div><Field label="Site" value={form.site} required onChange={changeSite} suggestions={sites} placeholder="Search or select a site"/><Field label="Location" value={form.location} required onChange={update('location')} suggestions={locations} placeholder="Search or select a location"/><div className="create-span-2"><Field label="Asset" value={form.asset} required onChange={changeAsset} suggestions={assetOptions} placeholder="Search asset number or description"/></div></div></Section><div className="create-next-step"><Check size={17}/><div><strong>Configure after creation</strong><span>Assignment, planning, failure codes, materials, PTW, actuals, meters, and closeout remain inside Work Order Details.</span></div></div></div><footer><button className="outline" onClick={onCancel}>Cancel</button><button className="primary" onClick={submit}><Plus size={15}/>Create work order</button></footer></div></div>
}

export default function WorkOrdersPage({ rows, assets, onCreate, EditorComponent, excelDate, slaBreached }) {
  const [selected, setSelected] = useState(() => {
    const id = decodeURIComponent(window.location.pathname.split('/work-orders/')[1] || '')
    return rows.find(order => String(order.WORKORDER) === id) || null
  })
  const [typeFilter, setTypeFilter] = useState('All')
  const [creating,setCreating]=useState(()=>window.location.pathname==='/work-orders/new')
  const orderType = order => (order['WORK TYPE '] || order['WORK TYPE  '] || 'PM').trim()
  const filtered = rows.filter(order => typeFilter === 'All' || orderType(order) === typeFilter)
  const count = type => rows.filter(order => type === 'All' || orderType(order) === type).length
  const openOrder = order => { setSelected(order); window.history.pushState({}, '', `/work-orders/${order.WORKORDER || 'new'}`) }
  const closeOrder = () => { setSelected(null); window.history.pushState({}, '', '/work-orders') }
  const openCreate=()=>{setCreating(true);window.history.pushState({},'','/work-orders/new')}
  const closeCreate=()=>{setCreating(false);window.history.pushState({},'','/work-orders')}
  const create=form=>{const created=onCreate(form);setCreating(false);setSelected(created);window.history.replaceState({},'',`/work-orders/${created.WORKORDER}`)}

  const listView = <div className="work-orders-index">
    <section className="page-heading"><div><p className="eyebrow">MAINTENANCE OPERATIONS</p><h1>Work Orders</h1><p>Track, plan, execute, and close every maintenance work order.</p></div><div className="heading-actions"><button className="outline"><Printer size={16} /> Print list</button><button className="primary" onClick={openCreate}><Plus size={17} />New work order</button></div></section>
    <div className="sub-tabs work-order-tabs">{['All', 'PM', 'CM', 'Incident'].map(type => <button key={type} className={typeFilter === type ? 'active' : ''} onClick={() => setTypeFilter(type)}>{type === 'All' ? 'All Work Orders' : type}<b>{count(type)}</b></button>)}</div>
    <section className="panel register work-order-table"><div className="table-shell"><table><thead><tr><th>Work order</th><th>Description</th><th>Type</th><th>Asset / Location</th><th>Status</th><th>SLA</th><th>Target start</th><th /></tr></thead><tbody>{filtered.map((order, index) => { const breached = slaBreached(order); return <tr key={index} className="click-row" onClick={() => openOrder(order)}><td><strong className="mono">#{order.WORKORDER}</strong></td><td>{order['DESCRIPITION ']}</td><td><Badge tone="blue">{orderType(order)}</Badge></td><td><strong>{order.ASSET}</strong><small className="cell-sub">{order['LOCATION ']}</small></td><td><Badge tone="orange">{order.STATUS}</Badge></td><td><Badge tone={breached ? 'orange' : 'green'}>{breached ? 'SLA Breached' : 'Met'}</Badge></td><td>{excelDate(order['TARGET START '])}</td><td><ChevronRight size={17} /></td></tr> })}</tbody></table></div><div className="table-footer"><span>{filtered.length} work orders</span><span>Click any row to open the complete work order</span></div></section>
  </div>
  if (selected?.WORKORDER) return <EditorComponent page order={selected} onClose={closeOrder} />
  if (creating) return <>{listView}<CreateWorkOrderModal rows={rows} assets={assets} onCancel={closeCreate} onCreate={create}/></>
  return listView
}

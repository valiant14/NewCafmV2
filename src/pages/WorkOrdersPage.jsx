import { useState } from 'react'
import { AlertTriangle, Check, ChevronRight, Plus, Printer, X } from 'lucide-react'
import Badge from '../components/ui/Badge'
import Button from '../components/ui/Button'
import ExcelImportButton from '../components/ui/ExcelImportButton'
import ImportNotice from '../components/ui/ImportNotice'
import { Field, Section } from '../components/ui/FormControls'
import IndexTabs from '../components/ui/IndexTabs'
import PageHeader from '../components/ui/PageHeader'

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
  const [imported,setImported]=useState('')
  const [page,setPage]=useState(1)
  const [pageSize,setPageSize]=useState(10)
  const orderType = order => (order['WORK TYPE '] || order['WORK TYPE  '] || 'PM').trim()
  const filtered = rows.filter(order => typeFilter === 'All' || orderType(order) === typeFilter)
  const pageCount=Math.max(1,Math.ceil(filtered.length/pageSize))
  const currentPage=Math.min(page,pageCount)
  const paginated=filtered.slice((currentPage-1)*pageSize,currentPage*pageSize)
  const count = type => rows.filter(order => type === 'All' || orderType(order) === type).length
  const openOrder = order => { setSelected(order); window.history.pushState({}, '', `/work-orders/${order.WORKORDER || 'new'}`) }
  const closeOrder = () => { setSelected(null); window.history.pushState({}, '', '/work-orders') }
  const openCreate=()=>{setCreating(true);window.history.pushState({},'','/work-orders/new')}
  const closeCreate=()=>{setCreating(false);window.history.pushState({},'','/work-orders')}
  const create=form=>{const created=onCreate(form);setCreating(false);setSelected(created);window.history.replaceState({},'',`/work-orders/${created.WORKORDER}`)}

  const listView = <div className="work-orders-index">
    <PageHeader eyebrow="MAINTENANCE OPERATIONS" title="Work Orders" description="Track, plan, execute, and close every maintenance work order." actions={<div className="flex items-center gap-2"><ExcelImportButton fileName={imported} onFile={setImported} /><Button variant="outline"><Printer size={16} /> Print list</Button><Button onClick={openCreate}><Plus size={17} />New work order</Button></div>} />
    <ImportNotice fileName={imported} subject="work order" onClear={()=>setImported('')} />
    <IndexTabs active={typeFilter} onChange={type => {setTypeFilter(type);setPage(1)}} tabs={['All', 'PM', 'CM', 'Incident'].map(type => ({ key: type, label: type === 'All' ? 'All Work Orders' : type, count: count(type) }))} />
    <section className="panel register work-order-table tracking-columns"><div className="table-shell"><table><thead><tr><th>WORKORDER</th><th>DESCRIPITION</th><th>LOCATION</th><th>LOCATION PRIORTY</th><th>ASSET</th><th>STATUS</th><th>WORK TYPE</th><th>STATUS DESCRIPITION</th><th>DEPARTMENT</th><th>SUB DEPARTMENT</th><th>SUB DEPARTMENT NAME</th><th>TARGET START</th><th>TARGET FINISH</th><th>ACTUAL START</th><th>ACTUAL FINISH</th><th>REPORTED DATE</th><th>PRIORTY</th><th>SITE</th><th>JOP PLAN</th><th>DURATION</th><th>PM</th><th /></tr></thead><tbody>{paginated.map((order, index) => <tr key={index} className="click-row" onClick={() => openOrder(order)}><td><strong className="mono">#{order.WORKORDER}</strong></td><td>{order['DESCRIPITION '] || '—'}</td><td>{order['LOCATION '] || '—'}</td><td><Badge tone={String(order['LOCATION PRIORTY']||'').trim()==='VIP'?'purple':'neutral'}>{order['LOCATION PRIORTY'] || '—'}</Badge></td><td><strong>{order.ASSET || '—'}</strong></td><td><Badge tone="orange">{order.STATUS || '—'}</Badge></td><td><Badge tone="blue">{orderType(order)}</Badge></td><td>{order['STATUS DESCRIPITION'] || '—'}</td><td>{order['DEPARTMENT '] || '—'}</td><td>{order['SUB DEPARTMENT '] || '—'}</td><td>{order['SUB DEPARTMENT  NAME'] || '—'}</td><td>{excelDate(order['TARGET START '])}</td><td>{excelDate(order['TARGET FINISH '])}</td><td>{excelDate(order['ACTUAL START '])}</td><td>{excelDate(order['ACTUAL FINISH '])}</td><td>{excelDate(order['REPORTED DATE '])}</td><td>{order.PRIORTY || '—'}</td><td>{order.SITE || '—'}</td><td>{order['JOP PLAN '] || '—'}</td><td>{order['DURATION '] || '—'}</td><td>{order['PM '] || '—'}</td><td><ChevronRight size={17} /></td></tr>)}</tbody></table></div><div className="pagination-bar"><div>Showing <strong>{filtered.length?((currentPage-1)*pageSize)+1:0}–{Math.min(currentPage*pageSize,filtered.length)}</strong> of <strong>{filtered.length}</strong></div><label>Rows<select value={pageSize} onChange={event=>{setPageSize(Number(event.target.value));setPage(1)}}><option value="10">10</option><option value="25">25</option><option value="50">50</option></select></label><div className="page-controls"><button disabled={currentPage===1} onClick={()=>setPage(value=>Math.max(1,value-1))}>Previous</button><span>Page {currentPage} of {pageCount}</span><button disabled={currentPage===pageCount} onClick={()=>setPage(value=>Math.min(pageCount,value+1))}>Next</button></div></div></section>
  </div>
  if (selected?.WORKORDER) return <EditorComponent page order={selected} onClose={closeOrder} />
  if (creating) return <>{listView}<CreateWorkOrderModal rows={rows} assets={assets} onCancel={closeCreate} onCreate={create}/></>
  return listView
}

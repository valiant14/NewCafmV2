import { createRequire } from 'node:module'
import assetSeeds, { assetOverrides } from './src/data/assetSeeds.js'
import { subDepartmentName } from './src/lib/departments.js'
import seeds from './src/data/workOrderSeeds.js'
const require = createRequire('file:///' + process.cwd() + '/x.js')
const J = n => require('./src/data/' + n)
const wb = J('workbooks.json')
const toObj = r => { const h=(r[0]||[]).map((x,i)=>String(x||'C'+i).trim()); return r.slice(1).filter(x=>x.some(v=>v!==null&&v!=='')).map(x=>Object.fromEntries(h.map((k,i)=>[k,x[i]??'']))) }
const assets = [...toObj(wb.assets.assets).map(r=>({...r,'sub department':subDepartmentName(r['sub department']),...(assetOverrides[r.assetnum]||{})})), ...assetSeeds]
const locations=J('locations.json'), departments=J('departments.json'), crafts=J('crafts.json'),
      labor=J('labor.json'), materials=J('materials.json'), inventory=J('inventory.json'),
      storerooms=J('storerooms.json'), tools=J('tools.json'), pm=J('pmSchedules.json'),
      jobPlans=J('jobPlans.json'), users=J('users.json')
const c=v=>String(v??'').trim().toUpperCase()
const has=(a,k,v)=>a.some(r=>c(r[k])===c(v))
const subs=departments.flatMap(d=>(d.subDepartments||[]).map(s=>s.name))
const systems=departments.flatMap(d=>(d.systems||[]).map(s=>s.name))
const groups=departments.flatMap(d=>d.workGroups||[])
const broken=[]
const B=m=>broken.push(m)

assets.forEach(a=>{
  if(!a.location) B(`asset ${a.assetnum}: no location`)
  else if(!has(locations,'location',a.location)) B(`asset ${a.assetnum}: location ${a.location} not in locations`)
  if(a.department&&!has(departments,'name',a.department)) B(`asset ${a.assetnum}: department ${a.department} unknown`)
  if(a['sub department']&&!subs.map(c).includes(c(a['sub department']))) B(`asset ${a.assetnum}: sub department ${a['sub department']} unknown`)
})
locations.forEach(l=>{ if(l.department&&!has(departments,'name',l.department)) B(`location ${l.location}: department ${l.department} unknown`) })
crafts.forEach(x=>{ if(!has(departments,'name',x.department)) B(`craft ${x.code}: department unknown`); if(x.subDepartment&&!subs.map(c).includes(c(x.subDepartment))) B(`craft ${x.code}: subDepartment ${x.subDepartment} unknown`) })
labor.forEach(x=>{ if(!has(crafts,'code',x.craftCode)) B(`labor ${x.personId}: craftCode ${x.craftCode} unknown`); if(!has(departments,'name',x.department)) B(`labor ${x.personId}: department unknown`) })
crafts.forEach(x=>{ if(!labor.some(p=>c(p.craftCode)===c(x.code))) B(`craft ${x.code}: no labor assigned`) })
materials.forEach(m=>{ if(!has(storerooms,'code',m.storeroom)) B(`material ${m.itemNumber}: storeroom unknown`); if(!inventory.some(i=>c(i.itemNumber)===c(m.itemNumber))) B(`material ${m.itemNumber}: no inventory row`) })
inventory.forEach(i=>{ if(!has(materials,'itemNumber',i.itemNumber)) B(`inventory ${i.itemNumber}: not a material`); if(!has(storerooms,'code',i.storeroom)) B(`inventory ${i.itemNumber}: storeroom unknown`) })
storerooms.forEach(s=>{ if(!has(locations,'location',s.location)) B(`storeroom ${s.code}: location unknown`); if(s.department&&!has(departments,'name',s.department)) B(`storeroom ${s.code}: department ${s.department} unknown`) })
tools.forEach(t=>{ if(t.location&&!has(storerooms,'code',t.location)) B(`tool ${t.toolNumber}: location ${t.location} not a storeroom`) })
pm.forEach(p=>{
  if(p.asset&&!has(assets,'assetnum',p.asset)) B(`pm ${p.pmNumber}: asset ${p.asset} unknown`)
  if(!p.asset&&!p.location) B(`pm ${p.pmNumber}: neither asset nor location`)
  if(p.location&&!has(locations,'location',p.location)) B(`pm ${p.pmNumber}: location ${p.location} unknown`)
  if(p.jobPlan&&!has(jobPlans,'JPNUM',p.jobPlan)) B(`pm ${p.pmNumber}: jobPlan ${p.jobPlan} unknown`)
  if(p.storeLocation&&!has(storerooms,'code',p.storeLocation)) B(`pm ${p.pmNumber}: storeLocation unknown`)
  if(p.department&&!has(departments,'name',p.department)) B(`pm ${p.pmNumber}: department unknown`)
  if(p.subDepartment&&!subs.map(c).includes(c(p.subDepartment))) B(`pm ${p.pmNumber}: subDepartment ${p.subDepartment} unknown`)
  if(p.supervisor&&!has(labor,'name',p.supervisor)) B(`pm ${p.pmNumber}: supervisor ${p.supervisor} not labor`)
  if(p.lead&&!has(labor,'name',p.lead)) B(`pm ${p.pmNumber}: lead ${p.lead} not labor`)
  if(p.personGroup&&!groups.map(c).includes(c(p.personGroup))) B(`pm ${p.pmNumber}: personGroup ${p.personGroup} unknown`)
})
users.forEach(u=>{ if(u.laborId&&!has(labor,'personId',u.laborId)) B(`user ${u.username}: laborId unknown`); if(u.department&&u.department!=='All Departments'&&!has(departments,'name',u.department)&&!subs.map(c).includes(c(u.department))) B(`user ${u.username}: department ${u.department} unknown`) })
seeds.forEach(w=>{
  const id=w.WORKORDER
  if(!has(assets,'assetnum',w.ASSET)) B(`WO ${id}: asset ${w.ASSET} unknown`)
  if(!has(locations,'location',w['LOCATION '])) B(`WO ${id}: location unknown`)
  if(!has(departments,'name',w['DEPARTMENT '])) B(`WO ${id}: department unknown`)
  if(!subs.map(c).includes(c(w['SUB DEPARTMENT  NAME']))) B(`WO ${id}: sub department ${w['SUB DEPARTMENT  NAME']} unknown`)
  if(!systems.map(c).includes(c(w.SYSTEM))) B(`WO ${id}: system ${w.SYSTEM} unknown`)
  const a=assets.find(x=>c(x.assetnum)===c(w.ASSET))
  if(a){
    if(a.location&&c(a.location)!==c(w['LOCATION '])) B(`WO ${id}: location disagrees with asset master (${w['LOCATION ']} vs ${a.location})`)
    if(String(a.site)!==String(w.SITE)) B(`WO ${id}: site disagrees with asset master (${w.SITE} vs ${a.site})`)
    if(a.department&&c(a.department)!==c(w['DEPARTMENT '])) B(`WO ${id}: department disagrees with asset master`)
  }
  ;(w['PLANNED LABOR']||[]).forEach(r=>{
    if(!has(crafts,'name',r.craft)) B(`WO ${id}: craft ${r.craft} unknown`)
    if(r.crew&&!has(labor,'name',r.crew)) B(`WO ${id}: crew ${r.crew} not labor`)
  })
  ;(w['PLANNED RESOURCES']||[]).forEach(r=>{
    if(r.type==='Material'&&!has(materials,'description',r.item)) B(`WO ${id}: material ${r.item} unknown`)
    if(['Tool','Equipment'].includes(r.type)&&!has(tools,'description',r.item)) B(`WO ${id}: tool ${r.item} unknown`)
  })
})
console.log('REFERENTIAL INTEGRITY AUDIT')
console.log('  records: assets '+assets.length+', locations '+locations.length+', departments '+departments.length+
  ', crafts '+crafts.length+', labor '+labor.length+', materials '+materials.length+', tools '+tools.length+
  ', storerooms '+storerooms.length+', pm '+pm.length+', jobPlans '+jobPlans.length+', users '+users.length+', WO seeds '+seeds.length)
console.log()
if(broken.length){ console.log('  BROKEN LINKS ('+broken.length+'):'); broken.forEach(b=>console.log('    '+b)) }
else console.log('  no broken links')
process.exit(broken.length?1:0)

import { Plus, Search, SlidersHorizontal } from 'lucide-react'
import DataTable from '../components/ui/DataTable'

export default function RegisterPage({ title, eyebrow, description, rows, columns, search, setSearch, action='Add record' }) {
  return <><section className="page-heading"><div><p className="eyebrow">{eyebrow}</p><h1>{title}</h1><p>{description}</p></div><button className="primary"><Plus size={17}/>{action}</button></section><section className="panel register"><div className="register-tools"><div className="search-box"><Search size={17}/><input value={search} onChange={e=>setSearch(e.target.value)} placeholder={`Search ${title.toLowerCase()}…`}/></div><button className="outline"><SlidersHorizontal size={16}/> Filter</button></div><DataTable rows={rows} columns={columns} search={search}/></section></>
}

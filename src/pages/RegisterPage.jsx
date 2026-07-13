import { Plus, Search, SlidersHorizontal } from 'lucide-react'
import DataTable from '../components/ui/DataTable'
import PageHeader from '../components/ui/PageHeader'

export default function RegisterPage({ title, eyebrow, description, rows, columns, search, setSearch, action = 'Add record' }) {
  return (
    <>
      <PageHeader eyebrow={eyebrow} title={title} description={description} actionLabel={action} actionIcon={Plus} />

      <section className="panel register">
        <div className="register-tools">
          <div className="search-box">
            <Search size={17} />
            <input value={search} onChange={event => setSearch(event.target.value)} placeholder={`Search ${title.toLowerCase()}...`} />
          </div>
          <button className="outline"><SlidersHorizontal size={16} /> Filter</button>
        </div>

        <DataTable rows={rows} columns={columns} search={search} />
      </section>
    </>
  )
}

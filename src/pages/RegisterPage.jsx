import { useState } from 'react'
import { Plus, Search, SlidersHorizontal } from 'lucide-react'
import DataTable from '../components/ui/DataTable'
import ExcelImportButton from '../components/ui/ExcelImportButton'
import ImportNotice from '../components/ui/ImportNotice'
import PageHeader from '../components/ui/PageHeader'

export default function RegisterPage({ title, eyebrow, description, rows, columns, search, setSearch, action = 'Add record' }) {
  const [imported, setImported] = useState('')

  return (
    <>
      <PageHeader
        eyebrow={eyebrow}
        title={title}
        description={description}
        actions={(
          <div className="heading-actions">
            <ExcelImportButton fileName={imported} onFile={setImported} />
            <button className="primary"><Plus size={17} />{action}</button>
          </div>
        )}
      />

      <ImportNotice fileName={imported} subject={title.toLowerCase()} onClear={() => setImported('')} />

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

import { useState } from 'react'
import { Plus } from 'lucide-react'
import DataTable from '../components/ui/DataTable'
import ExcelImportButton from '../components/ui/ExcelImportButton'
import ImportNotice from '../components/ui/ImportNotice'
import IndexTabs from '../components/ui/IndexTabs'
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

      <IndexTabs
        active="All"
        tabs={[
          { key: 'All', label: `All ${title}`, count: rows.length }
        ]}
      />

      <section className="panel register">
        <DataTable rows={rows} columns={columns} search={search} pagination />
      </section>
    </>
  )
}

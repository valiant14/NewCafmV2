import { useState } from 'react'
import { Plus } from 'lucide-react'
import Button from '../components/ui/Button'
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
          <div className="flex items-center gap-2">
            <ExcelImportButton fileName={imported} onFile={setImported} />
            <Button><Plus size={17} />{action}</Button>
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

      <section className="overflow-hidden rounded-2xl border border-[var(--app-line)] bg-white shadow-[0_8px_24px_rgba(32,55,45,.06)]">
        <DataTable rows={rows} columns={columns} search={search} pagination />
      </section>
    </>
  )
}

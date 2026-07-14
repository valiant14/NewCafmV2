import { useEffect, useState } from 'react'
import { Plus } from 'lucide-react'
import Button from '../components/ui/Button'
import DataTable from '../components/ui/DataTable'
import ExcelImportButton from '../components/ui/ExcelImportButton'
import ExcelTemplateButton from '../components/ui/ExcelTemplateButton'
import ImportNotice from '../components/ui/ImportNotice'
import IndexTabs from '../components/ui/IndexTabs'
import MasterRecordModal from '../components/master-data/MasterRecordModal'
import PageHeader from '../components/ui/PageHeader'

const emptyFromFields = fields => Object.fromEntries((fields || []).map(field => [field.key, field.defaultValue ?? '']))

export default function RegisterPage({ title, eyebrow, description, rows, columns, search, setSearch, action = 'Add record', modalTitle, modalNote, modalFields = [], mapFormToRow }) {
  const [imported, setImported] = useState('')
  const [records, setRecords] = useState(rows)
  const [modalOpen, setModalOpen] = useState(false)
  const [form, setForm] = useState(() => emptyFromFields(modalFields))

  useEffect(() => setRecords(rows), [rows])

  const saveRecord = () => {
    const next = mapFormToRow ? mapFormToRow(form) : form
    setRecords(current => [next, ...current])
    setForm(emptyFromFields(modalFields))
    setModalOpen(false)
  }

  return (
    <>
      <PageHeader
        eyebrow={eyebrow}
        title={title}
        description={description}
        actions={(
          <div className="flex items-center gap-2">
            <ExcelTemplateButton headers={modalFields.map(field => field.key)} fileName={`${title.replace(/\s+/g, '_')}_Template.xlsx`} />
            <ExcelImportButton fileName={imported} onFile={setImported} onImport={rows => setRecords(rows)} />
            <Button onClick={() => setModalOpen(true)}><Plus size={17} />{action}</Button>
          </div>
        )}
      />

      <ImportNotice fileName={imported} subject={title.toLowerCase()} onClear={() => setImported('')} />

      <IndexTabs
        active="All"
        tabs={[
          { key: 'All', label: `All ${title}`, count: records.length }
        ]}
      />

      <section className="overflow-hidden rounded-2xl border border-[var(--app-line)] bg-white shadow-[0_8px_24px_rgba(32,55,45,.06)]">
        <DataTable rows={records} columns={columns} search={search} pagination />
      </section>

      {modalOpen && (
        <MasterRecordModal
          title={modalTitle || action}
          note={modalNote || `Create a new ${title.toLowerCase()} record.`}
          fields={modalFields}
          form={form}
          setForm={setForm}
          onClose={() => setModalOpen(false)}
          onSave={saveRecord}
          submitLabel="Create record"
        />
      )}
    </>
  )
}

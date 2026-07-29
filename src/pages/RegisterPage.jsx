import { useEffect, useState } from 'react'
import { Plus } from 'lucide-react'
import Button from '../components/ui/Button'
import DataTable from '../components/ui/DataTable'
import ExcelImportButton from '../components/ui/ExcelImportButton'
import ExcelTemplateButton from '../components/ui/ExcelTemplateButton'
import ExportExcelButton from '../components/ui/ExportExcelButton'
import ImportNotice from '../components/ui/ImportNotice'
import IndexTabs from '../components/ui/IndexTabs'
import MasterRecordModal from '../components/master-data/MasterRecordModal'
import PageHeader from '../components/ui/PageHeader'
import StandardFilters from '../components/ui/StandardFilters'
import { applyStandardFilters, emptyStandardFilters, optionsFromRows } from '../lib/standardFilters'

const emptyFromFields = fields => Object.fromEntries((fields || []).map(field => [field.key, field.defaultValue ?? '']))

export default function RegisterPage({ title, eyebrow, description, rows, columns, search, setSearch, action = 'Add record', modalTitle, modalNote, modalFields = [], mapFormToRow, statusTabs = [], rowKey, onRowClick, onCreate }) {
  const [imported, setImported] = useState('')
  const [records, setRecords] = useState(rows)
  const [modalOpen, setModalOpen] = useState(false)
  const [form, setForm] = useState(() => emptyFromFields(modalFields))
  const [filters, setFilters] = useState(emptyStandardFilters)
  const [tab, setTab] = useState('All')

  useEffect(() => setRecords(rows), [rows])

  const statusOf = row => String(row.status || row.STATUS || 'ACTIVE').toUpperCase()
  const tabRecords = tab === 'All' ? records : records.filter(row => statusOf(row) === tab)
  const visibleRecords = applyStandardFilters(tabRecords, filters)

  const saveRecord = () => {
    const next = mapFormToRow ? mapFormToRow(form) : form
    // Local state is reset whenever `rows` changes identity, so when the parent owns the
    // data it has to save through the callback or the record is lost on the next render.
    if (onCreate) onCreate(next)
    else setRecords(current => [next, ...current])
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
            <ExportExcelButton module={title} rows={visibleRecords} columns={columns} />
            <ExcelImportButton fileName={imported} onFile={setImported} onImport={rows => setRecords(rows)} />
            <Button onClick={() => setModalOpen(true)}><Plus size={17} />{action}</Button>
          </div>
        )}
      />

      <ImportNotice fileName={imported} subject={title.toLowerCase()} onClear={() => setImported('')} />

      <IndexTabs
        active={tab}
        onChange={value => { setTab(value); setFilters(emptyStandardFilters) }}
        tabs={[
          { key: 'All', label: `All ${title}`, count: records.length },
          ...statusTabs.map(status => ({ key: status, label: status.charAt(0) + status.slice(1).toLowerCase(), count: records.filter(row => statusOf(row) === status).length }))
        ]}
      />
      <StandardFilters
        filters={filters}
        setFilters={setFilters}
        siteOptions={optionsFromRows(records, ['site', 'SITE'])}
        departmentOptions={optionsFromRows(records, ['department', 'DEPARTMENT', 'DEPARTMENT '])}
        statusOptions={optionsFromRows(records, ['status', 'STATUS'])}
      />

      <section className="overflow-hidden rounded-2xl border border-[var(--app-line)] bg-white shadow-[0_8px_24px_rgba(32,55,45,.06)]">
        <DataTable rows={visibleRecords} columns={columns} rowKey={rowKey} onRowClick={onRowClick} search={search} pagination />
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

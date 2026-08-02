import { useState } from 'react'
import { Plus } from 'lucide-react'
import Badge from '../components/ui/Badge'
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

const emptySite = {
  code: '',
  name: '',
  region: '',
  city: '',
  status: 'Active'
}

const fields = [
  { key: 'code', label: 'Site Code', required: true, placeholder: '1031' },
  { key: 'name', label: 'Site Name', required: true, placeholder: 'Riyadh HQ' },
  { key: 'region', label: 'Region', placeholder: 'Central' },
  { key: 'city', label: 'City', placeholder: 'Riyadh' },
  { key: 'status', label: 'Status', options: ['Active', 'Inactive'] }
]
const templateHeaders = Object.keys(emptySite)
const exportColumns = [
  { key: 'code', header: 'Site Code' },
  { key: 'name', header: 'Site Name' },
  { key: 'region', header: 'Region' },
  { key: 'city', header: 'City' },
  { key: 'status', header: 'Status' }
]

export const siteScopeValue = site => site.name ? `${site.name} / ${site.code}` : site.code

export default function SitesSettingsPage({ rows = [], setRows }) {
  const [tab, setTab] = useState('All')
  const [filters, setFilters] = useState(emptyStandardFilters)
  const [imported, setImported] = useState('')
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState(null)
  const [form, setForm] = useState(emptySite)
  const [error, setError] = useState('')
  const tabRows = tab === 'All' ? rows : rows.filter(row => row.status === tab)
  const visibleRows = applyStandardFilters(tabRows, filters, {
    site: ['code'],
    status: ['status']
  })

  const openNew = () => {
    setEditing(null)
    setForm(emptySite)
    setError('')
    setModalOpen(true)
  }

  const openEdit = row => {
    setEditing(row.code)
    setForm({ ...emptySite, ...row })
    setError('')
    setModalOpen(true)
  }

  const save = () => {
    const code = String(form.code || '').trim()
    if (!code || !form.name) return
    const duplicate = rows.some(row => row.code === code && row.code !== editing)
    if (duplicate) return setError('Site code already exists.')
    const record = { ...form, code }
    setRows?.(current => editing
      ? current.map(row => row.code === editing ? record : row)
      : [record, ...current]
    )
    setModalOpen(false)
  }

  const importRows = importedRows => {
    setRows?.(importedRows.map(row => ({
      ...emptySite,
      ...row,
      code: String(row.code || row['Site Code'] || '').trim(),
      name: row.name || row['Site Name'] || '',
      region: row.region || row.Region || '',
      city: row.city || row.City || '',
      status: row.status || row.Status || 'Active'
    })).filter(row => row.code && row.name))
  }

  return (
    <>
      <PageHeader
        eyebrow="SETTINGS"
        title="Sites"
        description="Maintain the site records used for user access scope and filtering."
        actions={(
          <div className="flex items-center gap-2">
            <ExcelTemplateButton headers={templateHeaders} fileName="Sites_Template.xlsx" />
            <ExportExcelButton module="Sites" rows={visibleRows} columns={exportColumns} />
            <ExcelImportButton fileName={imported} onFile={setImported} onImport={importRows} />
            <Button onClick={openNew}><Plus size={17} />Add site</Button>
          </div>
        )}
      />
      <ImportNotice fileName={imported} subject="sites" onClear={() => setImported('')} />

      <IndexTabs
        active={tab}
        onChange={value => { setTab(value); setFilters(emptyStandardFilters) }}
        tabs={[
          { key: 'All', label: 'All Sites', count: rows.length },
          { key: 'Active', label: 'Active', count: rows.filter(row => row.status === 'Active').length },
          { key: 'Inactive', label: 'Inactive', count: rows.filter(row => row.status === 'Inactive').length }
        ]}
      />

      <StandardFilters
        filters={filters}
        setFilters={setFilters}
        siteOptions={optionsFromRows(rows, ['code'])}
        departmentOptions={[]}
        statusOptions={optionsFromRows(rows, ['status'])}
      />

      <section className="overflow-hidden rounded-2xl border border-[var(--app-line)] bg-[var(--app-panel)] shadow-[0_8px_24px_rgba(32,55,45,.05)]">
        <DataTable
          rows={visibleRows}
          rowKey="code"
          onRowClick={openEdit}
          pagination
          columns={[
            { key: 'code', label: 'Site Code', render: value => <strong className="mono text-[var(--app-ink)]">{value}</strong> },
            { key: 'name', label: 'Site Name' },
            { key: 'region', label: 'Region' },
            { key: 'city', label: 'City' },
            { key: 'scope', label: 'Scope Value', render: (_, row) => siteScopeValue(row) },
            { key: 'status', label: 'Status', render: value => <Badge tone={value === 'Active' ? 'green' : 'orange'}>{value}</Badge> }
          ]}
        />
      </section>
      {modalOpen && (
        <MasterRecordModal
          title={editing ? 'Edit site' : 'Add site'}
          note="Site scope values can be assigned to users, including multiple comma-separated sites."
          fields={fields}
          form={form}
          setForm={setForm}
          error={error}
          submitLabel={editing ? 'Save site' : 'Create site'}
          onClose={() => setModalOpen(false)}
          onSave={save}
        />
      )}
    </>
  )
}

import { useState } from 'react'
import { Activity, Building2, Globe, Hash, MapPin, Plus } from 'lucide-react'
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
import TablePanel from '../components/ui/TablePanel'
import StandardFilters from '../components/ui/StandardFilters'
import { applyStandardFilters, emptyStandardFilters, optionsFromRows } from '../lib/standardFilters'
import useModuleAccess from '../hooks/useModuleAccess'
import { pick } from '../services/importRows'
import { mergeImportedRows } from '../lib/importRows'

const emptySite = {
  code: '',
  name: '',
  region: '',
  city: '',
  status: 'Active'
}

const identity = { section: 'Site', sectionIcon: Building2, sectionNote: 'The code is what gets assigned to a user as their site scope' }
const place = { section: 'Location', sectionIcon: MapPin, sectionNote: 'Where the site is, and whether it is in use', sectionTone: 'green' }

const fields = [
  { ...identity, key: 'code', label: 'Site Code', icon: Hash, required: true, placeholder: 'Enter site code' },
  { ...identity, key: 'name', label: 'Site Name', icon: Building2, required: true, placeholder: 'Riyadh HQ' },
  { ...place, key: 'region', label: 'Region', icon: Globe, placeholder: 'Central' },
  { ...place, key: 'city', label: 'City', icon: MapPin, placeholder: 'Riyadh' },
  { ...place, key: 'status', label: 'Status', icon: Activity, options: ['Active', 'Inactive'] }
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
  const access = useModuleAccess('Sites')
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

  const normalizeImportRows = importedRows => importedRows.map(row => ({
      ...emptySite,
      ...row,
      code: String(pick(row, ['code', 'Site Code'])).trim(),
      name: pick(row, ['name', 'Site Name']),
      region: pick(row, ['region', 'Region']),
      city: pick(row, ['city', 'City']),
      status: pick(row, ['status', 'Status'], 'Active')
    })).filter(row => row.code && row.name)

  const importRows = async importedRows => {
    const normalized = normalizeImportRows(importedRows)
    await setRows?.(current => mergeImportedRows(current, normalized, 'code'))
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
            {access.import && <ExcelImportButton fileName={imported} onFile={setImported} onImport={importRows} />}
            {access.create && <Button onClick={openNew}><Plus size={17} />Add site</Button>}
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

      <TablePanel tone="green">
        <DataTable
          rows={visibleRows}
          rowKey="code"
          onRowClick={openEdit}
          pagination
          columns={[
            { key: 'code', label: 'Site Code', render: value => <strong className="mono text-[var(--app-ink)]">{value}</strong> },
            { key: 'name', label: 'Site Name' },
            { key: 'region', label: 'Region', render: value => value || <span className="text-[var(--app-muted)]">-</span> },
            { key: 'city', label: 'City', render: value => value || <span className="text-[var(--app-muted)]">-</span> },
            // This is the exact string a user's site scope has to carry, so it reads as a value
            // to copy rather than another descriptive column.
            { key: 'scope', label: 'Scope Value', render: (_, row) => <Badge tone="blue">{siteScopeValue(row)}</Badge> },
            { key: 'status', label: 'Status', render: value => <Badge tone={value === 'Active' ? 'green' : 'orange'}>{value}</Badge> }
          ]}
        />
      </TablePanel>
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

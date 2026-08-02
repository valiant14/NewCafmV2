import { useEffect, useState } from 'react'
import { Gauge, Plus } from 'lucide-react'
import Badge from '../components/ui/Badge'
import Button from '../components/ui/Button'
import DataTable from '../components/ui/DataTable'
import EmptyState from '../components/ui/EmptyState'
import ExcelImportButton from '../components/ui/ExcelImportButton'
import ExcelTemplateButton from '../components/ui/ExcelTemplateButton'
import ImportNotice from '../components/ui/ImportNotice'
import IndexTabs from '../components/ui/IndexTabs'
import MasterRecordModal from '../components/master-data/MasterRecordModal'
import MeterDetailPage from '../components/meters/MeterDetailPage'
import PageHeader from '../components/ui/PageHeader'
import StandardFilters from '../components/ui/StandardFilters'
import { applyStandardFilters, optionsFromRows, scopedStandardFilters } from '../lib/standardFilters'
import { useAuth } from '../providers/AuthProvider'
import { nowLocalDate, toLocalDateInput } from '../lib/datetime'

const emptyMeter = {
  meterId: '',
  asset: '',
  location: '',
  site: '1031',
  department: '',
  meterType: 'General',
  reading: '',
  unit: '',
  readingDate: '',
  status: 'Active'
}

const templateHeaders = Object.keys(emptyMeter)
// Stamped when the form opens rather than when the module loads, so a session left open
// past midnight does not file readings under yesterday.
const blankMeter = () => ({ ...emptyMeter, readingDate: nowLocalDate() })
const fields = [
  { key: 'meterId', label: 'Meter ID', required: true, placeholder: 'MTR-0001' },
  { key: 'asset', label: 'Asset', required: true },
  { key: 'location', label: 'Location', required: true },
  { key: 'site', label: 'Site', required: true },
  { key: 'department', label: 'Department', required: true },
  { key: 'meterType', label: 'Meter Type', options: ['General', 'Water', 'Energy', 'Runtime'] },
  { key: 'reading', label: 'Reading', required: true, type: 'number' },
  { key: 'unit', label: 'Unit', placeholder: 'kWh / m³ / hours' },
  { key: 'readingDate', label: 'Reading Date', type: 'date', required: true },
  { key: 'status', label: 'Status', options: ['Active', 'Inactive', 'Needs Review'] }
]

export default function MetersPage({ rows = [], setRows, assets = [], workOrders = [] }) {
  const { user } = useAuth()
  const [tab, setTab] = useState('All')
  const [filters, setFilters] = useState(() => scopedStandardFilters(user, rows))
  const [imported, setImported] = useState('')
  const [modalOpen, setModalOpen] = useState(false)
  const [form, setForm] = useState(blankMeter)
  const routeId = decodeURIComponent(window.location.pathname.split('/meters/')[1] || '')
  const [selected, setSelected] = useState(rows.find(row => row.meterId === routeId) || null)
  useEffect(() => {
    if (!routeId) return
    const latest = rows.find(row => row.meterId === routeId)
    if (latest) setSelected(latest)
  }, [rows, routeId])

  const tabRows = tab === 'All' ? rows : rows.filter(row => row.status === tab)
  const visibleRows = applyStandardFilters(tabRows, filters, { date: ['readingDate'] })

  const save = () => {
    if (!form.meterId || !form.asset || !form.reading) return
    setRows?.(current => [{ ...form }, ...current])
    setForm(blankMeter())
    setModalOpen(false)
  }

  const open = row => {
    setSelected(row)
    window.history.pushState({}, '', `/meters/${row.meterId}`)
  }

  const close = () => {
    setSelected(null)
    window.history.pushState({}, '', '/meters')
  }

  const updateMeter = (meterId, patch) => {
    setRows?.(current => current.map(row => row.meterId === meterId ? { ...row, ...patch } : row))
    setSelected(current => current?.meterId === meterId ? { ...current, ...patch } : current)
  }

  const pastReadingsFor = meter => {
    const relatedRows = rows.filter(row => row.meterId === meter.meterId || (row.asset && row.asset === meter.asset))
    const generated = Array.from({ length: 5 }, (_, index) => {
      const reading = Number(meter.reading || 0)
      const date = new Date(`${meter.readingDate || '2026-07-16'}T00:00:00`)
      date.setDate(date.getDate() - ((index + 1) * 30))
      return {
        readingId: `${meter.meterId}-H${index + 1}`,
        reading: Math.max(0, reading - ((index + 1) * 85)),
        unit: meter.unit,
        readingDate: toLocalDateInput(date),
        source: 'Historical reading',
        status: 'Posted'
      }
    })
    return [...relatedRows.map((row, index) => ({
      readingId: `${row.meterId}-${index}`,
      reading: row.reading,
      unit: row.unit,
      readingDate: row.readingDate,
      source: row.meterId === meter.meterId ? 'Current meter' : 'Same asset',
      status: row.status
    })), ...generated].sort((a, b) => String(b.readingDate).localeCompare(String(a.readingDate)))
  }

  if (selected) {
    return <MeterDetailPage meter={selected} pastReadings={pastReadingsFor(selected)} onBack={close} onUpdate={updateMeter} />
  }

  return (
    <>
      <PageHeader
        eyebrow="METER MANAGEMENT"
        title="Meters"
        description="Record and test asset readings for water, energy, runtime, and general meters."
        actions={(
          <div className="flex items-center gap-2">
            <ExcelTemplateButton headers={templateHeaders} fileName="Meters_Template.xlsx" />
            <ExcelImportButton fileName={imported} onFile={setImported} onImport={setRows} />
            <Button onClick={() => { setForm(blankMeter()); setModalOpen(true) }}><Plus size={17} />Add meter reading</Button>
          </div>
        )}
      />

      <ImportNotice fileName={imported} subject="meter readings" onClear={() => setImported('')} />

      <IndexTabs
        active={tab}
        onChange={value => { setTab(value); setFilters(scopedStandardFilters(user, rows)) }}
        tabs={[
          { key: 'All', label: 'All Meters', count: rows.length },
          { key: 'Active', label: 'Active', count: rows.filter(row => row.status === 'Active').length },
          { key: 'Needs Review', label: 'Needs Review', count: rows.filter(row => row.status === 'Needs Review').length },
          { key: 'Inactive', label: 'Inactive', count: rows.filter(row => row.status === 'Inactive').length }
        ]}
      />

      <StandardFilters
        filters={filters}
        setFilters={setFilters}
        siteOptions={optionsFromRows(rows, ['site'])}
        departmentOptions={optionsFromRows(rows, ['department'])}
        statusOptions={optionsFromRows(rows, ['status'])}
      />

      <section className="overflow-hidden rounded-2xl border border-[var(--app-line)] bg-white shadow-[0_8px_24px_rgba(32,55,45,.06)]">
        {visibleRows.length ? (
          <DataTable
            rows={visibleRows}
            rowKey="meterId"
            onRowClick={open}
            pagination
            columns={[
              { key: 'meterId', label: 'Meter ID', render: value => <strong className="mono">{value}</strong> },
              { key: 'asset', label: 'Asset' },
              { key: 'location', label: 'Location' },
              { key: 'site', label: 'Site' },
              { key: 'department', label: 'Department' },
              { key: 'meterType', label: 'Type' },
              { key: 'reading', label: 'Reading', render: (value, row) => <strong>{value} {row.unit}</strong> },
              { key: 'readingDate', label: 'Reading Date' },
              { key: 'status', label: 'Status', render: value => <Badge tone={value === 'Active' ? 'green' : 'orange'}>{value}</Badge> }
            ]}
          />
        ) : (
          <EmptyState icon={Gauge} title="No meter readings found" description="Add a reading or reset the standard filters to continue testing the Meters module." />
        )}
      </section>

      {modalOpen && (
        <MasterRecordModal
          title="Add meter reading"
          note="Create a standalone meter reading record for testing and reporting."
          fields={fields}
          form={form}
          setForm={setForm}
          onClose={() => setModalOpen(false)}
          onSave={save}
          submitLabel="Create reading"
        />
      )}
    </>
  )
}

import { useState } from 'react'
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
import { applyStandardFilters, emptyStandardFilters, optionsFromRows } from '../lib/standardFilters'

const emptyMeter = {
  meterId: '',
  asset: '',
  location: '',
  site: '1031',
  department: '',
  meterType: 'General',
  reading: '',
  unit: '',
  readingDate: new Date().toISOString().slice(0, 10),
  status: 'Active'
}

const templateHeaders = Object.keys(emptyMeter)
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

const seedMeters = (assets = [], workOrders = []) => {
  const assetMeters = assets.slice(0, 6).map((asset, index) => ({
    meterId: `MTR-${String(index + 1).padStart(4, '0')}`,
    asset: asset.assetnum,
    location: asset.location,
    site: String(asset.site || '1031'),
    department: asset.department || asset['sub department'] || 'Facilities',
    meterType: index % 2 ? 'Water' : 'Energy',
    reading: String(1200 + index * 145),
    unit: index % 2 ? 'm³' : 'kWh',
    readingDate: `2026-07-${String(10 + index).padStart(2, '0')}`,
    status: 'Active'
  }))
  const workOrderMeters = workOrders
    .filter(order => order['METER READING'])
    .map((order, index) => ({
      meterId: `WO-MTR-${order.WORKORDER || index + 1}`,
      asset: order.ASSET || '',
      location: order['LOCATION '] || '',
      site: String(order.SITE || ''),
      department: order['DEPARTMENT '] || '',
      meterType: 'General',
      reading: order['METER READING'],
      unit: '',
      readingDate: order['METER READING DATE'] || '',
      status: 'Active'
    }))
  return [...assetMeters, ...workOrderMeters]
}

export default function MetersPage({ assets = [], workOrders = [] }) {
  const [rows, setRows] = useState(() => seedMeters(assets, workOrders))
  const [tab, setTab] = useState('All')
  const [filters, setFilters] = useState(emptyStandardFilters)
  const [imported, setImported] = useState('')
  const [modalOpen, setModalOpen] = useState(false)
  const [form, setForm] = useState(emptyMeter)
  const routeId = decodeURIComponent(window.location.pathname.split('/meters/')[1] || '')
  const [selected, setSelected] = useState(rows.find(row => row.meterId === routeId) || null)

  const tabRows = tab === 'All' ? rows : rows.filter(row => row.status === tab)
  const visibleRows = applyStandardFilters(tabRows, filters, { date: ['readingDate'] })

  const save = () => {
    if (!form.meterId || !form.asset || !form.reading) return
    setRows(current => [{ ...form }, ...current])
    setForm(emptyMeter)
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
    setRows(current => current.map(row => row.meterId === meterId ? { ...row, ...patch } : row))
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
        readingDate: date.toISOString().slice(0, 10),
        source: 'Historical mock',
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
            <Button onClick={() => setModalOpen(true)}><Plus size={17} />Add meter reading</Button>
          </div>
        )}
      />

      <ImportNotice fileName={imported} subject="meter readings" onClear={() => setImported('')} />

      <IndexTabs
        active={tab}
        onChange={value => { setTab(value); setFilters(emptyStandardFilters) }}
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

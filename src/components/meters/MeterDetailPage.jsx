import { useState } from 'react'
import Combobox from '../ui/Combobox'
import { Activity, CalendarClock, Gauge, MapPin, RadioTower } from 'lucide-react'
import Badge from '../ui/Badge'
import DataTable from '../ui/DataTable'
import EmptyState from '../ui/EmptyState'
import { DetailHeader, DetailTabs, InfoCard } from '../ui/DetailScaffold'
import GenericPrintReport from '../ui/GenericPrintReport'

const meterStatuses = ['Active', 'Inactive', 'Needs Review']
const toneByStatus = {
  Active: 'green',
  Inactive: 'default',
  'Needs Review': 'orange',
  Posted: 'green'
}

export default function MeterDetailPage({ meter, pastReadings = [], onBack, onUpdate }) {
  const [tab, setTab] = useState('Meter Details')
  const changeStatus = event => onUpdate?.(meter.meterId, { status: event.target.value })
  const latestReading = `${meter.reading || '-'} ${meter.unit || ''}`.trim()

  return (
    <section className="printable-record">
      <div className="print-report-screen space-y-5">
        <DetailHeader
          eyebrow="METER MANAGEMENT"
          id={meter.meterId}
          title={`${meter.meterType} meter for ${meter.asset || meter.location}`}
          status={meter.status}
          statusTone={toneByStatus[meter.status] || 'green'}
          onBack={onBack}
          backLabel="Back to meters"
          stats={[
            { label: 'Asset', value: meter.asset },
            { label: 'Location', value: meter.location },
            { label: 'Latest Reading', value: latestReading },
            { label: 'Reading Date', value: meter.readingDate }
          ]}
          actions={(
            <div className="min-w-[160px]">
              <Combobox
                picker
                className="h-10 w-full rounded-xl border border-[var(--app-line)] bg-[var(--app-panel)] px-3 text-xs font-extrabold text-[var(--app-ink)] outline-none transition hover:bg-[var(--app-soft-bg)] focus:border-[var(--app-primary)] focus:ring-4 focus:ring-[var(--app-field-focus-ring)]"
                value={meter.status}
                suggestions={meterStatuses}
                onChange={changeStatus}
                placeholder="Status"
              />
            </div>
          )}
        />

        <DetailTabs tabs={['Meter Details', 'Past Readings']} active={tab} onChange={setTab} />

        {tab === 'Meter Details' && (
          <main className="space-y-4">
            <section className="grid gap-3 md:grid-cols-4">
              {[
                { icon: Gauge, label: 'Latest Reading', value: latestReading, note: meter.readingDate || 'No date' },
                { icon: RadioTower, label: 'Meter Type', value: meter.meterType, note: meter.unit || 'No unit' },
                { icon: MapPin, label: 'Site', value: meter.site, note: meter.location || 'No location' },
                { icon: Activity, label: 'Status', value: meter.status, note: 'Control state' }
              ].map(metric => {
                const Icon = metric.icon
                return (
                  <div key={metric.label} className="rounded-2xl border border-[var(--app-line)] bg-[var(--app-panel)] p-4 shadow-[0_8px_24px_rgba(32,55,45,.05)]">
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-[9px] font-extrabold uppercase tracking-[.14em] text-[var(--app-muted)]">{metric.label}</span>
                      <Icon size={16} className="text-[var(--app-primary)]" />
                    </div>
                    <strong className="mt-2 block text-2xl font-extrabold tracking-[-.04em] text-[var(--app-ink)]">{metric.value || '-'}</strong>
                    <small className="text-[11px] font-semibold text-[var(--app-muted)]">{metric.note}</small>
                  </div>
                )
              })}
            </section>

            <section className="grid gap-4 lg:grid-cols-2">
              <InfoCard
                icon={Gauge}
                kicker="METER"
                title="Meter Information"
                items={[
                  ['Meter ID', meter.meterId],
                  ['Meter Type', meter.meterType],
                  ['Reading', latestReading],
                  ['Reading Date', meter.readingDate]
                ]}
              />

              <InfoCard
                icon={MapPin}
                kicker="CONTEXT"
                title="Asset & Location"
                items={[
                  ['Asset', meter.asset],
                  ['Location', meter.location],
                  ['Site', meter.site],
                  ['Department', meter.department],
                  ['Status', meter.status],
                  ['Unit', meter.unit]
                ]}
              />
            </section>
          </main>
        )}

        {tab === 'Past Readings' && (
          <section className="overflow-hidden rounded-2xl border border-[var(--app-line)] bg-[var(--app-table-bg)] shadow-[0_8px_24px_rgba(32,55,45,.06)]">
            {pastReadings.length ? (
              <DataTable
                rows={pastReadings}
                rowKey="readingId"
                pagination
                columns={[
                  { key: 'readingDate', label: 'Reading Date' },
                  { key: 'reading', label: 'Reading', render: (value, row) => <strong className="text-[var(--app-ink)]">{value} {row.unit}</strong> },
                  { key: 'source', label: 'Source' },
                  { key: 'workOrder', label: 'Work Order' },
                  { key: 'status', label: 'Status', render: value => <Badge tone={toneByStatus[value] || 'orange'}>{value}</Badge> }
                ]}
              />
            ) : (
              <EmptyState
                icon={CalendarClock}
                title="No past readings yet"
                description="Previous meter readings for this asset or meter will appear here."
              />
            )}
          </section>
        )}
      </div>

      <GenericPrintReport
        reportTitle="Meter Report"
        reportSubtitle="Meter reading report"
        number={meter.meterId}
        status={meter.status}
        description={`${meter.meterType} meter for ${meter.asset || meter.location}`}
        summary={[['Asset', meter.asset], ['Location', meter.location], ['Latest Reading', latestReading]]}
        sections={[
          { title: 'Meter Information', rows: [[['Meter ID', meter.meterId], ['Type', meter.meterType], ['Reading', latestReading], ['Reading Date', meter.readingDate]]] },
          { title: 'Asset and Location', rows: [[['Asset', meter.asset], ['Location', meter.location], ['Site', meter.site], ['Department', meter.department]]] }
        ]}
      />
    </section>
  )
}

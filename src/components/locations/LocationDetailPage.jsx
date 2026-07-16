import { useState } from 'react'
import { Boxes, Building2, ClipboardList, Layers, MapPin } from 'lucide-react'
import Badge from '../ui/Badge'
import DataTable from '../ui/DataTable'
import EmptyState from '../ui/EmptyState'
import { DetailHeader, DetailTabs, InfoCard } from '../ui/DetailScaffold'
import GenericPrintReport from '../ui/GenericPrintReport'
import { statusDescription, statusTone } from '../../lib/statusMatrix'

const locationStatuses = ['OPERATING', 'PLANNED', 'DECOMMISSIONED']

export default function LocationDetailPage({ location, assets = [], workOrders = [], onBack, onUpdate }) {
  const [tab, setTab] = useState('Location Details')
  const changeStatus = event => onUpdate?.(location.location, { status: event.target.value })

  return (
    <section className="printable-record">
      <div className="print-report-screen space-y-5">
        <DetailHeader
          eyebrow="LOCATION MASTER"
          id={location.location}
          title={location.description}
          status={location.status}
          statusTone={statusTone(location.status)}
          onBack={onBack}
          backLabel="Back to locations"
          stats={[
            { label: 'Site', value: location.site },
            { label: 'Type', value: location.type },
            { label: 'Priority', value: location.priority },
            { label: 'Building', value: location.builiding }
          ]}
          actions={(
            <select
              value={location.status}
              onChange={changeStatus}
              className="h-10 min-w-[180px] rounded-xl border border-[var(--app-line)] bg-[var(--app-panel)] px-3 text-xs font-extrabold text-[var(--app-ink)] outline-none transition hover:bg-[var(--app-soft-bg)] focus:border-[var(--app-primary)] focus:ring-4 focus:ring-[var(--app-field-focus-ring)]"
              aria-label="Change location status"
            >
              {locationStatuses.map(status => <option key={status} value={status}>{status}</option>)}
            </select>
          )}
        />

        <DetailTabs tabs={['Location Details', 'Assets', 'Work Orders']} active={tab} onChange={setTab} />

        {tab === 'Location Details' && (
          <main className="space-y-4">
            <section className="grid gap-3 md:grid-cols-4">
              {[
                { icon: MapPin, label: 'Priority', value: location.priority, note: location['priority  description'] || 'Standard' },
                { icon: Building2, label: 'Building', value: location.builiding, note: location['builiding category'] || 'No category' },
                { icon: Boxes, label: 'Assets', value: assets.length, note: 'Installed assets' },
                { icon: ClipboardList, label: 'Work Orders', value: workOrders.length, note: 'Related records' }
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
                icon={MapPin}
                kicker="LOCATION"
                title="Location Information"
                items={[
                  ['Location', location.location],
                  ['Description', location.description],
                  ['Type', location.type],
                  ['Status', `${location.status} · ${statusDescription('location', location.status)}`]
                ]}
              />

              <InfoCard
                icon={Layers}
                kicker="HIERARCHY"
                title="Site & Building"
                items={[
                  ['Site', location.site],
                  ['Building', location.builiding],
                  ['Building Category', location['builiding category']],
                  ['Priority', location.priority],
                  ['Priority Description', location['priority  description']],
                  ['Department', location.department]
                ]}
              />
            </section>
          </main>
        )}

        {tab === 'Assets' && (
          <section className="overflow-hidden rounded-2xl border border-[var(--app-line)] bg-[var(--app-table-bg)] shadow-[0_8px_24px_rgba(32,55,45,.06)]">
            {assets.length ? (
              <DataTable
                rows={assets}
                rowKey="assetnum"
                pagination
                columns={[
                  { key: 'assetnum', label: 'Asset', render: value => <strong className="mono text-[var(--app-ink)]">{value}</strong> },
                  { key: 'description', label: 'Description' },
                  { key: 'department', label: 'Department' },
                  { key: 'site', label: 'Site' },
                  { key: 'status', label: 'Status', render: value => <Badge tone={statusTone(value)}>{value}</Badge> }
                ]}
              />
            ) : (
              <EmptyState icon={Boxes} title="No assets at this location" description="Assets installed at this location will appear here." />
            )}
          </section>
        )}

        {tab === 'Work Orders' && (
          <section className="overflow-hidden rounded-2xl border border-[var(--app-line)] bg-[var(--app-table-bg)] shadow-[0_8px_24px_rgba(32,55,45,.06)]">
            {workOrders.length ? (
              <DataTable
                rows={workOrders}
                rowKey="workOrder"
                pagination
                columns={[
                  { key: 'workOrder', label: 'Work Order', render: value => <strong className="mono text-[var(--app-ink)]">{value}</strong> },
                  { key: 'description', label: 'Description' },
                  { key: 'workType', label: 'Type' },
                  { key: 'department', label: 'Department' },
                  { key: 'site', label: 'Site' },
                  { key: 'status', label: 'Status', render: value => <Badge tone={statusTone(value)}>{value}</Badge> }
                ]}
              />
            ) : (
              <EmptyState icon={ClipboardList} title="No work orders at this location" description="Corrective or preventive work orders for this location will appear here." />
            )}
          </section>
        )}
      </div>

      <GenericPrintReport
        reportTitle="Location Report"
        reportSubtitle="Location master report"
        number={location.location}
        status={location.status}
        description={location.description}
        summary={[['Site', location.site], ['Type', location.type], ['Priority', location.priority]]}
        sections={[
          { title: 'Location Information', rows: [[['Location', location.location], ['Description', location.description], ['Type', location.type], ['Status', location.status]]] },
          { title: 'Site and Building', rows: [[['Site', location.site], ['Building', location.builiding], ['Building Category', location['builiding category']], ['Department', location.department]]] }
        ]}
      />
    </section>
  )
}

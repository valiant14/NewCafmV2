import { useState } from 'react'
import Combobox from '../ui/Combobox'
import { Boxes, Building2, ClipboardList, Layers, MapPin } from 'lucide-react'
import Badge from '../ui/Badge'
import DataTable from '../ui/DataTable'
import EmptyState from '../ui/EmptyState'
import { DetailHeader, DetailTabs, InfoCard, MetricCard } from '../ui/DetailScaffold'
import TablePanel from '../ui/TablePanel'
import GenericPrintReport from '../ui/GenericPrintReport'
import { statusDescription, statusTone } from '../../lib/statusMatrix'
import useModuleAccess from '../../hooks/useModuleAccess'

const locationStatuses = ['OPERATING', 'PLANNED', 'DECOMMISSIONED']

export default function LocationDetailPage({ location, assets = [], workOrders = [], onBack, onUpdate }) {
  const access = useModuleAccess('Locations')
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
          actions={access.edit ? (
            <div className="min-w-[180px]">
              <Combobox
                picker
                className="h-10 w-full rounded-xl border border-[var(--app-line)] bg-[var(--app-panel)] px-3 text-xs font-extrabold text-[var(--app-ink)] outline-none transition hover:bg-[var(--app-soft-bg)] focus:border-[var(--app-primary)] focus:ring-4 focus:ring-[var(--app-field-focus-ring)]"
                value={location.status}
                suggestions={locationStatuses}
                onChange={changeStatus}
                placeholder="Status"
              />
            </div>
          ) : null}
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
              ].map(metric => <MetricCard key={metric.label} {...metric} />)}
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
          <TablePanel>
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
          </TablePanel>
        )}

        {tab === 'Work Orders' && (
          <TablePanel>
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
          </TablePanel>
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

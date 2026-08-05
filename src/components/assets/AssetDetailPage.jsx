import { useState } from 'react'
import Combobox from '../ui/Combobox'
import { BadgeCheck, Boxes, CalendarClock, ClipboardList, Factory, Tag } from 'lucide-react'
import Badge from '../ui/Badge'
import DataTable from '../ui/DataTable'
import { DetailHeader, DetailTabs, InfoCard, TimelineCard } from '../ui/DetailScaffold'
import TablePanel from '../ui/TablePanel'
import { SurfaceHeader } from '../ui/Surface'
import GenericPrintReport from '../ui/GenericPrintReport'
import { systemLabel } from '../../lib/departments'
import { statusDescription, statusOptions, statusTone as matrixStatusTone } from '../../lib/statusMatrix'
import useModuleAccess from '../../hooks/useModuleAccess'

export default function AssetDetailPage({ asset, workOrders = [], onBack, onUpdate }) {
  const access = useModuleAccess('Assets')
  const [activeTab, setActiveTab] = useState('Asset Details')
  const [status, setStatus] = useState(asset.status || 'OPERATING')
  const assetWorkOrders = workOrders.filter(order => String(order.ASSET || '').trim() === String(asset.assetnum || '').trim())
  const openOrders = assetWorkOrders.filter(order => !['COMP', 'CLOSE', 'CAN'].includes(String(order.STATUS || '').toUpperCase()))
  const statusTone = matrixStatusTone(status)
  const changeStatus = value => {
    setStatus(value)
    onUpdate?.(asset.assetnum, { status: value })
  }

  return (
    <section className="printable-record">
      <div className="print-report-screen space-y-5">
        <DetailHeader
          eyebrow="ASSET MASTER"
          id={asset.assetnum}
          title={asset.description}
          status={`${status} - ${statusDescription('asset', status)}`}
          statusTone={statusTone}
          onBack={onBack}
          backLabel="Back to assets"
          printLabel="Print asset"
          actions={access.edit ? (
            <div className="min-w-[190px]">
              <Combobox
                picker
                className="h-10 w-full rounded-xl border border-[var(--app-line)] bg-[var(--app-panel)] px-3 text-xs font-extrabold text-[var(--app-ink)] outline-none transition hover:bg-[var(--app-soft-bg)] focus:border-[var(--app-primary)] focus:ring-4 focus:ring-[var(--app-field-focus-ring)]"
                value={status}
                suggestions={statusOptions('asset').map(option => ({ value: option, label: statusDescription('asset', option) }))}
                onChange={event => changeStatus(event.target.value)}
                placeholder="Status"
              />
            </div>
          ) : null}
          stats={[
            { label: 'Site / Location', value: asset.site || '-', note: asset.location || 'Location not set' },
            { label: 'Department', value: asset.department || 'Not configured', note: asset['sub department'] || 'No sub department' },
            { label: 'System', value: asset.system || 'Not assigned', note: systemLabel(asset.system) || 'No system code' },
            { label: 'Open Work Orders', value: openOrders.length, note: `${assetWorkOrders.length} total linked` },
            { label: 'Priority', value: asset.prioity || '-', note: 'Asset criticality' }
          ]}
        />

        <DetailTabs tabs={['Asset Details', 'Work Orders']} active={activeTab} onChange={setActiveTab} />

        {activeTab === 'Asset Details' && <main className="grid gap-5 lg:grid-cols-2">
          <InfoCard
            icon={Boxes}
            kicker="IDENTITY"
            title="Asset Information"
            items={[
              ['Asset Number', asset.assetnum],
              ['Description', asset.description],
              ['Short Name', asset['asset short name']],
              ['Parent Asset', asset.parent]
            ]}
          />

          <InfoCard
            icon={Factory}
            kicker="TECHNICAL"
            title="Model & Serial"
            items={[
              ['Model Number', asset.modelnum],
              ['Serial Number', asset.serialnum],
              ['Install Date', asset.installdate],
              ['Quantity', asset.quantity]
            ]}
          />

          <TimelineCard
            icon={CalendarClock}
            kicker="MAINTENANCE CONTEXT"
            title="Asset Usage"
            rows={[
              { icon: BadgeCheck, text: 'Available for Job Requests and Work Orders.', value: asset.assetnum },
              { icon: ClipboardList, text: 'Open maintenance activity linked to this asset.', value: `${openOrders.length} open` },
              { icon: Tag, text: 'Operational status from asset master.', value: status }
            ]}
          />

        </main>}

        {activeTab === 'Work Orders' && <TablePanel>
            <SurfaceHeader eyebrow="Linked work" title="Work Orders" actions={<Badge tone={openOrders.length ? 'orange' : 'green'}>{openOrders.length} open</Badge>} />
            <DataTable
              rows={assetWorkOrders}
              rowKey="WORKORDER"
              pageSize={5}
              showFooter={false}
              columns={[
                { key: 'WORKORDER', label: 'WO Number', render: value => <strong className="mono">{value}</strong> },
                { key: 'DESCRIPITION ', label: 'Description' },
                { key: 'STATUS', label: 'Status', render: value => <Badge tone={['COMP', 'CLOSE'].includes(value) ? 'green' : 'orange'}>{value || '-'}</Badge> },
                { key: 'WORK TYPE ', label: 'Type' }
              ]}
            />
          </TablePanel>}
      </div>

      <GenericPrintReport
        reportTitle="Asset Report"
        reportSubtitle="Asset master report"
        number={asset.assetnum}
        status={status || 'UNKNOWN'}
        description={asset.description}
        summary={[['Site', asset.site], ['Location', asset.location], ['Department', asset.department]]}
        sections={[
          { title: 'Asset Information', rows: [[['Asset Number', asset.assetnum], ['Description', asset.description], ['Short Name', asset['asset short name']], ['Parent Asset', asset.parent]]] },
          { title: 'Site Context', rows: [[['Site', asset.site], ['Location', asset.location], ['Department', asset.department], ['Sub Department', asset['sub department']]], [['System', systemLabel(asset.system)]]] },
          { title: 'Model and Serial', rows: [[['Model Number', asset.modelnum], ['Serial Number', asset.serialnum], ['Install Date', asset.installdate], ['Quantity', asset.quantity]]] }
        ]}
        tables={[{
          title: 'Linked Work Orders',
          columns: [
            { key: 'WORKORDER', label: 'WO Number' },
            { key: 'DESCRIPITION ', label: 'Description' },
            { key: 'STATUS', label: 'Status' },
            { key: 'WORK TYPE ', label: 'Type' }
          ],
          rows: assetWorkOrders,
          emptyText: 'No work orders linked to this asset.'
        }]}
      />
    </section>
  )
}

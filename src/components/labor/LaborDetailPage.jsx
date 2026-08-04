import { useState } from 'react'
import Combobox from '../ui/Combobox'
import { BriefcaseBusiness, CheckCircle2, Clock3, ShieldCheck, UserRound, Wrench } from 'lucide-react'
import { DetailHeader, DetailTabs, InfoCard, MetricCard } from '../ui/DetailScaffold'
import TablePanel from '../ui/TablePanel'
import Badge from '../ui/Badge'
import DataTable from '../ui/DataTable'
import EmptyState from '../ui/EmptyState'
import GenericPrintReport from '../ui/GenericPrintReport'
import { statusTone } from '../../lib/statusMatrix'

const toneByStatus = {
  Available: 'green',
  Assigned: 'orange',
  'On Leave': 'orange'
}

const laborStatuses = ['Available', 'Assigned', 'On Leave']

export default function LaborDetailPage({ labor, pastWork = [], onBack, onUpdate }) {
  const [tab, setTab] = useState('Labor Details')
  const closedStatuses = new Set(['COMP', 'COMPLETED', 'CLOSE', 'CLOSED', 'CAN', 'CANCELLED'])
  const completedWork = pastWork.filter(row => closedStatuses.has(String(row.status || '').toUpperCase()))
  const openWork = pastWork.length - completedWork.length
  const recordedHours = pastWork.reduce((total, row) => {
    const hours = Number(row['ACTUAL HOURS'] ?? row.actualHours ?? row.actual_hours ?? 0)
    return total + (Number.isFinite(hours) ? hours : 0)
  }, 0)
  const nextAssignment = labor.availability === 'On Leave'
    ? 'Unavailable'
    : openWork > 0
      ? 'Active work queue'
      : 'Ready for dispatch'
  const availabilityTone = toneByStatus[labor.availability] || 'green'
  const changeStatus = event => onUpdate?.(labor.personId, { availability: event.target.value })

  return (
    <section className="printable-record">
      <div className="print-report-screen space-y-5">
        <DetailHeader
          eyebrow="LABOR RESOURCE"
          id={labor.personId}
          title={`${labor.name} - ${labor.craft}`}
          status={labor.availability}
          statusTone={availabilityTone}
          onBack={onBack}
          backLabel="Back to labor"
          stats={[
            { label: 'Craft Code', value: labor.craftCode },
            { label: 'Department', value: labor.department },
            { label: 'Shift', value: labor.shift },
            { label: 'Next Action', value: nextAssignment }
          ]}
          actions={(
            <div className="min-w-[150px]">
              <Combobox
                picker
                className="h-10 w-full rounded-xl border border-[var(--app-line)] bg-[var(--app-panel)] px-3 text-xs font-extrabold text-[var(--app-ink)] outline-none transition hover:bg-[var(--app-soft-bg)] focus:border-[var(--app-primary)] focus:ring-4 focus:ring-[var(--app-field-focus-ring)]"
                value={labor.availability}
                suggestions={laborStatuses}
                onChange={changeStatus}
                placeholder="Status"
              />
            </div>
          )}
        />

        <DetailTabs tabs={['Labor Details', 'Past Work']} active={tab} onChange={setTab} />

        {tab === 'Labor Details' && <main className="space-y-4">
          <section className="grid gap-3 md:grid-cols-4">
            {[
              { icon: BriefcaseBusiness, label: 'Open Work', value: openWork, note: 'Current queue' },
              { icon: Clock3, label: 'Recorded Hours', value: recordedHours, note: 'From work orders' },
              { icon: CheckCircle2, label: 'Completed Work', value: completedWork.length, note: 'Work-order history' },
              { icon: ShieldCheck, label: 'Availability', value: labor.availability, note: nextAssignment }
            ].map(metric => <MetricCard key={metric.label} {...metric} />)}
          </section>

          <section className="grid gap-4 lg:grid-cols-2">
            <InfoCard
              icon={UserRound}
              kicker="IDENTITY"
              title="Labor Information"
              items={[
                ['Name', labor.name],
                ['Person ID', labor.personId],
                ['Shift', labor.shift],
                ['Availability', labor.availability]
              ]}
            />

            <InfoCard
              icon={Wrench}
              kicker="QUALIFICATION"
              title="Craft & Responsibility"
              items={[
                ['Craft Code', labor.craftCode],
                ['Craft', labor.craft],
                ['Department', labor.department],
                ['Sub Department', labor.subDepartment]
              ]}
            />
          </section>
        </main>}

        {tab === 'Past Work' && (
          <TablePanel>
            {pastWork.length ? (
              <DataTable
                rows={pastWork}
                rowKey="reference"
                pagination
                columns={[
                  { key: 'reference', label: 'Work Order', render: value => <strong className="mono text-[var(--app-ink)]">{value}</strong> },
                  { key: 'description', label: 'Description' },
                  { key: 'workType', label: 'Type' },
                  { key: 'department', label: 'Department' },
                  { key: 'site', label: 'Site' },
                  { key: 'targetFinish', label: 'Target / Finish' },
                  { key: 'status', label: 'Status', render: value => <Badge tone={statusTone(value)}>{value}</Badge> }
                ]}
              />
            ) : (
              <EmptyState
                icon={BriefcaseBusiness}
                title="No past work found"
                description="Completed or attended Work Orders will appear here once this labor resource is assigned or recorded in actuals."
              />
            )}
          </TablePanel>
        )}
      </div>
      <GenericPrintReport
        reportTitle="Labor Report"
        reportSubtitle="Labor resource report"
        number={labor.personId}
        status={labor.availability}
        description={`${labor.name} - ${labor.craft}`}
        summary={[['Department', labor.department], ['Craft Code', labor.craftCode], ['Shift', labor.shift]]}
        sections={[
          { title: 'Labor Information', rows: [[['Name', labor.name], ['Person ID', labor.personId], ['Shift', labor.shift], ['Availability', labor.availability]]] },
          { title: 'Craft and Responsibility', rows: [[['Craft Code', labor.craftCode], ['Craft', labor.craft], ['Department', labor.department], ['Sub Department', labor.subDepartment]]] },
          { title: 'Workload Context', rows: [[['Open Work', openWork], ['Recorded Hours', recordedHours], ['Completed Work', completedWork.length], ['Next Action', nextAssignment]]] }
        ]}
      />
    </section>
  )
}

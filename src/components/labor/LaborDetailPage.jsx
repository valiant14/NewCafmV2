import { useState } from 'react'
import { Activity, BriefcaseBusiness, Clock3, ShieldCheck, UserRound, Wrench } from 'lucide-react'
import { DetailHeader, DetailTabs, InfoCard } from '../ui/DetailScaffold'
import Badge from '../ui/Badge'
import DataTable from '../ui/DataTable'
import EmptyState from '../ui/EmptyState'
import GenericPrintReport from '../ui/GenericPrintReport'
import { statusTone } from '../../lib/statusMatrix'

const workloadByStatus = {
  Available: { openWork: 1, weekHours: 14, utilization: 42, nextAssignment: 'Ready for dispatch' },
  Assigned: { openWork: 3, weekHours: 31, utilization: 78, nextAssignment: 'Active work queue' },
  'On Leave': { openWork: 0, weekHours: 0, utilization: 0, nextAssignment: 'Unavailable' }
}

const toneByStatus = {
  Available: 'green',
  Assigned: 'orange',
  'On Leave': 'orange'
}

const laborStatuses = ['Available', 'Assigned', 'On Leave']

export default function LaborDetailPage({ labor, pastWork = [], onBack, onUpdate }) {
  const [tab, setTab] = useState('Labor Details')
  const workload = workloadByStatus[labor.availability] || workloadByStatus.Available
  const availabilityTone = toneByStatus[labor.availability] || 'green'
  const changeStatus = event => onUpdate?.(labor.personId, { availability: event.target.value })

  return (
    <section className="printable-record">
      <div className="print-report-screen space-y-5">
        <DetailHeader
          eyebrow="LABOR RESOURCE"
          id={labor.personId}
          title={`${labor.name} · ${labor.craft}`}
          status={labor.availability}
          statusTone={availabilityTone}
          onBack={onBack}
          backLabel="Back to labor"
          stats={[
            { label: 'Craft Code', value: labor.craftCode },
            { label: 'Department', value: labor.department },
            { label: 'Shift', value: labor.shift },
            { label: 'Next Action', value: workload.nextAssignment }
          ]}
          actions={(
            <label className="flex items-center gap-2 rounded-xl border border-[var(--app-line)] bg-[var(--app-panel)] px-3 py-2 text-xs font-bold text-[var(--app-muted)]">
              Status
              <select
                value={labor.availability}
                onChange={changeStatus}
                className="min-w-[140px] rounded-xl border border-[var(--app-line)] bg-[var(--app-panel)] px-3 py-2 text-xs font-extrabold text-[var(--app-ink)] outline-none focus:border-[var(--app-primary)]"
              >
                {laborStatuses.map(status => <option key={status} value={status}>{status}</option>)}
              </select>
            </label>
          )}
        />

        <DetailTabs tabs={['Labor Details', 'Past Work']} active={tab} onChange={setTab} />

        {tab === 'Labor Details' && <main className="space-y-4">
          <section className="grid gap-3 md:grid-cols-4">
            {[
              { icon: BriefcaseBusiness, label: 'Open Work', value: workload.openWork, note: 'Current queue' },
              { icon: Clock3, label: 'Week Hours', value: `${workload.weekHours}h`, note: 'Planned capacity' },
              { icon: Activity, label: 'Utilization', value: `${workload.utilization}%`, note: 'Schedule load' },
              { icon: ShieldCheck, label: 'Availability', value: labor.availability, note: workload.nextAssignment }
            ].map(metric => {
              const Icon = metric.icon
              return (
                <div key={metric.label} className="rounded-2xl border border-[var(--app-line)] bg-[var(--app-panel)] p-4 shadow-[0_8px_24px_rgba(32,55,45,.05)]">
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-[9px] font-extrabold uppercase tracking-[.14em] text-[var(--app-muted)]">{metric.label}</span>
                    <Icon size={16} className="text-[var(--app-primary)]" />
                  </div>
                  <strong className="mt-2 block text-2xl font-extrabold tracking-[-.04em] text-[var(--app-ink)]">{metric.value}</strong>
                  <small className="text-[11px] font-semibold text-[var(--app-muted)]">{metric.note}</small>
                </div>
              )
            })}
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
          <section className="overflow-hidden rounded-2xl border border-[var(--app-line)] bg-[var(--app-table-bg)] shadow-[0_8px_24px_rgba(32,55,45,.06)]">
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
          </section>
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
          { title: 'Workload Context', rows: [[['Open Work', workload.openWork], ['Week Hours', `${workload.weekHours}h`], ['Utilization', `${workload.utilization}%`], ['Next Action', workload.nextAssignment]]] }
        ]}
      />
    </section>
  )
}

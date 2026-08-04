import { useState } from 'react'
import Combobox from '../ui/Combobox'
import { CalendarClock, ClipboardList, ListChecks, TimerReset, Wrench } from 'lucide-react'
import Badge from '../ui/Badge'
import DataTable from '../ui/DataTable'
import EmptyState from '../ui/EmptyState'
import { DetailHeader, DetailTabs, InfoCard } from '../ui/DetailScaffold'
import GenericPrintReport from '../ui/GenericPrintReport'
import { statusDescription, statusTone } from '../../lib/statusMatrix'

const jobPlanStatuses = ['DRAFT', 'ACTIVE', 'INACTIVE']
const minutesFromExcelHours = value => Math.max(1, Math.round(Number(value || 0) * 1440))

export default function JobPlanDetailPage({ plan, tasks = [], workOrders = [], onBack, onUpdate }) {
  const [tab, setTab] = useState('Job Plan Details')
  const status = plan.status || plan.STATUS || 'ACTIVE'
  const totalMinutes = tasks.reduce((sum, task) => sum + minutesFromExcelHours(task['TASK DURATION IN HOUR']), 0)
  const changeStatus = event => onUpdate?.(plan.JPNUM, { status: event.target.value })

  return (
    <section className="printable-record">
      <div className="print-report-screen space-y-5">
        <DetailHeader
          eyebrow="JOB PLAN"
          id={plan.JPNUM}
          title={plan.DESCRIPTION}
          status={status}
          statusTone={statusTone(status)}
          onBack={onBack}
          backLabel="Back to job plans"
          stats={[
            { label: 'Tasks', value: tasks.length },
            { label: 'Estimated Duration', value: `${totalMinutes} min` },
            { label: 'Used by WOs', value: workOrders.length },
            { label: 'Status', value: statusDescription('jobPlan', status) }
          ]}
          actions={(
            <div className="min-w-[150px]">
              <Combobox
                picker
                className="h-10 w-full rounded-xl border border-[var(--app-line)] bg-[var(--app-panel)] px-3 text-xs font-extrabold text-[var(--app-ink)] outline-none transition hover:bg-[var(--app-soft-bg)] focus:border-[var(--app-primary)] focus:ring-4 focus:ring-[var(--app-field-focus-ring)]"
                value={status}
                suggestions={jobPlanStatuses}
                onChange={changeStatus}
                placeholder="Status"
              />
            </div>
          )}
        />

        <DetailTabs tabs={['Job Plan Details', 'Tasks', 'Work Orders']} active={tab} onChange={setTab} />

        {tab === 'Job Plan Details' && (
          <main className="space-y-4">
            <section className="grid gap-3 md:grid-cols-4">
              {[
                { icon: ListChecks, label: 'Tasks', value: tasks.length, note: 'Full task list' },
                { icon: TimerReset, label: 'Duration', value: `${totalMinutes} min`, note: 'From task lines' },
                { icon: ClipboardList, label: 'Work Orders', value: workOrders.length, note: 'Linked usage' },
                { icon: Wrench, label: 'Status', value: status, note: statusDescription('jobPlan', status) }
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

            <InfoCard
              icon={Wrench}
              kicker="PLAN"
              title="Job Plan Information"
              items={[
                ['Job Plan', plan.JPNUM],
                ['Description', plan.DESCRIPTION],
                ['Status', `${status} · ${statusDescription('jobPlan', status)}`],
                ['Estimated Duration', `${totalMinutes} minutes`],
                ['Task Count', tasks.length],
                ['Linked Work Orders', workOrders.length]
              ]}
            />
          </main>
        )}

        {tab === 'Tasks' && (
          <section className="overflow-hidden rounded-2xl border border-[var(--app-line)] bg-[var(--app-table-bg)] shadow-[0_8px_24px_rgba(32,55,45,.06)]">
            {tasks.length ? (
              <DataTable
                rows={tasks}
                rowKey="JOBTASKID"
                pagination
                columns={[
                  { key: 'JOB TASK SEQUENCE', label: 'Sequence' },
                  { key: 'JOBTASKID', label: 'Task ID', render: value => <strong className="mono text-[var(--app-ink)]">{value}</strong> },
                  { key: 'JOB TASK DESCRIPTION', label: 'Task Description' },
                  { key: 'TASK DURATION IN HOUR', label: 'Duration', render: value => `${minutesFromExcelHours(value)} min` }
                ]}
              />
            ) : (
              <EmptyState icon={ListChecks} title="No tasks configured" description="Task lines linked to this Job Plan will appear here." />
            )}
          </section>
        )}

        {tab === 'Work Orders' && (
          <section className="overflow-hidden rounded-2xl border border-[var(--app-line)] bg-[var(--app-table-bg)] shadow-[0_8px_24px_rgba(32,55,45,.06)]">
            {workOrders.length ? (
              <DataTable
                rows={workOrders}
                rowKey="WORKORDER"
                pagination
                columns={[
                  { key: 'WORKORDER', label: 'Work Order', render: value => <strong className="mono text-[var(--app-ink)]">{value}</strong> },
                  { key: 'DESCRIPITION ', label: 'Description' },
                  { key: 'WORK TYPE ', label: 'Type' },
                  { key: 'DEPARTMENT ', label: 'Department' },
                  { key: 'SITE', label: 'Site' },
                  { key: 'STATUS', label: 'Status', render: value => <Badge tone={statusTone(value)}>{value}</Badge> }
                ]}
              />
            ) : (
              <EmptyState icon={CalendarClock} title="No work orders linked" description="Generated PM or CM work orders using this Job Plan will appear here." />
            )}
          </section>
        )}
      </div>

      <GenericPrintReport
        reportTitle="Job Plan Report"
        reportSubtitle="Job plan and task report"
        number={plan.JPNUM}
        status={status}
        description={plan.DESCRIPTION}
        summary={[['Tasks', tasks.length], ['Duration', `${totalMinutes} min`], ['Linked Work Orders', workOrders.length]]}
        sections={[
          { title: 'Job Plan Information', rows: [[['Job Plan', plan.JPNUM], ['Description', plan.DESCRIPTION], ['Status', status], ['Estimated Duration', `${totalMinutes} minutes`]]] }
        ]}
        tables={[{
          title: 'Task Summary',
          columns: [
            { key: 'sequence', label: 'Seq.' },
            { key: 'taskId', label: 'Task ID' },
            { key: 'description', label: 'Task Description' },
            { key: 'duration', label: 'Duration' }
          ],
          rows: tasks.map(task => ({
            key: task.JOBTASKID,
            sequence: task['JOB TASK SEQUENCE'],
            taskId: task.JOBTASKID,
            description: task['JOB TASK DESCRIPTION'],
            duration: `${minutesFromExcelHours(task['TASK DURATION IN HOUR'])} min`
          })),
          emptyText: 'No task lines configured for this job plan.'
        }]}
      />
    </section>
  )
}

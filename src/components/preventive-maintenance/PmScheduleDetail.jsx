import { useState } from 'react'
import { CalendarClock, ChevronRight, FileSpreadsheet, Settings2, Sparkles } from 'lucide-react'
import Badge from '../ui/Badge'
import { DetailHeader, DetailTabs, InfoCard, ProfileStrip } from '../ui/DetailScaffold'
import GenericPrintReport from '../ui/GenericPrintReport'
import { statusDescription, statusTone } from '../../lib/statusMatrix'

const normalize = value => String(value || '').trim()

export default function PmScheduleDetail({ plan, assets, jobTasks, jobPlans, workOrders, onBack, onOpenWorkOrder }) {
  const generatedTab = 'Generated Work Orders'
  const [activeTab, setActiveTab] = useState('PM Details')
  const asset = assets.find(item => normalize(item.assetnum) === normalize(plan.asset))
  const linkedPlan = jobPlans.find(item => normalize(item.number) === normalize(plan.jobPlan))
  const tasks = jobTasks.filter(task => normalize(task.JPNUM) === normalize(plan.jobPlan))
  const history = workOrders.filter(order => normalize(order['PM NUMBER']) === normalize(plan.pmNumber))

  const scheduleItems = [
    ['PM Number', plan.pmNumber],
    ['Next Date', plan.startDate],
    ['Frequency', `${plan.frequency} ${plan.freqUnit}`],
    ['Lead Time', `${plan.leadTime} days`],
    ['Work Type', plan.workType],
    ['WO Status', `${plan.woStatus} · ${statusDescription('workOrder', plan.woStatus)}`],
    ['PM Counter', plan.pmCounter],
    ['Last Generated Cycle', plan.lastGeneratedCycle || 'Not generated']
  ]

  return (
    <section className="printable-record">
      <div className="print-report-screen space-y-5">
        <DetailHeader
          eyebrow={`PREVENTIVE MAINTENANCE · ${plan.workType}`}
          id={plan.pmNumber}
          title={plan.description}
          status={`${plan.pmStatus} · ${statusDescription('preventiveMaintenance', plan.pmStatus)}`}
          statusTone={statusTone(plan.pmStatus)}
          onBack={onBack}
          backLabel="All PM Schedules"
          printLabel="Print PM"
        />

        <ProfileStrip
          icon={CalendarClock}
          eyebrow="PM Generation Rule"
          title={`${plan.frequency} ${plan.freqUnit}`}
          description={`Next due ${plan.startDate} · Lead ${plan.leadTime} days · WO default ${plan.woStatus}`}
          stats={[
            { label: 'Generated', value: history.length || plan.pmCounter },
            { label: 'Job Plan', value: plan.jobPlan }
          ]}
        />

        <DetailTabs tabs={['PM Details', 'Job Plan', generatedTab]} active={activeTab} onChange={setActiveTab} />

        <div className="grid gap-5 xl:grid-cols-[1fr_360px]">
          <main className="grid content-start gap-5">
            {activeTab === 'PM Details' && (
              <InfoCard
                icon={CalendarClock}
                kicker="SCHEDULE"
                title="Schedule & Generation"
                wide
                items={scheduleItems}
              />
            )}

            {activeTab === 'Job Plan' && (
              <section className="rounded-3xl border border-[var(--app-line)] bg-white p-5 shadow-[0_8px_24px_rgba(32,55,45,.06)]">
                <header className="mb-4 flex items-center gap-3 border-b border-[var(--app-line)] pb-4">
                  <Settings2 className="text-[var(--app-muted)]" size={18} />
                  <div>
                    <span className="text-[9px] font-extrabold uppercase tracking-[.16em] text-[var(--app-muted)]">JOB PLAN</span>
                    <h2 className="text-base font-extrabold text-[var(--app-ink)]">Execution Package</h2>
                    <p className="text-xs text-[var(--app-muted)]">Copied automatically into every generated work order.</p>
                  </div>
                </header>

                <div className="mb-4 grid gap-3 md:grid-cols-2">
                  <div className="rounded-2xl bg-[var(--app-soft-bg)] p-4">
                    <span className="text-[9px] font-extrabold uppercase tracking-[.12em] text-[var(--app-muted)]">JPNUM</span>
                    <strong className="mt-1 block text-[var(--app-ink)]">{plan.jobPlan || '-'}</strong>
                    <small className="text-xs text-[var(--app-muted)]">{linkedPlan?.description || 'Job plan reference from Excel'}</small>
                  </div>
                  <div className="rounded-2xl bg-[var(--app-soft-bg)] p-4">
                    <span className="text-[9px] font-extrabold uppercase tracking-[.12em] text-[var(--app-muted)]">Estimated Duration</span>
                    <strong className="mt-1 block text-[var(--app-ink)]">{linkedPlan ? `${Math.max(1, Math.round(linkedPlan.duration * 10) / 10)} hours` : 'From job plan'}</strong>
                  </div>
                </div>

                <div className="overflow-hidden rounded-2xl border border-[var(--app-line)]">
                  <div className="grid grid-cols-[90px_1fr_100px] bg-[var(--app-table-header-bg)] px-4 py-3 text-[length:var(--app-table-header-font-size)] font-extrabold uppercase tracking-[.12em] text-[var(--app-table-heading)]">
                    <span>Sequence</span>
                    <span>Job task</span>
                    <span>Duration</span>
                  </div>
                  {tasks.length ? tasks.map((task, index) => (
                    <article className="grid grid-cols-[90px_1fr_100px] border-t border-[var(--app-line)] px-4 py-3 text-[length:var(--app-table-font-size)] text-[var(--app-table-text)]" key={`${task.JPNUM}-${task['JOB TASK SEQUENCE']}-${index}`}>
                      <strong>{task['JOB TASK SEQUENCE']}</strong>
                      <span>{task['JOB TASK DESCRIPTION']}</span>
                      <strong>{Math.max(1, Math.round(Number(task['TASK DURATION IN HOUR']) * 1440))} min</strong>
                    </article>
                  )) : (
                    <p className="p-4 text-sm text-[var(--app-muted)]">No task rows found for this job plan.</p>
                  )}
                </div>
              </section>
            )}

            {activeTab === generatedTab && (
              <section className="rounded-3xl border border-[var(--app-line)] bg-white p-5 shadow-[0_8px_24px_rgba(32,55,45,.06)]">
                <header className="mb-4 flex items-center justify-between gap-3 border-b border-[var(--app-line)] pb-4">
                  <div className="flex items-center gap-3">
                    <FileSpreadsheet className="text-[var(--app-muted)]" size={18} />
                    <div>
                      <span className="text-[9px] font-extrabold uppercase tracking-[.16em] text-[var(--app-muted)]">HISTORY</span>
                      <h2 className="text-base font-extrabold text-[var(--app-ink)]">Generated Work Orders</h2>
                      <p className="text-xs text-[var(--app-muted)]">Every work order produced from this PM master.</p>
                    </div>
                  </div>
                  <Badge tone={history.length ? 'green' : 'neutral'}>{history.length} records</Badge>
                </header>

                {history.length ? (
                  <div className="grid gap-2">
                    {history.map(order => (
                      <button
                        type="button"
                        className="grid gap-3 rounded-2xl border border-[var(--app-line)] p-4 text-left text-[var(--app-table-text)] transition hover:bg-[var(--app-soft-bg)] md:grid-cols-[120px_1fr_120px_90px_auto] md:items-center"
                        key={order.WORKORDER}
                        onClick={() => onOpenWorkOrder?.(order.WORKORDER)}
                      >
                        <strong className="mono text-[var(--app-ink)]">{order.WORKORDER}</strong>
                        <span>{order['PM CYCLE'] || '-'}</span>
                        <span>{String(order['TARGET START '] || '-').slice(0, 10)}</span>
                        <Badge tone={['COMP', 'CLOSE'].includes(order.STATUS) ? 'green' : 'neutral'}>{order.STATUS}</Badge>
                        <ChevronRight size={15} />
                      </button>
                    ))}
                  </div>
                ) : (
                  <div className="grid place-items-center rounded-2xl border border-dashed border-[var(--app-line)] p-8 text-center text-[var(--app-muted)]">
                    <CalendarClock />
                    <strong className="mt-2 text-[var(--app-ink)]">No work orders generated yet</strong>
                    <span className="text-sm">Run PM generation from the PM Schedule page. Matching generated WOs will appear here.</span>
                  </div>
                )}
              </section>
            )}
          </main>

          <aside className="grid content-start gap-5">
            <InfoCard icon={Sparkles} kicker="ASSET" title="Asset & Location" items={[['ASSETNUM', plan.asset || 'Location-based PM'], ['Asset Description', asset?.description], ['LOCATION', plan.location || asset?.location || 'From asset'], ['ROUTE', plan.route || 'No route'], ['STORELOC', plan.storeLocation || 'Not specified']]} />
            <InfoCard icon={Settings2} kicker="RESPONSIBILITY" title="Ownership" items={[['PERSONGROUP', plan.personGroup || 'Not assigned'], ['Department', plan.department || 'Not configured'], ['Sub Department', plan.subDepartment || 'Not configured'], ['Supervisor', plan.supervisor || 'Assigned after generation'], ['Lead', plan.lead || 'Not specified']]} />
          </aside>
        </div>
      </div>

      <GenericPrintReport
        reportTitle="PM Schedule Report"
        reportSubtitle="Preventive maintenance master report"
        number={plan.pmNumber}
        status={plan.pmStatus}
        description={plan.description}
        summary={[['Frequency', `${plan.frequency} ${plan.freqUnit}`], ['Job Plan', plan.jobPlan], ['Next Date', plan.startDate]]}
        sections={[
          { title: 'Schedule and Generation', rows: [[['PM Number', plan.pmNumber], ['Next Date', plan.startDate], ['Frequency', `${plan.frequency} ${plan.freqUnit}`], ['Lead Time', `${plan.leadTime} days`]], [['Work Type', plan.workType], ['WO Status', plan.woStatus], ['PM Counter', plan.pmCounter], ['Last Generated Cycle', plan.lastGeneratedCycle || 'Not generated']]] },
          { title: 'Asset and Location', rows: [[['Asset', plan.asset || 'Location-based PM'], ['Asset Description', asset?.description], ['Location', plan.location || asset?.location], ['Route', plan.route || 'No route']]] },
          { title: 'Responsibility', rows: [[['Person Group', plan.personGroup], ['Department', plan.department], ['Sub Department', plan.subDepartment], ['Supervisor', plan.supervisor || 'Assigned after generation']]] }
        ]}
        tables={[
          {
            title: 'Job Tasks',
            columns: [
              { key: 'JOB TASK SEQUENCE', label: 'Seq.' },
              { key: 'JOB TASK DESCRIPTION', label: 'Task Description' },
              { key: 'TASK DURATION IN HOUR', label: 'Duration', render: row => `${Math.max(1, Math.round(Number(row['TASK DURATION IN HOUR']) * 1440))} min` }
            ],
            rows: tasks,
            emptyText: 'No task rows found for this job plan.'
          },
          {
            title: 'Generated Work Orders',
            columns: [
              { key: 'WORKORDER', label: 'WO Number' },
              { key: 'PM CYCLE', label: 'PM Cycle' },
              { key: 'TARGET START ', label: 'Target Start' },
              { key: 'STATUS', label: 'Status' }
            ],
            rows: history,
            emptyText: 'No work orders generated yet.'
          }
        ]}
      />
    </section>
  )
}

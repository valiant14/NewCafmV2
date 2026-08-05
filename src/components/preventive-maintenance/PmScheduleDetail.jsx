import { useState } from 'react'
import { CalendarClock, ChevronRight, ExternalLink, FileSpreadsheet, Settings2, Sparkles, UserRoundCheck } from 'lucide-react'
import Badge from '../ui/Badge'
import Button from '../ui/Button'
import { DetailHeader, DetailTabs, MetricCard } from '../ui/DetailScaffold'
import GenericPrintReport from '../ui/GenericPrintReport'
import { statusDescription, statusTone } from '../../lib/statusMatrix'
import { scheduleForPlan } from '../../lib/pmGeneration'
import { nowLocalDateTime } from '../../lib/datetime'
import Surface, { SurfaceHeader } from '../ui/Surface'
import Field from '../ui/Field'
import { normalizeWorkOrderWorkflow, workflowStatusLabel, workflowStatusOptions } from '../../lib/workOrderWorkflow'
import useModuleAccess from '../../hooks/useModuleAccess'

const normalize = value => String(value || '').trim()

function MiniMetric({ label, value, note }) {
  return <MetricCard label={label} value={value} note={note} />
}

function DetailCard({ icon: Icon, eyebrow, title, children }) {
  return (
    <Surface>
      <SurfaceHeader eyebrow={eyebrow} title={title} actions={Icon ? <span className="app-record-icon"><Icon size={18} /></span> : null} />
      {children}
    </Surface>
  )
}

function FieldGrid({ rows }) {
  return (
    <dl className="grid gap-3 md:grid-cols-2">
      {rows.map(([label, value]) => (
        <div key={label} className="app-info-field">
          <dt className="app-stat-label">{label}</dt>
          <dd>{value || '-'}</dd>
        </div>
      ))}
    </dl>
  )
}

export default function PmScheduleDetail({ plan, assets, jobTasks, jobPlans, pmRules = [], workOrders, workflow, onBack, onOpenWorkOrder, onUpdate }) {
  const access = useModuleAccess('Preventive Maintenance')
  const activeWorkflow = normalizeWorkOrderWorkflow(workflow)
  const validWoStatuses = workflowStatusOptions(activeWorkflow).map(option => option.value)
  const generatedTab = 'Generated Work Orders'
  const [activeTab, setActiveTab] = useState('PM Details')
  const asset = assets.find(item => normalize(item.assetnum) === normalize(plan.asset))
  const linkedPlan = jobPlans.find(item => normalize(item.number) === normalize(plan.jobPlan))
  const tasks = jobTasks.filter(task => normalize(task.JPNUM) === normalize(plan.jobPlan))
  const history = workOrders.filter(order => normalize(order['PM NUMBER']) === normalize(plan.pmNumber))
  const location = plan.location || asset?.location || 'From asset'
  const inactive = plan.pmStatus === 'INACTIVE'
  const schedule = scheduleForPlan(plan, pmRules)
  const selectedRule = schedule.rule
  const changePmStatus = status => onUpdate?.(plan.pmNumber, { pmStatus: status })
  const ruleOptions = [
    { value: '', label: 'Direct PM schedule' },
    ...pmRules
      .filter(rule => rule.status === 'Active' || rule.name === plan.scheduleRule)
      .map(rule => ({ value: rule.name, label: `${rule.frequency} ${rule.freqUnit} - ${rule.name}` }))
  ]
  const changeRule = event => {
    const ruleName = event.target.value
    const rule = pmRules.find(item => normalize(item.name).toLowerCase() === normalize(ruleName).toLowerCase())
    onUpdate?.(plan.pmNumber, {
      scheduleRule: ruleName,
      ...(rule ? {
        leadTime: Number(rule.leadTimeDays) || 0,
        frequency: Number(rule.frequency) || 1,
        freqUnit: rule.freqUnit || 'MONTHS',
        woStatus: validWoStatuses.includes(rule.defaultWoStatus) ? rule.defaultWoStatus : activeWorkflow.initialStatus,
        ...(['MINUTES', 'HOURS'].includes(rule.freqUnit) ? { startDate: nowLocalDateTime(), lastGeneratedCycle: '' } : {})
      } : {})
    })
  }
  const openRule = () => {
    if (!plan.scheduleRule) return
    window.history.pushState({}, '', `/pm-rules/${encodeURIComponent(plan.scheduleRule)}`)
    window.dispatchEvent(new PopStateEvent('popstate'))
  }

  return (
    <section className="printable-record">
      <div className="print-report-screen space-y-5">
        <DetailHeader
          eyebrow={`PREVENTIVE MAINTENANCE - ${plan.workType}`}
          id={plan.pmNumber}
          title={plan.description}
          status={`${plan.pmStatus} - ${statusDescription('preventiveMaintenance', plan.pmStatus)}`}
          statusTone={statusTone(plan.pmStatus)}
          onBack={onBack}
          backLabel="All PM Schedules"
          printLabel="Print PM"
          stats={[
            { label: 'Generation Rule', value: plan.scheduleRule || `Every ${schedule.frequency} ${schedule.freqUnit}`, note: `Next ${plan.startDate} - Lead ${schedule.leadTime}d - ${String(schedule.triggerHour || 0).padStart(2, '0')}:00 - ${schedule.woStatus}` },
            { label: 'Generated', value: history.length || plan.pmCounter, note: 'WO history' },
            { label: 'Job Plan', value: plan.jobPlan, note: linkedPlan?.description || 'Excel reference' },
            { label: 'Asset / Location', value: plan.asset || 'Location PM', note: location }
          ]}
          actions={access.edit ? (
            <Button variant={inactive ? 'outline' : 'primary'} onClick={() => changePmStatus(inactive ? 'ACTIVE' : 'INACTIVE')}>
              {inactive ? 'Activate PM' : 'Set Inactive'}
            </Button>
          ) : null}
        />

        <DetailTabs tabs={['PM Details', 'Job Plan', generatedTab]} active={activeTab} onChange={setActiveTab} />

        {activeTab === 'PM Details' && (
          <div className="grid gap-5 xl:grid-cols-2">
            <DetailCard icon={UserRoundCheck} eyebrow="RESPONSIBILITY" title="Ownership">
              <FieldGrid rows={[
                ['Person Group', plan.personGroup || 'Not assigned'],
                ['Department', plan.department || 'Not configured'],
                ['Sub Department', plan.subDepartment || 'Not configured'],
                ['Supervisor', plan.supervisor || 'Assigned after generation'],
                ['Lead', plan.lead || 'Not specified'],
                ['Store Location', plan.storeLocation || 'Not specified']
              ]} />
            </DetailCard>

            <DetailCard icon={Sparkles} eyebrow="GENERATION" title="Automatic Work Order Behavior">
              <div className="grid gap-3 text-sm text-[var(--app-muted)]">
                <p>Generated Work Orders inherit asset, location, site, department, job plan, and all job tasks from this PM and the linked asset master.</p>
                <div className="grid gap-3 rounded-2xl border border-[var(--app-line)] bg-[var(--app-panel)] p-4">
                  <div className="flex items-end gap-2">
                    <div className="min-w-0 flex-1"><Field label="PM Schedule Rule" value={plan.scheduleRule || ''} options={ruleOptions} onChange={changeRule} disabled={!access.edit} /></div>
                    <Button variant="outline" disabled={!plan.scheduleRule} onClick={openRule}><ExternalLink size={15} />Open rule</Button>
                  </div>
                  <div className="grid gap-2 md:grid-cols-4">
                    <MiniMetric label="Every" value={`${schedule.frequency} ${schedule.freqUnit}`} note={selectedRule ? 'From rule' : 'Direct PM'} />
                    <MiniMetric label="Lead Time" value={`${schedule.leadTime} days`} note="Due soon window" />
                    <MiniMetric label="Trigger Hour" value={`${String(schedule.triggerHour || 0).padStart(2, '0')}:00`} note="Generation starts after" />
                    <MiniMetric label="WO Status" value={workflowStatusLabel(activeWorkflow, schedule.woStatus) || activeWorkflow.initialStatus} note={schedule.woStatus || activeWorkflow.initialStatus} />
                  </div>
                </div>
                <div className="grid gap-2 rounded-2xl bg-[var(--app-soft-bg)] p-4">
                  <strong className="text-[var(--app-ink)]">Next output</strong>
                  <span>Work Type: {plan.workType || 'PM'} - Initial Status: {workflowStatusLabel(activeWorkflow, schedule.woStatus) || activeWorkflow.initialStatus} - Job Tasks: {tasks.length}</span>
                  <span>Frequency: every {schedule.frequency} {schedule.freqUnit} at {String(schedule.triggerHour || 0).padStart(2, '0')}:00</span>
                </div>
                <div className="grid gap-2 rounded-2xl bg-[var(--app-soft-bg)] p-4">
                  <strong className="text-[var(--app-ink)]">Last generated cycle</strong>
                  <span>{plan.lastGeneratedCycle || 'Not generated yet'}</span>
                </div>
              </div>
            </DetailCard>
          </div>
        )}

        {activeTab === 'Job Plan' && (
          <DetailCard icon={Settings2} eyebrow="JOB PLAN" title="Execution Package">
            <div className="mb-4 grid gap-3 md:grid-cols-3">
              <MiniMetric label="JPNUM" value={plan.jobPlan} note={linkedPlan?.description || 'Job plan reference from Excel'} />
              <MiniMetric label="Tasks" value={tasks.length} note="All matching task rows" />
              <MiniMetric label="Estimated Duration" value={linkedPlan ? `${Math.max(1, Math.round(linkedPlan.duration * 10) / 10)} hours` : 'From job plan'} />
            </div>

            <div className="overflow-hidden rounded-2xl border border-[var(--app-line)]">
              <div className="grid grid-cols-[90px_1fr_120px] bg-[var(--app-table-header-bg)] px-4 py-3 text-[length:var(--app-table-header-font-size)] font-extrabold uppercase tracking-[.12em] text-[var(--app-table-heading)]">
                <span>Sequence</span>
                <span>Job task</span>
                <span>Duration</span>
              </div>
              {tasks.length ? tasks.map((task, index) => (
                <article className="grid grid-cols-[90px_1fr_120px] border-t border-[var(--app-line)] px-4 py-3 text-[length:var(--app-table-font-size)] text-[var(--app-table-text)]" key={`${task.JPNUM}-${task['JOB TASK SEQUENCE']}-${index}`}>
                  <strong>{task['JOB TASK SEQUENCE']}</strong>
                  <span>{task['JOB TASK DESCRIPTION']}</span>
                  <strong>{Math.max(1, Math.round(Number(task['TASK DURATION IN HOUR']) * 60))} min</strong>
                </article>
              )) : (
                <p className="p-4 text-sm text-[var(--app-muted)]">No task rows found for this job plan.</p>
              )}
            </div>
          </DetailCard>
        )}

        {activeTab === generatedTab && (
          <DetailCard icon={FileSpreadsheet} eyebrow="HISTORY" title="Generated Work Orders">
            <div className="mb-4 flex justify-end">
              <Badge tone={history.length ? 'green' : 'neutral'}>{history.length} records</Badge>
            </div>
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
          </DetailCard>
        )}
      </div>

      <GenericPrintReport
        reportTitle="PM Schedule Report"
        reportSubtitle="Preventive maintenance master report"
        number={plan.pmNumber}
        status={plan.pmStatus}
        description={plan.description}
        summary={[['Frequency', `${schedule.frequency} ${schedule.freqUnit}`], ['Rule', plan.scheduleRule || 'Direct PM values'], ['Job Plan', plan.jobPlan], ['Next Date', plan.startDate]]}
        sections={[
          { title: 'Schedule and Generation', rows: [[['PM Number', plan.pmNumber], ['Rule', plan.scheduleRule || 'Direct PM values'], ['Next Date', plan.startDate], ['Frequency', `${schedule.frequency} ${schedule.freqUnit}`], ['Lead Time', `${schedule.leadTime} days`]], [['Trigger Hour', `${String(schedule.triggerHour || 0).padStart(2, '0')}:00`], ['Work Type', plan.workType], ['WO Status', schedule.woStatus], ['PM Counter', plan.pmCounter], ['Last Generated Cycle', plan.lastGeneratedCycle || 'Not generated']]] },
          { title: 'Asset and Location', rows: [[['Asset', plan.asset || 'Location-based PM'], ['Asset Description', asset?.description], ['Location', location], ['Route', plan.route || 'No route']]] },
          { title: 'Responsibility', rows: [[['Person Group', plan.personGroup], ['Department', plan.department], ['Sub Department', plan.subDepartment], ['Supervisor', plan.supervisor || 'Assigned after generation']]] }
        ]}
        tables={[
          {
            title: 'Job Tasks',
            columns: [
              { key: 'JOB TASK SEQUENCE', label: 'Seq.' },
              { key: 'JOB TASK DESCRIPTION', label: 'Task Description' },
              { key: 'TASK DURATION IN HOUR', label: 'Duration', render: row => `${Math.max(1, Math.round(Number(row['TASK DURATION IN HOUR']) * 60))} min` }
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

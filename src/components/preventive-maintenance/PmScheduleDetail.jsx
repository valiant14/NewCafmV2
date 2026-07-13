import { CalendarClock, ChevronRight, FileSpreadsheet, Settings2, Sparkles } from 'lucide-react'
import Badge from '../ui/Badge'
import { DetailHeader, DetailTabs, InfoCard, ProfileStrip } from '../ui/DetailScaffold'

export default function PmScheduleDetail({ plan, assets, jobTasks, jobPlans, workOrders, onBack, onOpenWorkOrder }) {
  const asset = assets.find(item => item.assetnum === plan.asset)
  const linkedPlan = jobPlans.find(item => item.number === plan.jobPlan)
  const tasks = jobTasks.filter(task => task.JPNUM === plan.jobPlan)
  const history = workOrders.filter(order => order['PM NUMBER'] === plan.pmNumber)

  return (
    <section className="space-y-5">
      <DetailHeader
        eyebrow={`PREVENTIVE MAINTENANCE · ${plan.workType}`}
        id={plan.pmNumber}
        title={plan.description}
        status={plan.pmStatus}
        statusTone={plan.pmStatus === 'Active' ? 'green' : 'neutral'}
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

      <DetailTabs tabs={['PM Details', 'Job Plan', `Generated Work Orders ${history.length}`]} />

      <div className="grid gap-5 xl:grid-cols-[1fr_360px]">
        <main className="grid gap-5">
          <InfoCard
            icon={CalendarClock}
            kicker="SCHEDULE"
            title="Schedule & Generation"
            wide
            items={[
              ['PM Number', plan.pmNumber],
              ['Next Date', plan.startDate],
              ['Frequency', `${plan.frequency} ${plan.freqUnit}`],
              ['Lead Time', `${plan.leadTime} days`],
              ['Work Type', plan.workType],
              ['WO Status', `${plan.woStatus} · Waiting`],
              ['PM Counter', plan.pmCounter],
              ['Last Generated Cycle', plan.lastGeneratedCycle || 'Not generated']
            ]}
          />

          <section className="rounded-3xl border border-[var(--app-line)] bg-white p-5 shadow-[0_8px_24px_rgba(32,55,45,.06)]">
            <header className="mb-4 flex items-center gap-3 border-b border-[#edf0ec] pb-4">
              <Settings2 className="text-[#60766b]" size={18} />
              <div>
                <span className="text-[9px] font-extrabold uppercase tracking-[.16em] text-[#7b8780]">JOB PLAN</span>
                <h2 className="text-base font-extrabold text-[var(--app-ink)]">Execution Package</h2>
                <p className="text-xs text-[var(--app-muted)]">Copied automatically into every generated work order.</p>
              </div>
            </header>
            <div className="mb-4 grid gap-3 md:grid-cols-2">
              <div className="rounded-2xl bg-[#f8faf7] p-4"><span className="text-[9px] font-extrabold uppercase tracking-[.12em] text-[#7b8780]">JPNUM</span><strong className="mt-1 block text-[var(--app-ink)]">{plan.jobPlan}</strong><small className="text-xs text-[var(--app-muted)]">{linkedPlan?.description || 'Job plan reference from Excel'}</small></div>
              <div className="rounded-2xl bg-[#f8faf7] p-4"><span className="text-[9px] font-extrabold uppercase tracking-[.12em] text-[#7b8780]">Estimated Duration</span><strong className="mt-1 block text-[var(--app-ink)]">{linkedPlan ? `${Math.max(1, Math.round(linkedPlan.duration * 10) / 10)} hours` : 'From job plan'}</strong></div>
            </div>
            <div className="overflow-hidden rounded-2xl border border-[#e4ebe4]">
              <div className="grid grid-cols-[90px_1fr_100px] bg-[#f8faf7] px-4 py-3 text-[9px] font-extrabold uppercase tracking-[.12em] text-[#7b8780]"><span>Sequence</span><span>Job task</span><span>Duration</span></div>
              {tasks.length ? tasks.map(task => (
                <article className="grid grid-cols-[90px_1fr_100px] border-t border-[#edf0ec] px-4 py-3 text-sm" key={task.JOBTASKID}>
                  <strong>{task['JOB TASK SEQUENCE']}</strong>
                  <span className="text-[#536059]">{task['JOB TASK DESCRIPTION']}</span>
                  <strong>{Math.max(1, Math.round(Number(task['TASK DURATION IN HOUR']) * 1440))} min</strong>
                </article>
              )) : <p className="p-4 text-sm text-[var(--app-muted)]">No task rows found for this job plan.</p>}
            </div>
          </section>

          <section className="rounded-3xl border border-[var(--app-line)] bg-white p-5 shadow-[0_8px_24px_rgba(32,55,45,.06)]">
            <header className="mb-4 flex items-center justify-between gap-3 border-b border-[#edf0ec] pb-4">
              <div className="flex items-center gap-3"><FileSpreadsheet className="text-[#60766b]" size={18} /><div><span className="text-[9px] font-extrabold uppercase tracking-[.16em] text-[#7b8780]">HISTORY</span><h2 className="text-base font-extrabold text-[var(--app-ink)]">Generated Work Orders</h2><p className="text-xs text-[var(--app-muted)]">Every work order produced from this PM master.</p></div></div>
              <Badge tone={history.length ? 'green' : 'neutral'}>{history.length} records</Badge>
            </header>
            {history.length ? (
              <div className="grid gap-2">
                {history.map(order => (
                  <button className="grid gap-3 rounded-2xl border border-[#e4ebe4] p-4 text-left transition hover:bg-[#f8faf7] md:grid-cols-[120px_1fr_120px_90px_auto] md:items-center" key={order.WORKORDER} onClick={() => onOpenWorkOrder?.(order.WORKORDER)}>
                    <strong>{order.WORKORDER}</strong>
                    <span>{order['PM CYCLE'] || '-'}</span>
                    <span>{String(order['TARGET START '] || '-').slice(0, 10)}</span>
                    <Badge tone={['COMP', 'CLOSE'].includes(order.STATUS) ? 'green' : 'neutral'}>{order.STATUS}</Badge>
                    <ChevronRight size={15} />
                  </button>
                ))}
              </div>
            ) : (
              <div className="grid place-items-center rounded-2xl border border-dashed border-[#dce5dc] p-8 text-center text-[var(--app-muted)]"><CalendarClock /><strong className="mt-2 text-[var(--app-ink)]">No work orders generated yet</strong><span className="text-sm">The first eligible cycle will appear here after automatic generation.</span></div>
            )}
          </section>
        </main>

        <aside className="grid content-start gap-5">
          <InfoCard icon={Sparkles} kicker="ASSET" title="Asset & Location" items={[['ASSETNUM', plan.asset || 'Location-based PM'], ['Asset Description', asset?.description], ['LOCATION', plan.location || asset?.location || 'From asset'], ['ROUTE', plan.route || 'No route'], ['STORELOC', plan.storeLocation || 'Not specified']]} />
          <InfoCard icon={Settings2} kicker="RESPONSIBILITY" title="Ownership" items={[['PERSONGROUP', plan.personGroup || 'Not assigned'], ['Department', plan.department || 'Not configured'], ['Sub Department', plan.subDepartment || 'Not configured'], ['Supervisor', plan.supervisor || 'Assigned after generation'], ['Lead', plan.lead || 'Not specified']]} />
        </aside>
      </div>
    </section>
  )
}

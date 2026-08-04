import { DetailHeader, DetailTabs, InfoCard, MetricCard } from '../ui/DetailScaffold'
import GenericPrintReport from '../ui/GenericPrintReport'

export default function MasterRecordDetail({ eyebrow, id, title, status, statusTone = 'green', onBack, groups = [] }) {
  const summary = groups.flatMap(group => group.items).slice(0, 4)

  return (
    <section className="printable-record">
      <div className="print-report-screen space-y-5">
      <DetailHeader
        eyebrow={eyebrow}
        id={id}
        title={title}
        status={status}
        statusTone={statusTone}
        onBack={onBack}
        backLabel="Back to register"
      />

      <section className="grid gap-3 md:grid-cols-4">
        {summary.map(([label, value]) => (
          <MetricCard key={label} label={label} value={value} />
        ))}
      </section>

      <DetailTabs tabs={['Record Details']} />

      <main className="grid gap-5 lg:grid-cols-2">
        {groups.map(group => (
          <InfoCard key={group.title} kicker={group.kicker} title={group.title} items={group.items} />
        ))}
      </main>
      </div>
      <GenericPrintReport
        reportTitle={`${eyebrow || 'Master Data'} Report`}
        reportSubtitle="Master data record report"
        number={id}
        status={status}
        description={title}
        summary={summary.slice(0, 3)}
        sections={groups.map(group => ({
          title: group.title,
          rows: Array.from({ length: Math.ceil(group.items.length / 4) }, (_, rowIndex) => group.items.slice(rowIndex * 4, rowIndex * 4 + 4))
        }))}
      />
    </section>
  )
}


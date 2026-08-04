import { ChevronRight } from 'lucide-react'
import { DetailHeader, DetailTabs } from '../ui/DetailScaffold'
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
          <div key={label} className="rounded-2xl border border-[var(--app-line)] bg-white p-4 shadow-[0_8px_24px_rgba(32,55,45,.05)]">
            <span className="text-[9px] font-extrabold uppercase tracking-[.14em] text-[#7b8780]">{label}</span>
            <strong className="mt-1 block text-sm text-[var(--app-ink)]">{value || '-'}</strong>
          </div>
        ))}
      </section>

      <DetailTabs tabs={['Record Details']} />

      <main className="grid gap-5 lg:grid-cols-2">
        {groups.map(group => (
          <section key={group.title} className="rounded-3xl border border-[var(--app-line)] bg-[var(--app-panel)] p-5 shadow-[0_12px_32px_rgba(15,23,42,.06)]">
            <header className="mb-4 flex items-center justify-between gap-3 border-b border-[#edf0ec] pb-4">
              <div>
                <span className="text-[9px] font-extrabold uppercase tracking-[.16em] text-[#7b8780]">{group.kicker}</span>
                <h2 className="text-base font-extrabold text-[var(--app-ink)]">{group.title}</h2>
              </div>
              <ChevronRight className="text-[#9aa69f]" size={17} />
            </header>
            <dl className="grid gap-3 sm:grid-cols-2">
              {group.items.map(([label, value]) => (
                <div key={label} className="rounded-2xl bg-[#f8faf7] p-3">
                  <dt className="text-[9px] font-extrabold uppercase tracking-[.12em] text-[#7b8780]">{label}</dt>
                  <dd className="mt-1 text-sm font-bold text-[var(--app-ink)]">{value || '-'}</dd>
                </div>
              ))}
            </dl>
          </section>
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


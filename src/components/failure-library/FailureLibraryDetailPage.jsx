import { useState } from 'react'
import { AlertTriangle, ClipboardList, GitBranch, ShieldCheck, Wrench } from 'lucide-react'
import Badge from '../ui/Badge'
import DataTable from '../ui/DataTable'
import EmptyState from '../ui/EmptyState'
import { DetailHeader, DetailTabs, InfoCard } from '../ui/DetailScaffold'
import GenericPrintReport from '../ui/GenericPrintReport'
import { statusTone } from '../../lib/statusMatrix'

const uniqueRows = (rows, key) => [...new Map(rows.filter(row => row[key]).map(row => [row[key], row])).values()]

export default function FailureLibraryDetailPage({ failureClass, rows = [], workOrders = [], onBack }) {
  const [tab, setTab] = useState('Failure Details')
  const problems = uniqueRows(rows, 'PROBLEM CODE')
  const causes = uniqueRows(rows, 'CAUSE CODE')
  const remedies = uniqueRows(rows, 'REMEDY CODE')

  return (
    <section className="printable-record">
      <div className="print-report-screen space-y-5">
        <DetailHeader
          eyebrow="FAILURE LIBRARY"
          id={failureClass['FAILURE CLASS ID']}
          title={failureClass.DESCRIPTION}
          status="ACTIVE"
          statusTone="green"
          onBack={onBack}
          backLabel="Back to failure library"
          stats={[
            { label: 'Problems', value: problems.length },
            { label: 'Causes', value: causes.length },
            { label: 'Remedies', value: remedies.length },
            { label: 'Linked WOs', value: workOrders.length }
          ]}
        />

        <DetailTabs tabs={['Failure Details', 'Problem Hierarchy', 'Work Orders']} active={tab} onChange={setTab} />

        {tab === 'Failure Details' && (
          <main className="space-y-4">
            <section className="grid gap-3 md:grid-cols-4">
              {[
                { icon: AlertTriangle, label: 'Problems', value: problems.length, note: 'Problem codes' },
                { icon: GitBranch, label: 'Causes', value: causes.length, note: 'Optional cause codes' },
                { icon: Wrench, label: 'Remedies', value: remedies.length, note: 'Optional remedy codes' },
                { icon: ClipboardList, label: 'Work Orders', value: workOrders.length, note: 'Classified usage' }
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
              icon={ShieldCheck}
              kicker="FAILURE CLASS"
              title="Class Information"
              items={[
                ['Failure Class ID', failureClass['FAILURE CLASS ID']],
                ['Description', failureClass.DESCRIPTION],
                ['Problem Count', problems.length],
                ['Cause Count', causes.length],
                ['Remedy Count', remedies.length],
                ['Required For', 'CM closeout']
              ]}
            />
          </main>
        )}

        {tab === 'Problem Hierarchy' && (
          <section className="overflow-hidden rounded-2xl border border-[var(--app-line)] bg-[var(--app-table-bg)] shadow-[0_8px_24px_rgba(32,55,45,.06)]">
            {rows.length ? (
              <DataTable
                rows={rows}
                rowKey={row => `${row['PROBLEM CODE']}-${row['CAUSE CODE']}-${row['REMEDY CODE']}`}
                pagination
                columns={[
                  { key: 'PROBLEM CODE', label: 'Problem Code', render: value => <strong className="mono text-[var(--app-ink)]">{value}</strong> },
                  { key: 'PC - DESCRIPTION', label: 'Problem Description' },
                  { key: 'CAUSE CODE', label: 'Cause Code', render: value => value || 'Optional' },
                  { key: 'CC - DESCRIPTION', label: 'Cause Description', render: value => value || '-' },
                  { key: 'REMEDY CODE', label: 'Remedy Code', render: value => value || 'Optional' },
                  { key: 'RC - DESCRIPTION', label: 'Remedy Description', render: value => value || '-' }
                ]}
              />
            ) : (
              <EmptyState icon={ShieldCheck} title="No hierarchy rows" description="Problem, cause, and remedy rows for this failure class will appear here." />
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
              <EmptyState icon={ClipboardList} title="No linked work orders" description="Work Orders using this failure class will appear here after classification." />
            )}
          </section>
        )}
      </div>

      <GenericPrintReport
        reportTitle="Failure Library Report"
        reportSubtitle="Problem, cause, and remedy hierarchy"
        number={failureClass['FAILURE CLASS ID']}
        status="ACTIVE"
        description={failureClass.DESCRIPTION}
        summary={[['Problems', problems.length], ['Causes', causes.length], ['Remedies', remedies.length]]}
        sections={[
          { title: 'Failure Class', rows: [[['Class ID', failureClass['FAILURE CLASS ID']], ['Description', failureClass.DESCRIPTION], ['Problems', problems.length], ['Linked WOs', workOrders.length]]] }
        ]}
        tables={[{
          title: 'Problem Hierarchy',
          columns: [
            { key: 'problem', label: 'Problem' },
            { key: 'problemDescription', label: 'Problem Description' },
            { key: 'cause', label: 'Cause' },
            { key: 'remedy', label: 'Remedy' }
          ],
          rows: rows.map((row, index) => ({
            key: `${row['PROBLEM CODE']}-${index}`,
            problem: row['PROBLEM CODE'],
            problemDescription: row['PC - DESCRIPTION'],
            cause: row['CAUSE CODE'] || '-',
            remedy: row['REMEDY CODE'] || '-'
          })),
          emptyText: 'No problem codes recorded for this failure class.'
        }]}
      />
    </section>
  )
}

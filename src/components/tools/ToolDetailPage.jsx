import { useState } from 'react'
import { BarChart3, ClipboardCheck, MapPin, ShieldCheck, TimerReset, Wrench } from 'lucide-react'
import { DetailHeader, DetailTabs, InfoCard } from '../ui/DetailScaffold'
import Badge from '../ui/Badge'
import DataTable from '../ui/DataTable'
import EmptyState from '../ui/EmptyState'
import GenericPrintReport from '../ui/GenericPrintReport'
import { statusTone as workOrderStatusTone } from '../../lib/statusMatrix'

const statusTone = {
  Available: 'green',
  Allocated: 'orange',
  Maintenance: 'orange'
}

const toolStatuses = ['Available', 'Allocated', 'Maintenance']

function daysUntil(dateValue) {
  if (!dateValue) return null
  const today = new Date('2026-07-12T00:00:00')
  const target = new Date(`${dateValue}T00:00:00`)
  return Math.ceil((target - today) / 86400000)
}

function inspectionState(tool) {
  const days = daysUntil(tool.inspectionDue)
  const dueSoon = days !== null && days <= 30
  const overdue = days !== null && days < 0
  const label = overdue ? 'Inspection overdue' : dueSoon ? 'Inspection due soon' : 'Inspection current'

  return { days, dueSoon, overdue, label }
}

export default function ToolDetailPage({ tool, usageRows = [], onBack, onUpdate }) {
  const [tab, setTab] = useState('Tool Details')
  const inspection = inspectionState(tool)
  const tone = statusTone[tool.status] || 'green'
  const availableUnits = tool.status === 'Available' ? Number(tool.quantity || 0) : Math.max(0, Number(tool.quantity || 0) - 1)
  const changeStatus = event => onUpdate?.(tool.toolNumber, { status: event.target.value })

  return (
    <section className="printable-record">
      <div className="print-report-screen space-y-5">
        <DetailHeader
          eyebrow="TOOL & EQUIPMENT"
          id={tool.toolNumber}
          title={tool.description}
          status={tool.status}
          statusTone={tone}
          onBack={onBack}
          backLabel="Back to tools"
          stats={[
            { label: 'Category', value: tool.category },
            { label: 'Location', value: tool.location },
            { label: 'Available Units', value: availableUnits },
            { label: 'Inspection Due', value: tool.inspectionDue || '-' }
          ]}
          actions={(
            <select
              value={tool.status}
              onChange={changeStatus}
              className="h-10 min-w-[160px] rounded-xl border border-[var(--app-line)] bg-[var(--app-panel)] px-3 text-xs font-extrabold text-[var(--app-ink)] outline-none transition hover:bg-[var(--app-soft-bg)] focus:border-[var(--app-primary)] focus:ring-4 focus:ring-[var(--app-field-focus-ring)]"
              aria-label="Change tool status"
            >
              {toolStatuses.map(status => <option key={status} value={status}>{status}</option>)}
            </select>
          )}
        />

        <DetailTabs tabs={['Tool Details', 'Work Order Usage']} active={tab} onChange={setTab} />

        {tab === 'Tool Details' && <main className="space-y-4">
          <section className="grid gap-3 md:grid-cols-4">
            {[
              { icon: Wrench, label: 'Quantity', value: tool.quantity, note: 'Total units' },
              { icon: ClipboardCheck, label: 'Available', value: availableUnits, note: 'Ready units' },
              { icon: TimerReset, label: 'Inspection Window', value: inspection.days === null ? '-' : `${inspection.days}d`, note: inspection.label },
              { icon: BarChart3, label: 'Control Status', value: tool.status, note: inspection.overdue ? 'Review required' : 'Current state' }
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
              icon={Wrench}
              kicker="RESOURCE"
              title="Tool Information"
              items={[
                ['Description', tool.description],
                ['Tool Number', tool.toolNumber],
                ['Category', tool.category],
                ['Quantity', tool.quantity]
              ]}
            />

            <InfoCard
              icon={MapPin}
              kicker="CONTROL"
              title="Location & Inspection"
              items={[
                ['Location', tool.location],
                ['Status', tool.status],
                ['Available Units', availableUnits],
                ['Inspection Due', tool.inspectionDue],
                ['Inspection State', inspection.label],
                ['Overdue', inspection.overdue ? 'Yes' : 'No']
              ]}
            />
          </section>

          {inspection.dueSoon && (
            <section className="flex items-start gap-3 rounded-2xl border border-[var(--app-badge-orange-text)]/20 bg-[var(--app-badge-orange-bg)] p-4 text-[var(--app-badge-orange-text)]">
              <ShieldCheck size={18} />
              <div>
                <h3 className="text-sm font-extrabold">{inspection.label}</h3>
                <p className="mt-1 text-xs font-semibold opacity-80">Review inspection before assigning this tool or equipment to a Work Order.</p>
              </div>
            </section>
          )}
        </main>}

        {tab === 'Work Order Usage' && (
          <section className="overflow-hidden rounded-2xl border border-[var(--app-line)] bg-[var(--app-table-bg)] shadow-[0_8px_24px_rgba(32,55,45,.06)]">
            {usageRows.length ? (
              <DataTable
                rows={usageRows}
                rowKey="reference"
                pagination
                columns={[
                  { key: 'reference', label: 'Work Order', render: value => <strong className="mono text-[var(--app-ink)]">{value}</strong> },
                  { key: 'description', label: 'Description' },
                  { key: 'workType', label: 'Type' },
                  { key: 'quantity', label: 'Requested / Used' },
                  { key: 'source', label: 'Source' },
                  { key: 'department', label: 'Department' },
                  { key: 'site', label: 'Site' },
                  { key: 'status', label: 'WO Status', render: value => <Badge tone={workOrderStatusTone(value)}>{value}</Badge> }
                ]}
              />
            ) : (
              <EmptyState
                icon={Wrench}
                title="No Work Order usage yet"
                description="Work Orders that request, allocate, or use this tool/equipment will appear here."
              />
            )}
          </section>
        )}
      </div>
      <GenericPrintReport
        reportTitle="Tool Report"
        reportSubtitle="Tool and equipment report"
        number={tool.toolNumber}
        status={tool.status}
        description={tool.description}
        summary={[['Category', tool.category], ['Location', tool.location], ['Inspection Due', tool.inspectionDue]]}
        sections={[
          { title: 'Tool Information', rows: [[['Tool Number', tool.toolNumber], ['Description', tool.description], ['Category', tool.category], ['Quantity', tool.quantity]]] },
          { title: 'Location and Inspection', rows: [[['Location', tool.location], ['Status', tool.status], ['Inspection Due', tool.inspectionDue], ['Inspection State', inspection.label]]] },
          { title: 'Availability', rows: [[['Available Units', availableUnits], ['Inspection Window', inspection.days === null ? '-' : `${inspection.days} days`], ['Due Soon', inspection.dueSoon ? 'Yes' : 'No'], ['Overdue', inspection.overdue ? 'Yes' : 'No']]] }
        ]}
      />
    </section>
  )
}

import { AlertTriangle, BadgeCheck, CalendarClock, ClipboardCheck, MapPin, ShieldCheck, TimerReset, Wrench } from 'lucide-react'
import { DetailHeader, DetailTabs, FocusCard, InfoCard, ProfileStrip, TimelineCard } from '../ui/DetailScaffold'

const statusTone = {
  Available: 'green',
  Allocated: 'orange',
  Maintenance: 'orange'
}

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
  const progress = days === null ? 0 : Math.max(8, Math.min(100, Math.round((days / 120) * 100)))

  return { days, dueSoon, overdue, label, progress }
}

export default function ToolDetailPage({ tool, onBack }) {
  const inspection = inspectionState(tool)
  const tone = statusTone[tool.status] || 'green'
  const availableUnits = tool.status === 'Available' ? tool.quantity : Math.max(0, tool.quantity - 1)
  const warning = tool.status !== 'Available' || inspection.dueSoon

  return (
    <section className="space-y-5">
      <DetailHeader
        eyebrow="TOOL & EQUIPMENT"
        id={tool.toolNumber}
        title={tool.description}
        status={tool.status}
        statusTone={tone}
        onBack={onBack}
        backLabel="Back to tools"
      />

      <ProfileStrip
        icon={Wrench}
        tone="blue"
        eyebrow="Controlled Resource"
        title={tool.description}
        description={`${tool.category} · ${tool.location}`}
        stats={[
          { label: 'Quantity', value: tool.quantity },
          { label: 'Inspection Due', value: tool.inspectionDue || '-' }
        ]}
      />

      <DetailTabs tabs={['Tool Details']} />

      <main className="grid gap-5 lg:grid-cols-2">
        <FocusCard
          icon={warning ? AlertTriangle : ShieldCheck}
          eyebrow="RESOURCE READINESS"
          title={tool.status === 'Available' && !inspection.dueSoon ? 'Ready for work order use' : inspection.label}
          description={`${availableUnits} unit${availableUnits === 1 ? '' : 's'} available from ${tool.location}. Inspection due ${tool.inspectionDue || 'not scheduled'}.`}
          progress={inspection.progress}
          warning={warning}
          metrics={[
            { icon: ClipboardCheck, label: 'Status', value: tool.status, note: 'Current control state' },
            { icon: Wrench, label: 'Available Units', value: availableUnits, note: 'Ready for planning' },
            { icon: TimerReset, label: 'Inspection Window', value: inspection.days === null ? '-' : `${inspection.days}d`, note: inspection.label }
          ]}
        />

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
            ['Inspection Due', tool.inspectionDue],
            ['Inspection State', inspection.label]
          ]}
        />

        <TimelineCard
          icon={CalendarClock}
          kicker="WORK ORDER USE"
          title="Tool Request Context"
          rows={[
            { icon: BadgeCheck, text: 'Selectable from the Work Order Plan tab as a required tool or equipment.', value: tool.toolNumber },
            { icon: BadgeCheck, text: 'Status controls whether the resource is ready, allocated, or under maintenance.', value: tool.status },
            { icon: BadgeCheck, text: 'Inspection due date helps prevent unsafe equipment assignment.', value: tool.inspectionDue || '-' }
          ]}
        />
      </main>
    </section>
  )
}

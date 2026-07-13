import { Activity, BadgeCheck, BriefcaseBusiness, CalendarDays, Clock3, ShieldCheck, UserRound, Wrench } from 'lucide-react'
import { DetailHeader, DetailTabs, FocusCard, InfoCard, ProfileStrip, TimelineCard } from '../ui/DetailScaffold'

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

function initials(name = '') {
  return name.split(' ').filter(Boolean).slice(0, 2).map(part => part[0]).join('').toUpperCase()
}

function AvatarIcon({ name }) {
  return <span className="text-base font-extrabold">{initials(name)}</span>
}

export default function LaborDetailPage({ labor, onBack }) {
  const workload = workloadByStatus[labor.availability] || workloadByStatus.Available
  const statusTone = toneByStatus[labor.availability] || 'green'

  return (
    <section className="space-y-5">
      <DetailHeader
        eyebrow="LABOR RESOURCE"
        id={labor.personId}
        title={`${labor.name} · ${labor.craft}`}
        status={labor.availability}
        statusTone={statusTone}
        onBack={onBack}
        backLabel="Back to labor"
      />

      <ProfileStrip
        icon={() => <AvatarIcon name={labor.name} />}
        eyebrow="Technician Profile"
        title={labor.name}
        description={`${labor.craftCode} · ${labor.department} / ${labor.subDepartment}`}
        stats={[
          { label: 'Shift', value: labor.shift },
          { label: 'Next action', value: workload.nextAssignment }
        ]}
      />

      <DetailTabs tabs={['Labor Details']} />

      <main className="grid gap-5 lg:grid-cols-2">
        <FocusCard
          icon={ShieldCheck}
          eyebrow="RESOURCE READINESS"
          title={labor.availability === 'Available' ? 'Ready for assignment' : labor.availability}
          description={`${labor.craft} assigned to ${labor.department} with ${labor.shift.toLowerCase()} shift coverage.`}
          progress={workload.utilization}
          warning={labor.availability !== 'Available'}
          metrics={[
            { icon: BriefcaseBusiness, label: 'Open Work', value: workload.openWork, note: 'Current assigned workload' },
            { icon: Clock3, label: 'Week Hours', value: `${workload.weekHours}h`, note: 'Planned labor capacity' },
            { icon: Activity, label: 'Utilization', value: `${workload.utilization}%`, note: 'Mock schedule load' }
          ]}
        />

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

        <TimelineCard
          icon={CalendarDays}
          kicker="WORK CONTEXT"
          title="Recent Planning Use"
          rows={[
            { icon: BadgeCheck, text: 'Craft can be selected in Work Order planning and actual labor.', value: labor.craftCode },
            { icon: BadgeCheck, text: 'Supervisor can dispatch this resource by department and work group.', value: labor.department },
            { icon: BadgeCheck, text: 'Availability is visible before assignment to avoid overbooking.', value: labor.availability }
          ]}
        />
      </main>
    </section>
  )
}

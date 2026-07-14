import { AlertTriangle, Building2, CalendarClock, ClipboardList, MapPin, ShieldCheck, UserRound } from 'lucide-react'
import { DetailHeader, DetailTabs, FocusCard, InfoCard, ProfileStrip, TimelineCard } from '../ui/DetailScaffold'

const severityTone = severity => {
  if (severity === 'Critical' || severity === 'High') return 'orange'
  if (severity === 'Medium') return 'blue'
  return 'green'
}

const statusTone = status => {
  if (status === 'Closed') return 'green'
  if (status === 'Under review') return 'blue'
  return 'orange'
}

export default function IncidentDetailPage({ incident, onBack }) {
  const open = incident.status !== 'Closed'
  const reportedDate = incident.reportedDate ? new Date(incident.reportedDate).toLocaleString() : 'Not recorded'

  return (
    <section className="space-y-5">
      <DetailHeader
        eyebrow="INCIDENT RECORD"
        id={incident.incidentNumber}
        title={incident.description}
        status={incident.status || 'Open'}
        statusTone={statusTone(incident.status)}
        onBack={onBack}
        backLabel="Back to incidents"
        printLabel="Print incident"
      />

      <ProfileStrip
        icon={AlertTriangle}
        tone={severityTone(incident.severity)}
        eyebrow="Standalone HSE / Operations Incident"
        title={incident.description}
        description={`${incident.location || 'No location'} · Site ${incident.site || '-'}`}
        stats={[
          { label: 'Severity', value: incident.severity || 'Not set' },
          { label: 'Department', value: incident.department || 'Not assigned' }
        ]}
      />

      <DetailTabs tabs={['Incident Details', 'Review', 'Attachments']} />

      <main className="grid gap-5 lg:grid-cols-2">
        <FocusCard
          icon={open ? AlertTriangle : ShieldCheck}
          eyebrow="INCIDENT STATUS"
          title={open ? 'Incident is active and requires follow-up' : 'Incident closed'}
          description="Incident records are standalone and do not create PM or CM work orders unless the business process later requires a linked action."
          progress={open ? 55 : 100}
          warning={open}
          metrics={[
            { icon: MapPin, label: 'Site', value: incident.site, note: incident.location || 'Location not set' },
            { icon: AlertTriangle, label: 'Severity', value: incident.severity, note: 'Client fields can be extended after confirmation' },
            { icon: ClipboardList, label: 'Status', value: incident.status || 'Open', note: 'Tracked independently from work orders' }
          ]}
        />

        <InfoCard
          icon={ClipboardList}
          kicker="SUMMARY"
          title="Incident Information"
          items={[
            ['Incident Number', incident.incidentNumber],
            ['Description', incident.description],
            ['Status', incident.status],
            ['Severity', incident.severity]
          ]}
        />

        <InfoCard
          icon={Building2}
          kicker="LOCATION"
          title="Site & Department"
          items={[
            ['Site', incident.site],
            ['Location', incident.location],
            ['Department', incident.department],
            ['Reported Date', reportedDate]
          ]}
        />

        <InfoCard
          icon={UserRound}
          kicker="REPORTING"
          title="Reporter & Ownership"
          items={[
            ['Reported By', incident.reportedBy],
            ['Owner Department', incident.department],
            ['Current Reviewer', incident.reviewer || 'HSE / Facility team'],
            ['Reference', incident.reference || 'Not linked']
          ]}
        />

        <TimelineCard
          icon={CalendarClock}
          kicker="ACTIVITY"
          title="Incident Timeline"
          rows={[
            { icon: AlertTriangle, text: 'Incident was reported and registered.', value: reportedDate },
            { icon: ClipboardList, text: 'Initial review status.', value: incident.status || 'Open' },
            { icon: ShieldCheck, text: 'Corrective action relationship.', value: 'Standalone module' }
          ]}
        />
      </main>
    </section>
  )
}

import { useState } from 'react'
import Combobox from '../ui/Combobox'
import { AlertTriangle, CalendarClock, ClipboardList, Download, FileText, ShieldCheck, UserRound } from 'lucide-react'
import { DetailHeader, DetailTabs, InfoCard, TimelineCard } from '../ui/DetailScaffold'
import GenericPrintReport from '../ui/GenericPrintReport'
import { statusDescription, statusOptions, statusTone } from '../../lib/statusMatrix'

export default function IncidentDetailPage({ incident, onBack, onUpdate }) {
  const [status, setStatus] = useState(incident.status || 'NEW')
  const [activeTab, setActiveTab] = useState('Incident Details')
  const [attachments, setAttachments] = useState(incident.attachments || [
    { name: 'incident-photo.jpg', type: 'Image', size: '1.2 MB' },
    { name: 'initial-hse-note.pdf', type: 'PDF', size: '420 KB' }
  ])
  const open = !['RESOLVED', 'CLOSED'].includes(status)
  const reportedDate = incident.reportedDate ? new Date(incident.reportedDate).toLocaleString() : 'Not recorded'
  const changeStatus = value => {
    setStatus(value)
    onUpdate?.(incident.incidentNumber, { status: value })
  }

  return (
    <section className="printable-record">
      <div className="print-report-screen space-y-5">
        <DetailHeader
          eyebrow="INCIDENT RECORD"
          id={incident.incidentNumber}
          title={incident.description}
          status={`${status} · ${statusDescription('incident', status)}`}
          statusTone={statusTone(status)}
          onBack={onBack}
          backLabel="Back to incidents"
          printLabel="Print incident"
          stats={[
            { label: 'Severity', value: incident.severity || 'Not set', note: 'HSE / Operations priority' },
            { label: 'Department', value: incident.department || 'Not assigned', note: `Site ${incident.site || '-'}` },
            { label: 'Location', value: incident.location || 'No location', note: 'Incident area' },
            { label: 'Reported By', value: incident.reportedBy || '-', note: reportedDate }
          ]}
          actions={(
            <div className="min-w-[170px]">
              <Combobox
                picker
                className="h-10 w-full rounded-xl border border-[var(--app-line)] bg-[var(--app-panel)] px-3 text-xs font-extrabold text-[var(--app-ink)] outline-none transition hover:bg-[var(--app-soft-bg)] focus:border-[var(--app-primary)] focus:ring-4 focus:ring-[var(--app-field-focus-ring)]"
                value={status}
                suggestions={statusOptions('incident').map(option => ({ value: option, label: statusDescription('incident', option) }))}
                onChange={event => changeStatus(event.target.value)}
                placeholder="Status"
              />
            </div>
          )}
        />

        <DetailTabs tabs={['Incident Details', 'Review', 'Attachments']} active={activeTab} onChange={setActiveTab} />

        {activeTab === 'Incident Details' && (
          <main className="grid gap-5 lg:grid-cols-2">
            <InfoCard
              icon={ClipboardList}
              kicker="CONTEXT"
              title="Incident Context"
              items={[
                ['Incident Number', incident.incidentNumber],
                ['Description', incident.description],
                ['Reported Date', reportedDate],
                ['Reference', incident.reference || 'Not linked']
              ]}
            />

            <InfoCard
              icon={UserRound}
              kicker="OWNERSHIP"
              title="Reporter & Responsibility"
              items={[
                ['Reported By', incident.reportedBy],
                ['Owner Department', incident.department],
                ['Current Reviewer', incident.reviewer || 'HSE / Facility team'],
                ['Module Relationship', 'Standalone incident']
              ]}
            />
          </main>
        )}

        {activeTab === 'Review' && (
          <main className="grid gap-5 lg:grid-cols-[420px_1fr]">
            <section className={`rounded-3xl border p-5 shadow-[0_8px_24px_rgba(32,55,45,.06)] ${open ? 'border-[var(--app-badge-orange-text)]/20 bg-[var(--app-badge-orange-bg)] text-[var(--app-badge-orange-text)]' : 'border-[var(--app-line)] bg-[var(--app-badge-green-bg)] text-[var(--app-badge-green-text)]'}`}>
              <div className="flex items-start gap-3">
                {open ? <AlertTriangle size={22} /> : <ShieldCheck size={22} />}
                <div>
                  <p className="text-[9px] font-extrabold uppercase tracking-[.16em] opacity-80">Review state</p>
                  <h2 className="mt-1 text-base font-extrabold">{open ? 'Follow-up required' : 'Review completed'}</h2>
                  <p className="mt-2 text-sm opacity-80">{open ? 'Use the header status dropdown when investigation moves forward.' : 'This incident is resolved or closed.'}</p>
                </div>
              </div>
            </section>
            <TimelineCard
              icon={CalendarClock}
              kicker="ACTIVITY"
              title="Incident Timeline"
              rows={[
                { icon: AlertTriangle, text: 'Incident was reported and registered.', value: reportedDate },
                { icon: ClipboardList, text: 'Current review status.', value: `${status} · ${statusDescription('incident', status)}` },
                { icon: ShieldCheck, text: 'Corrective action relationship.', value: 'Standalone module' }
              ]}
            />
          </main>
        )}

        {activeTab === 'Attachments' && (
          <main className="rounded-3xl border border-[var(--app-line)] bg-[var(--app-panel)] p-5 shadow-[0_8px_24px_rgba(32,55,45,.06)]">
            <header className="mb-4 flex flex-wrap items-center justify-between gap-3 border-b border-[var(--app-line)] pb-4">
              <div>
                <p className="text-[9px] font-extrabold uppercase tracking-[.16em] text-[var(--app-muted)]">FILES</p>
                <h2 className="text-base font-extrabold text-[var(--app-ink)]">Incident Attachments</h2>
                <p className="text-xs text-[var(--app-muted)]">Photos, reports, and supporting documents.</p>
              </div>
              <label className="inline-flex h-10 cursor-pointer items-center gap-2 rounded-xl border border-[var(--app-line)] bg-[var(--app-panel)] px-4 text-xs font-bold text-[var(--app-muted)] transition hover:bg-[var(--app-soft-bg-hover)]">
                <FileText size={15} />Add files
                <input
                  type="file"
                  multiple
                  className="hidden"
                  onChange={event => {
                    const files = Array.from(event.target.files || []).map(file => ({ name: file.name, type: file.type || 'Document', size: file.size > 1048576 ? `${(file.size / 1048576).toFixed(1)} MB` : `${Math.max(1, Math.round(file.size / 1024))} KB` }))
                    setAttachments(current => [...current, ...files])
                    event.target.value = ''
                  }}
                />
              </label>
            </header>
            <div className="grid gap-2">
              {attachments.map((file, index) => (
                <article className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-[var(--app-line)] bg-[var(--app-soft-bg)] p-4" key={`${file.name}-${index}`}>
                  <div className="flex min-w-0 items-center gap-3">
                    <span className="grid h-10 w-10 place-items-center rounded-xl bg-[var(--app-badge-blue-bg)] text-[var(--app-badge-blue-text)]"><FileText size={17} /></span>
                    <div className="min-w-0">
                      <strong className="block truncate text-sm text-[var(--app-ink)]">{file.name}</strong>
                      <span className="text-xs text-[var(--app-muted)]">{file.type} · {file.size}</span>
                    </div>
                  </div>
                  <button className="inline-flex h-9 items-center gap-2 rounded-lg border border-[var(--app-line)] bg-[var(--app-panel)] px-3 text-xs font-bold text-[var(--app-muted)]">
                    <Download size={14} />Download
                  </button>
                </article>
              ))}
            </div>
          </main>
        )}
      </div>

      <GenericPrintReport
        reportTitle="Incident Report"
        reportSubtitle="Standalone incident report"
        number={incident.incidentNumber}
        status={`${status} · ${statusDescription('incident', status)}`}
        description={incident.description}
        summary={[['Severity', incident.severity], ['Site', incident.site], ['Department', incident.department]]}
        sections={[
          { title: 'Incident Information', rows: [[['Incident Number', incident.incidentNumber], ['Description', incident.description], ['Status', status], ['Severity', incident.severity]]] },
          { title: 'Site and Department', rows: [[['Site', incident.site], ['Location', incident.location], ['Department', incident.department], ['Reported Date', reportedDate]]] },
          { title: 'Reporter and Ownership', rows: [[['Reported By', incident.reportedBy], ['Owner Department', incident.department], ['Reviewer', incident.reviewer || 'HSE / Facility team'], ['Reference', incident.reference || 'Not linked']]] }
        ]}
      />
    </section>
  )
}

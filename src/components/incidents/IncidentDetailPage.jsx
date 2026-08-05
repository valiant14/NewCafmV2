import { useState } from 'react'
import Combobox from '../ui/Combobox'
import { AlertTriangle, CalendarClock, ClipboardList, Download, FileText, ShieldCheck, UserRound, X } from 'lucide-react'
import { DetailHeader, DetailTabs, InfoCard, TimelineCard } from '../ui/DetailScaffold'
import GenericPrintReport from '../ui/GenericPrintReport'
import { statusDescription, statusOptions, statusTone } from '../../lib/statusMatrix'
import Alert from '../ui/Alert'
import Surface, { SurfaceHeader } from '../ui/Surface'
import useModuleAccess from '../../hooks/useModuleAccess'
import useEntityAttachments from '../../hooks/useEntityAttachments'

export default function IncidentDetailPage({ incident, onBack, onUpdate }) {
  const access = useModuleAccess('Incidents')
  const [status, setStatus] = useState(incident.status || 'NEW')
  const [activeTab, setActiveTab] = useState('Incident Details')
  const { attachments, loading: attachmentsLoading, error: attachmentError, uploadFiles, removeAttachment, downloadAttachment } = useEntityAttachments('incident', incident.incidentNumber)
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
          status={`${status} - ${statusDescription('incident', status)}`}
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
          actions={access.edit ? (
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
          ) : null}
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
            <Alert
              tone={open ? 'warning' : 'success'}
              icon={open ? AlertTriangle : ShieldCheck}
              eyebrow="Review state"
              title={open ? 'Follow-up required' : 'Review completed'}
              description={open ? 'Use the header status control when the investigation moves forward.' : 'This incident is resolved or closed.'}
            />
            <TimelineCard
              icon={CalendarClock}
              kicker="ACTIVITY"
              title="Incident Timeline"
              rows={[
                { icon: AlertTriangle, text: 'Incident was reported and registered.', value: reportedDate },
                { icon: ClipboardList, text: 'Current review status.', value: `${status} - ${statusDescription('incident', status)}` },
                { icon: ShieldCheck, text: 'Corrective action relationship.', value: 'Standalone module' }
              ]}
            />
          </main>
        )}

        {activeTab === 'Attachments' && (
          <Surface as="main">
            <SurfaceHeader
              eyebrow="Files"
              title="Incident Attachments"
              description="Photos, reports, and supporting documents."
              actions={access.edit ? (
              <label className="inline-flex h-10 cursor-pointer items-center gap-2 rounded-xl border border-[var(--app-line)] bg-[var(--app-panel)] px-4 text-xs font-bold text-[var(--app-muted)] transition hover:bg-[var(--app-soft-bg-hover)]">
                <FileText size={15} />Add files
                <input
                  type="file"
                  multiple
                  className="hidden"
                  onChange={async event => {
                    const files = Array.from(event.target.files || [])
                    event.target.value = ''
                    if (files.length) await uploadFiles(files, 'General').catch(() => {})
                  }}
                />
              </label>
              ) : null}
            />
            {attachmentError && <Alert className="mb-3" tone="danger">{attachmentError}</Alert>}
            <div className="app-record-list">
              {attachments.map(file => (
                <article className="app-record-row" key={file.attachmentId}>
                  <div className="flex min-w-0 items-center gap-3">
                    <span className="app-record-icon"><FileText size={17} /></span>
                    <div className="min-w-0">
                      <strong className="block truncate text-sm text-[var(--app-ink)]">{file.name}</strong>
                      <span className="text-xs text-[var(--app-muted)]">{file.type} - {file.size}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button type="button" onClick={() => downloadAttachment(file)} className="inline-flex h-9 items-center gap-2 rounded-lg border border-[var(--app-line)] bg-[var(--app-panel)] px-3 text-xs font-bold text-[var(--app-muted)]">
                      <Download size={14} />Download
                    </button>
                    {access.edit && <button type="button" onClick={() => removeAttachment(file)} className="app-icon-button" aria-label={`Remove ${file.name}`}><X size={14} /></button>}
                  </div>
                </article>
              ))}
              {attachmentsLoading && <p className="app-record-empty">Loading attachments...</p>}
              {!attachmentsLoading && !attachments.length && <p className="app-record-empty">No attachments stored for this incident.</p>}
            </div>
          </Surface>
        )}
      </div>

      <GenericPrintReport
        reportTitle="Incident Report"
        reportSubtitle="Standalone incident report"
        number={incident.incidentNumber}
        status={`${status} - ${statusDescription('incident', status)}`}
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

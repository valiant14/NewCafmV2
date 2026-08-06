import { useState } from 'react'
import { Boxes, Building2, Check, ChevronRight, ClipboardCheck, Download, FileText, Flag, MapPin, Paperclip, Printer, ShieldCheck, Upload, User, Users, X } from 'lucide-react'
import Badge from '../ui/Badge'
import StatusBadge from '../ui/StatusBadge'
import Alert from '../ui/Alert'
import Button from '../ui/Button'
import { printWithoutBrowserTitle } from '../../lib/print'
import { Field, Section } from '../ui/FormControls'
import { ModalFooter, ModalHeader, ModalPanel } from '../ui/ModalFrame'
import GenericPrintReport from '../ui/GenericPrintReport'
import { sameDepartment } from '../../lib/departments'
import Surface, { SurfaceHeader } from '../ui/Surface'
import useEntityAttachments from '../../hooks/useEntityAttachments'
import {
  DEFAULT_APPLICATION_WORKFLOWS,
  applicationWorkflowLabel,
  applicationWorkflowNextStep,
  applicationWorkflowTone,
  normalizeApplicationWorkflow
} from '../../lib/applicationWorkflow'

const tabs = [
  ['Request Details', FileText],
  ['Department Review', ClipboardCheck],
  ['Attachments', Paperclip]
]

export default function ServiceRequestDetail({ request, assets, workOrders, siteRecords = [], departmentRecords = [], failureOptions, failureRecords = [], workflow, onBack, onSubmit, onApprove, onAdvance, onOpenWorkOrder, modal = false, access = {} }) {
  const [form, setForm] = useState(request)
  const [submitError, setSubmitError] = useState('')
  const [activeTab, setActiveTab] = useState('Request Details')
  const [pendingFiles, setPendingFiles] = useState([])
  const activeWorkflow = normalizeApplicationWorkflow(workflow || DEFAULT_APPLICATION_WORKFLOWS.JOB_REQUEST, 'JOB_REQUEST')

  const isNew = Boolean(form.__isNew || form.sr === 'AUTO')
  const nextStep = isNew ? null : applicationWorkflowNextStep(activeWorkflow, form.status)
  const conversionStep = Boolean(nextStep?.requirements?.includes('linked_work_order'))
  const manualNextStep = nextStep && !nextStep.isAutomatic && (activeWorkflow.allowManualStatusChange || conversionStep) ? nextStep : null
  const { attachments, loading: attachmentsLoading, error: attachmentError, uploadFiles, removeAttachment, downloadAttachment } = useEntityAttachments('service-request', form.sr, { enabled: !isNew })
  // A submitted request is a record of what was reported, not a draft. Only a role with edit
  // rights on Job Requests may change it afterwards - a reporter can read it but not rewrite it.
  const readOnly = !isNew && !access.edit
  const canSubmit = Boolean(
    form.description?.trim() &&
    form.site &&
    form.location &&
    form.department?.trim() &&
    form.reportedBy?.trim() &&
    form.priority &&
    form.requestType
  )
  const canConvert = Boolean(
    form.asset?.trim() &&
    form.department?.trim() &&
    (form.assignedDepartment || form.department)?.trim() &&
    form.failureCode?.trim() &&
    form.problemCode?.trim()
  )
  const missingConversionFields = [
    !form.asset?.trim() && 'Asset',
    !form.department?.trim() && 'Department',
    !(form.assignedDepartment || form.department)?.trim() && 'Assigned Department',
    !form.failureCode?.trim() && 'Failure Code',
    !form.problemCode?.trim() && 'Problem Code'
  ].filter(Boolean)

  const update = key => event => setForm({ ...form, [key]: event.target.value })
  const sites = siteRecords.length
    ? siteRecords.filter(site => site.status !== 'Inactive').map(site => ({ value: site.code, label: site.name }))
    : [...new Set([...assets.map(asset => String(asset.site)), ...workOrders.map(order => String(order.SITE))].filter(Boolean))].sort()
  const siteAssets = assets.filter(asset => !form.site || String(asset.site) === String(form.site))
  const assetOptions = siteAssets.map(asset => ({ value: asset.assetnum, label: asset.description?.trim() }))
  const locations = [...new Set([...siteAssets.map(asset => asset.location), ...workOrders.filter(order => !form.site || String(order.SITE) === String(form.site)).map(order => order['LOCATION '])].filter(Boolean))].sort()
  const departmentOptions = [...new Map(departmentRecords
    .filter(department => department.status !== 'Inactive' && department.department)
    .map(department => [department.department, { value: department.department, label: '' }])
  ).values()]
  const subDepartmentOptions = departmentRecords
    .filter(department => department.status !== 'Inactive' && sameDepartment(department.department, form.department))
    .map(department => ({ value: department.subDepartmentCode, label: department.description }))
  const matchingFailures = failureRecords.filter(row => !form.failureCode || String(row['FAILURE CLASS ID'] || '').trim() === String(form.failureCode || '').trim())
  const problemOptions = [...new Map(matchingFailures
    .filter(row => String(row['PROBLEM CODE'] || '').trim())
    .map(row => [String(row['PROBLEM CODE']).trim(), { value: String(row['PROBLEM CODE']).trim(), label: String(row['PC - DESCRIPTION'] || '').trim() }])
  ).values()]

  const updateSite = event => setForm({ ...form, site: event.target.value, location: '', asset: '' })
  const updateAsset = event => {
    const value = event.target.value
    const match = assets.find(asset => asset.assetnum === value)
    setForm({
      ...form,
      asset: value,
      location: match?.location || form.location,
      site: match?.site ? String(match.site) : form.site
    })
  }
  const updateDepartment = event => setForm({
    ...form,
    department: event.target.value,
    subDepartment: '',
    assignedDepartment: form.assignedDepartment || event.target.value
  })
  const updateFailure = event => {
    const failureCode = event.target.value
    const firstProblem = failureRecords.find(row =>
      String(row['FAILURE CLASS ID'] || '').trim() === String(failureCode || '').trim() &&
      String(row['PROBLEM CODE'] || '').trim()
    )
    setForm({ ...form, failureCode, problemCode: firstProblem ? String(firstProblem['PROBLEM CODE']).trim() : '' })
  }

  const handlePrimary = async () => {
    if (isNew && !access.create) return setSubmitError('You do not have create access for Job Requests.')
    if (!isNew && conversionStep && !access.approve) return setSubmitError('You do not have approve access for Job Requests.')
    if (!isNew && !conversionStep && !access.edit) return setSubmitError('You do not have edit access for Job Requests.')
    if (isNew && !canSubmit) return setSubmitError('Complete Description, Priority, Request Type, Site, Location, Department, and Reported By before submitting.')
    if (!isNew && conversionStep && !canConvert) {
      setActiveTab(form.asset?.trim() ? 'Department Review' : 'Request Details')
      return setSubmitError('Complete Asset, Department, Assigned Department, Failure Code, and Problem Code before converting to CM.')
    }
    setSubmitError('')
    try {
      if (isNew) await onSubmit(form, pendingFiles)
      else if (conversionStep) setForm(await onApprove(form))
      else if (manualNextStep) setForm(await onAdvance(form, manualNextStep.statusCode))
    } catch (error) {
      setSubmitError(error.message || 'Unable to save this Job Request.')
    }
  }

  // ServiceRequestsPage renders this inside its own ModalOverlay, and only ever with
  // status NEW - so `modal` and `isNew` are the same condition. The intake form is built
  // from the same primitives and column spans as CreateWorkOrderModal.
  if (modal) return (
    <ModalPanel className="max-w-4xl" labelledBy="new-job-request-title">
      <ModalHeader
        eyebrow="NEW SERVICE REQUEST"
        title="New job request"
        titleId="new-job-request-title"
        description="Tell us what happened and where."
        onClose={onBack}
      />

      {/* Grouped into what happened, where, and evidence - the order a reporter thinks in.
          Where puts its three fields on one row and attachments is a single strip, which is
          what buys the description its taller box while keeping the form on one screen. */}
      <div className="grid gap-3 overflow-auto px-6 py-4">
        {submitError && (
          <Alert tone="danger" actions={<button className="app-icon-button" onClick={() => setSubmitError('')} aria-label="Dismiss"><X size={14} /></button>}>{submitError}</Alert>
        )}

        <Section compact icon={FileText} title="What happened" note="Describe the problem and how urgent it is">
          <div className="grid gap-3 md:grid-cols-3">
            <Field label="Priority" icon={Flag} value={form.priority} required options={['Low', 'Medium', 'High', 'Emergency']} onChange={update('priority')} />
            <Field label="Request Type" icon={ClipboardCheck} value={form.requestType} required options={['Corrective', 'Service', 'Inspection']} onChange={update('requestType')} />
            <Field label="Reported By" icon={User} value={form.reportedBy} required onChange={update('reportedBy')} />
            <div className="md:col-span-3"><Field label="Description" icon={FileText} value={form.description} required onChange={update('description')} /></div>
            <div className="md:col-span-3"><Field label="Long Description" icon={FileText} value={form.longDescription} type="textarea" onChange={update('longDescription')} /></div>
          </div>
        </Section>

        <Section compact tone="green" icon={MapPin} title="Where" note="Site and location are required, asset is optional">
          <div className="grid gap-3 md:grid-cols-3">
            <Field label="Site" icon={Building2} value={form.site} required onChange={updateSite} suggestions={sites} placeholder="Search or select a site" />
            <Field label="Location" icon={MapPin} value={form.location} required onChange={update('location')} suggestions={locations} placeholder="Search or select a location" />
            <Field label="Asset" icon={Boxes} value={form.asset} onChange={updateAsset} suggestions={assetOptions} placeholder="Search asset number or description" />
          </div>
        </Section>

        <Section compact tone="purple" icon={Users} title="Responsibility" note="Requests are assigned to the responsible department">
          <Field label="Department" icon={Users} value={form.department} required onChange={updateDepartment} suggestions={departmentOptions} placeholder="Search or select a department" />
        </Section>

        <Section compact tone="purple" icon={Paperclip} title="Attachments" note="Photos, PDFs and supporting documents">
          <label className="relative flex cursor-pointer items-center justify-center gap-3 rounded-2xl border border-dashed border-[var(--app-line)] bg-[var(--app-table-header-bg)] p-3 text-center text-[var(--app-muted)]">
            <Upload size={18} />
            <strong className="text-sm text-[var(--app-ink)]">Upload attachments</strong>
            <span className="text-xs">Multiple files supported</span>
            <input type="file" multiple onChange={event => {
              const files = Array.from(event.target.files || [])
              setPendingFiles(current => [...current, ...files])
              event.target.value = ''
            }} />
          </label>
          {!!pendingFiles.length && <div className="mt-2 grid gap-2">{pendingFiles.map((file, index) => <div className="app-record-row" key={`${file.name}-${file.size}-${index}`}><span className="truncate text-xs font-bold">{file.name}</span><button type="button" className="app-icon-button" aria-label={`Remove ${file.name}`} onClick={() => setPendingFiles(current => current.filter((_, itemIndex) => itemIndex !== index))}><X size={14} /></button></div>)}</div>}
        </Section>
      </div>

      <ModalFooter>
        <Button variant="outline" onClick={onBack}>Cancel</Button>
        <Button onClick={handlePrimary} disabled={!access.create}><Check size={15} /> Submit request</Button>
      </ModalFooter>
    </ModalPanel>
  )

  return (
    <div className={modal ? 'flex max-h-[88vh] w-full max-w-5xl flex-col overflow-hidden rounded-3xl border border-[var(--app-line)] bg-[var(--app-panel)] shadow-2xl' : 'printable-record'}>
      <div className={modal ? '' : 'print-report-screen space-y-5'}>
        <header className={`${modal ? 'rounded-t-3xl border-b' : 'rounded-3xl border'} border-[var(--app-line)] bg-[var(--app-panel)] p-6 shadow-[0_12px_32px_rgba(32,55,45,.07)]`}>
          <div className="flex items-start justify-between gap-5">
            <div className="min-w-0">
              {!isNew && <button className="mb-4 text-xs font-bold text-[var(--app-muted)] transition hover:text-[var(--app-primary)]" onClick={onBack}>← All Job Requests</button>}
              {!isNew && <p className="text-[9px] font-extrabold uppercase tracking-[.18em] text-[var(--app-muted)]">Job request · {form.requestType?.toUpperCase() || 'SERVICE'}</p>}
              <div className="mt-2 flex flex-wrap items-center gap-3">
                <h1 className="text-3xl font-extrabold text-[var(--app-ink)]">{form.sr === 'AUTO' ? 'New job request' : form.sr}</h1>
                <StatusBadge application="serviceRequest" value={form.status} description={applicationWorkflowLabel(activeWorkflow, form.status)} tone={applicationWorkflowTone(activeWorkflow, form.status)} />
              </div>
              <p className="mt-2 max-w-3xl text-sm text-[var(--app-muted)]">{isNew ? 'Tell us what happened and where.' : form.description}</p>
            </div>

            {isNew ? (
              <button className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-[var(--app-line)] bg-[var(--app-panel)] text-[var(--app-muted)] transition hover:bg-[var(--app-table-hover-bg)] hover:text-[var(--app-ink)]" onClick={onBack} aria-label="Close new job request"><X size={20} /></button>
            ) : (
              <div className="flex flex-wrap items-center justify-end gap-2">
                <Button variant="outline" onClick={() => printWithoutBrowserTitle()}><Printer size={15} /> Print</Button>
                {form.convertedWorkOrder && <Button onClick={() => onOpenWorkOrder(form.convertedWorkOrder, form)}>Open WO #{form.convertedWorkOrder} <ChevronRight size={15} /></Button>}
                {!form.convertedWorkOrder && conversionStep && access.approve && <Button onClick={handlePrimary} disabled={!canConvert}><Check size={15} /> Approve & create CM</Button>}
                {manualNextStep && !conversionStep && access.edit && <Button onClick={handlePrimary}><Check size={15} /> Move to {manualNextStep.stepName}</Button>}
              </div>
            )}
          </div>
        </header>

        {/* The shared detail-tab classes, same as the work order record - and the same meta slot
            on the right, so the facts that never change ride the tab row instead of costing a
            card of their own. */}
        {!isNew && (
          <nav className="app-detail-tabs" role="tablist">
            {tabs.map(([tab, Icon]) => (
              <button
                key={tab}
                type="button"
                className={`app-detail-tab inline-flex items-center gap-2 ${activeTab === tab ? 'app-detail-tab--active' : ''}`}
                onClick={() => setActiveTab(tab)}
                role="tab"
                aria-selected={activeTab === tab}
              >
                <Icon size={14} />
                {tab}
              </button>
            ))}
            <div className="app-detail-tabs-meta">
              <span className="app-detail-date"><span>Reported</span><strong>{form.reportedDate?.replace('T', ' ') || 'Not defined'}</strong></span>
              <span className="app-detail-date"><span>Request Type</span><strong>{form.requestType || 'Service'}</strong></span>
              {form.convertedWorkOrder && (
                <span className="app-detail-date"><span>Work Order</span><strong>{form.convertedWorkOrder}</strong></span>
              )}
            </div>
          </nav>
        )}

        {!isNew && conversionStep && !form.convertedWorkOrder && !canConvert && (
          <Alert
            tone="warning"
            title="Complete required information before CM conversion"
            actions={<Button variant="outline" onClick={() => setActiveTab(form.asset?.trim() ? 'Department Review' : 'Request Details')}>Complete fields <ChevronRight size={14} /></Button>}
          >
            Missing: {missingConversionFields.join(', ')}
          </Alert>
        )}

        <main className={`${modal ? 'overflow-auto' : ''} space-y-5 p-0`}>
          {submitError && (
            <Alert tone="danger" actions={<button className="app-icon-button" onClick={() => setSubmitError('')} aria-label="Dismiss error"><X size={14} /></button>}>{submitError}</Alert>
          )}

          {/* The reported facts share the top row in two columns, then Notes runs the full width
              underneath - the one field still open for editing gets the widest box on the page. */}
          {!isNew && activeTab === 'Request Details' && (
            <div className="grid gap-3">
<<<<<<< HEAD
              <Section compact icon={FileText} title="What happened" note="Reported as submitted - locked once the request exists">
                <div className="grid gap-3 md:grid-cols-3">
                  <Field label="Priority" icon={Flag} value={form.priority} required options={['Low', 'Medium', 'High', 'Emergency']} onChange={update('priority')} disabled={readOnly} />
                  <Field label="Request Type" icon={ClipboardCheck} value={form.requestType} required options={['Corrective', 'Service', 'Inspection']} onChange={update('requestType')} disabled={readOnly} />
                  <Field label="Reported By" icon={User} value={form.reportedBy} required onChange={update('reportedBy')} disabled={readOnly} />
                  <div className="md:col-span-3"><Field label="Description" icon={FileText} value={form.description} required onChange={update('description')} disabled={readOnly} /></div>
                </div>
              </Section>

              <Section compact tone="green" icon={MapPin} title="Where" note="Site, location and the asset involved">
                <div className="grid gap-3 md:grid-cols-3">
                  <Field label="Site" icon={Building2} value={form.site} required onChange={updateSite} suggestions={sites} placeholder="Search or select a site" disabled={readOnly} />
                  <Field label="Location" icon={MapPin} value={form.location} required onChange={update('location')} suggestions={locations} placeholder="Search or select a location" disabled={readOnly} />
                  <Field label="Asset" icon={Boxes} value={form.asset} onChange={updateAsset} suggestions={assetOptions} placeholder="Optional until CM conversion" disabled={readOnly} />
                </div>
              </Section>

              {/* Added after submission, so it stays open for anyone still working the request. */}
              <Section compact tone="purple" icon={ClipboardCheck} title="Notes" note={`Reported ${form.reportedDate?.replace('T', ' ') || 'Not defined'}`}>
                <Field label="Long Description" icon={FileText} value={form.longDescription} type="textarea" onChange={update('longDescription')} disabled={readOnly} />
=======
              <div className="grid items-stretch gap-3 lg:grid-cols-2">
                <Section compact icon={FileText} title="What happened" note="Reported as submitted - locked once the request exists">
                  <div className="grid gap-3 md:grid-cols-2">
                    <Field label="Priority" icon={Flag} value={form.priority} required options={['Low', 'Medium', 'High', 'Emergency']} onChange={update('priority')} disabled={readOnly} />
                    <Field label="Reported By" icon={User} value={form.reportedBy} required onChange={update('reportedBy')} disabled={readOnly} />
                    <div className="md:col-span-2"><Field label="Description" icon={FileText} value={form.description} required onChange={update('description')} disabled={readOnly} /></div>
                  </div>
                </Section>

                <Section compact tone="green" icon={MapPin} title="Where" note="Site, location and the asset involved">
                  <div className="grid gap-3 md:grid-cols-2">
                    <Field label="Site" icon={Building2} value={form.site} required onChange={updateSite} suggestions={sites} placeholder="Search or select a site" disabled={readOnly} />
                    <Field label="Location" icon={MapPin} value={form.location} required onChange={update('location')} suggestions={locations} placeholder="Search or select a location" disabled={readOnly} />
                    <div className="md:col-span-2"><Field label="Asset" icon={Boxes} value={form.asset} required onChange={updateAsset} suggestions={assetOptions} placeholder="Search asset number or description" disabled={readOnly} /></div>
                  </div>
                </Section>
              </div>

              <Section compact tone="purple" icon={ClipboardCheck} title="Notes" note="Detail added while the request is being worked">
                <Field label="Long Description" icon={FileText} value={form.longDescription} type="textarea" onChange={update('longDescription')} />
>>>>>>> 88a983b685086cc52705353286b65c8ba8b867b6
              </Section>
            </div>
          )}

          {!isNew && activeTab === 'Department Review' && (
            <div className="grid items-start gap-3 lg:grid-cols-2">
              {/* Routing is settled when the request is raised - a technician reads it, a role with
                  edit rights can re-route. Classification beside it is the reviewer's own entry. */}
              <Section compact tone="purple" icon={Users} title="Routing" note="Which department owns the work and who it is assigned to">
                <div className="grid gap-3">
                  <Field label="Department" icon={Users} value={form.department} required onChange={updateDepartment} suggestions={departmentOptions} placeholder="Search or select a department" disabled={readOnly} />
                  <Field label="Assigned Department" icon={Users} value={form.assignedDepartment || form.department} required onChange={update('assignedDepartment')} suggestions={departmentOptions} placeholder="Search or select an assigned department" disabled={readOnly} />
                </div>
              </Section>

              <Section compact tone="orange" icon={ShieldCheck} title="Classification" note="Set by the reviewer before the request becomes a work order">
<<<<<<< HEAD
                <div className="grid gap-3 md:grid-cols-2">
                  <Field label="Sub Department" icon={Users} value={form.subDepartment || ''} onChange={update('subDepartment')} suggestions={subDepartmentOptions} placeholder="Optional sub department" disabled={readOnly} />
                  <Field label="Failure Code" icon={ShieldCheck} value={form.failureCode} required onChange={updateFailure} suggestions={failureOptions} placeholder="Search code or description" disabled={readOnly} />
                  <Field label="Problem Code" icon={ShieldCheck} value={form.problemCode || ''} required onChange={update('problemCode')} suggestions={problemOptions} placeholder={form.failureCode ? 'Search matching problem code' : 'Select failure code first'} disabled={readOnly || !form.failureCode} />
=======
                <div className="grid gap-3">
                  <Field label="Sub Department" icon={Users} value={form.subDepartment || ''} required onChange={update('subDepartment')} suggestions={subDepartmentOptions} placeholder="Search or select a sub department" disabled={readOnly} />
                  <Field label="Failure Code" icon={ShieldCheck} value={form.failureCode} required onChange={update('failureCode')} suggestions={failureOptions} placeholder="Search code or description" disabled={readOnly} />
>>>>>>> 88a983b685086cc52705353286b65c8ba8b867b6
                </div>
              </Section>
            </div>
          )}

          {activeTab === 'Attachments' && (
            <Section title="Attachments" note={access.edit ? 'Add photos or documents that help explain the request' : 'Photos and documents attached to this request'}>
              {attachmentError && <Alert className="mb-3" tone="danger">{attachmentError}</Alert>}
              {/* A drop zone that refuses the file it invites you to pick is worse than no drop
                  zone, so a reader gets the list on its own. */}
              {access.edit && (
                <div className="app-upload-zone grid min-h-28 cursor-pointer place-items-center content-center gap-2 rounded-2xl border border-dashed border-[var(--app-line)] bg-[var(--app-table-hover-bg)] p-5 text-center text-[var(--app-muted)]">
                  <Upload size={25} />
                  <strong className="text-sm text-[var(--app-ink)]">Upload attachments</strong>
                  <span className="text-xs">Photos, PDFs and supporting documents · multiple files supported</span>
                  <input type="file" multiple onChange={async event => {
                    const files = Array.from(event.target.files || [])
                    event.target.value = ''
                    if (files.length) await uploadFiles(files, 'General').catch(() => {})
                  }} />
                </div>
              )}
              <div className={`app-record-list ${access.edit ? 'mt-3' : ''}`}>
                {attachments.map(file => <article className="app-record-row" key={file.attachmentId}>
                  <div className="flex min-w-0 items-center gap-3"><FileText size={16} /><div className="min-w-0"><strong className="block truncate text-sm">{file.name}</strong><span className="text-xs text-[var(--app-muted)]">{file.type} - {file.size}</span></div></div>
                  <div className="flex items-center gap-2"><button type="button" className="app-icon-button" aria-label={`Download ${file.name}`} onClick={() => downloadAttachment(file)}><Download size={14} /></button>{access.edit && <button type="button" className="app-icon-button" aria-label={`Remove ${file.name}`} onClick={() => removeAttachment(file)}><X size={14} /></button>}</div>
                </article>)}
                {attachmentsLoading && <p className="app-record-empty">Loading attachments...</p>}
                {!attachmentsLoading && !attachments.length && <p className="app-record-empty">No attachments stored for this request.</p>}
              </div>
            </Section>
          )}
        </main>

      </div>

      {!modal && !isNew && (
        <GenericPrintReport
          reportTitle="Job Request Report"
          reportSubtitle="Service request conversion report"
          number={form.sr}
          status={form.status}
          description={form.description}
          summary={[['Priority', form.priority], ['Site', form.site], ['Department', form.department || 'Pending review']]}
          sections={[
            { title: 'Request Information', rows: [[['Request Number', form.sr], ['Request Type', form.requestType || 'Service'], ['Status', form.status], ['Priority', form.priority]], [['Description', form.description], ['Long Description', form.longDescription], ['Reported By', form.reportedBy], ['Reported Date', form.reportedDate]]] },
            { title: 'Location and Asset', rows: [[['Site', form.site], ['Location', form.location], ['Asset', form.asset], ['Converted Work Order', form.convertedWorkOrder]]] },
            { title: 'Department Review', rows: [[['Department', form.department], ['Sub Department', form.subDepartment], ['Assigned Department', form.assignedDepartment || form.department], ['Failure Code', form.failureCode]], [['Problem Code', form.problemCode]]] }
          ]}
        />
      )}
    </div>
  )
}

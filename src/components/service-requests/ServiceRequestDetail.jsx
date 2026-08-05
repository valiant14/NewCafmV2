import { useState } from 'react'
<<<<<<< HEAD
import { Boxes, Building2, Check, ChevronRight, ClipboardCheck, FileText, Flag, MapPin, Paperclip, Printer, Upload, User, X } from 'lucide-react'
=======
import { Check, ChevronRight, ClipboardCheck, Download, FileText, Paperclip, Printer, Upload, X } from 'lucide-react'
>>>>>>> 3cb7135109fc2dade0f24643689802bdeec1e0c4
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

const tabs = [
  ['Request Details', FileText],
  ['Department Review', ClipboardCheck],
  ['Attachments', Paperclip]
]

export default function ServiceRequestDetail({ request, assets, workOrders, siteRecords = [], departmentRecords = [], failureOptions, onBack, onSubmit, onApprove, onOpenWorkOrder, modal = false, access = {} }) {
  const [form, setForm] = useState(request)
  const [submitError, setSubmitError] = useState('')
  const [activeTab, setActiveTab] = useState('Request Details')
  const [pendingFiles, setPendingFiles] = useState([])

  const isNew = form.status === 'NEW'
  const { attachments, loading: attachmentsLoading, error: attachmentError, uploadFiles, removeAttachment, downloadAttachment } = useEntityAttachments('service-request', form.sr, { enabled: !isNew })
  const canSubmit = Boolean(form.description?.trim() && form.site && form.location && form.reportedBy?.trim())
  const canConvert = Boolean(
    form.asset?.trim() &&
    form.department?.trim() &&
    form.subDepartment?.trim() &&
    (form.assignedDepartment || form.department)?.trim() &&
    form.failureCode?.trim()
  )
  const missingConversionFields = [
    !form.asset?.trim() && 'Asset',
    !form.department?.trim() && 'Department',
    !form.subDepartment?.trim() && 'Sub Department',
    !(form.assignedDepartment || form.department)?.trim() && 'Assigned Department',
    !form.failureCode?.trim() && 'Failure Code'
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

  const handlePrimary = async () => {
    if (isNew && !access.create) return setSubmitError('You do not have create access for Job Requests.')
    if (!isNew && !access.approve) return setSubmitError('You do not have approve access for Job Requests.')
    if (isNew && !canSubmit) return setSubmitError('Complete Description, Site, Location, and Reported By before submitting.')
    if (!isNew && !canConvert) {
      setActiveTab(form.asset?.trim() ? 'Department Review' : 'Request Details')
      return setSubmitError('Complete Asset, Department, Sub Department, Assigned Department, and Failure Code before converting to CM.')
    }
    setSubmitError('')
    try {
      if (isNew) await onSubmit(form, pendingFiles)
      else setForm(await onApprove(form))
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

<<<<<<< HEAD
        <Section compact icon={FileText} title="What happened" note="Describe the problem and how urgent it is">
          <div className="grid gap-3 md:grid-cols-2">
            <Field label="Priority" icon={Flag} value={form.priority} required options={['Low', 'Medium', 'High', 'Emergency']} onChange={update('priority')} />
            <Field label="Reported By" icon={User} value={form.reportedBy} required onChange={update('reportedBy')} />
            <div className="md:col-span-2"><Field label="Description" icon={FileText} value={form.description} type="textarea" required onChange={update('description')} /></div>
          </div>
        </Section>

        <Section compact icon={MapPin} title="Where" note="Site and location are required, asset is optional">
          <div className="grid gap-3 md:grid-cols-3">
            <Field label="Site" icon={Building2} value={form.site} required onChange={updateSite} suggestions={sites} placeholder="Search or select a site" />
            <Field label="Location" icon={MapPin} value={form.location} required onChange={update('location')} suggestions={locations} placeholder="Search or select a location" />
            <Field label="Asset" icon={Boxes} value={form.asset} onChange={updateAsset} suggestions={assetOptions} placeholder="Search asset number or description" />
          </div>
        </Section>

        <Section compact icon={Paperclip} title="Attachments" note="Photos, PDFs and supporting documents">
          {/* A single strip - the file types are named in the section note above, so the drop
              target only needs to be aimable, not tall. */}
          <label className="relative flex cursor-pointer items-center justify-center gap-3 rounded-2xl border border-dashed border-[var(--app-line)] bg-[var(--app-table-header-bg)] p-3 text-center text-[var(--app-muted)]">
            <Upload size={18} />
            <strong className="text-sm text-[var(--app-ink)]">Upload attachments</strong>
            <span className="text-xs">Multiple files supported</span>
            <input className="absolute inset-0 cursor-pointer opacity-0" type="file" multiple />
          </label>
        </Section>
=======
        <div className="grid gap-4 md:grid-cols-2">
          <Field label="Priority" value={form.priority} required options={['Low', 'Medium', 'High', 'Emergency']} onChange={update('priority')} />
          <Field label="Reported By" value={form.reportedBy} required onChange={update('reportedBy')} />
          <div className="md:col-span-2"><Field label="Description" value={form.description} required onChange={update('description')} /></div>
          <Field label="Site" value={form.site} required onChange={updateSite} suggestions={sites} placeholder="Search or select a site" />
          <Field label="Location" value={form.location} required onChange={update('location')} suggestions={locations} placeholder="Search or select a location" />
          <div className="md:col-span-2"><Field label="Asset" value={form.asset} onChange={updateAsset} suggestions={assetOptions} placeholder="Search asset number or description" /></div>
          <div className="md:col-span-2"><Field label="Long Description" value={form.longDescription} type="textarea" onChange={update('longDescription')} /></div>
        </div>

        <div className="mt-5">
          <p className="text-[10px] font-extrabold uppercase tracking-[.12em] text-[var(--app-muted)]">Attachments</p>
          <div className="relative mt-2 grid min-h-28 cursor-pointer place-items-center content-center gap-1.5 rounded-2xl border border-dashed border-[var(--app-line)] bg-[var(--app-table-header-bg)] p-5 text-center text-[var(--app-muted)]">
            <Upload size={22} />
            <strong className="text-sm text-[var(--app-ink)]">Upload attachments</strong>
            <span className="text-xs">Photos, PDFs and supporting documents · multiple files supported</span>
            <input className="absolute inset-0 cursor-pointer opacity-0" type="file" multiple onChange={event => {
              const files = Array.from(event.target.files || [])
              setPendingFiles(current => [...current, ...files])
              event.target.value = ''
            }} />
          </div>
          {!!pendingFiles.length && <div className="mt-2 grid gap-2">{pendingFiles.map((file, index) => <div className="app-record-row" key={`${file.name}-${file.size}-${index}`}><span className="truncate text-xs font-bold">{file.name}</span><button type="button" className="app-icon-button" aria-label={`Remove ${file.name}`} onClick={() => setPendingFiles(current => current.filter((_, itemIndex) => itemIndex !== index))}><X size={14} /></button></div>)}</div>}
        </div>
>>>>>>> 3cb7135109fc2dade0f24643689802bdeec1e0c4
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
                <StatusBadge application="serviceRequest" value={form.status} />
              </div>
              <p className="mt-2 max-w-3xl text-sm text-[var(--app-muted)]">{isNew ? 'Tell us what happened and where.' : form.description}</p>
            </div>

            {isNew ? (
              <button className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-[var(--app-line)] bg-[var(--app-panel)] text-[var(--app-muted)] transition hover:bg-[var(--app-table-hover-bg)] hover:text-[var(--app-ink)]" onClick={onBack} aria-label="Close new job request"><X size={20} /></button>
            ) : (
              <div className="flex flex-wrap items-center justify-end gap-2">
                <Button variant="outline" onClick={() => printWithoutBrowserTitle()}><Printer size={15} /> Print</Button>
                {form.convertedWorkOrder ? (
                  <Button onClick={() => onOpenWorkOrder(form.convertedWorkOrder, form)}>Open WO #{form.convertedWorkOrder} <ChevronRight size={15} /></Button>
                ) : (
                  access.approve && access.edit ? <Button onClick={handlePrimary} disabled={!canConvert}><Check size={15} /> Approve & convert to CM</Button> : null
                )}
              </div>
            )}
          </div>
        </header>

        {!isNew && (
          <nav className="flex flex-wrap gap-2 border-b border-[var(--app-line)]">
            {tabs.map(([tab, Icon]) => (
              <button
                key={tab}
                className={`inline-flex items-center gap-2 px-3 py-3 text-xs transition ${activeTab === tab ? 'font-extrabold text-[var(--app-primary)] shadow-[inset_0_-2px_0_var(--app-primary)]' : 'text-[var(--app-muted)] hover:text-[var(--app-ink)]'}`}
                onClick={() => setActiveTab(tab)}
              >
                <Icon size={14} />
                {tab}
              </button>
            ))}
          </nav>
        )}

        {!isNew && !form.convertedWorkOrder && !canConvert && (
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

          {!isNew && activeTab === 'Request Details' && (
            <Surface>
              <SurfaceHeader eyebrow="Request" title="Request details" description="Issue, location, requester, and linked asset." actions={<Badge tone="neutral">Reported {form.reportedDate?.replace('T', ' ') || 'Not defined'}</Badge>} />

              <div className="grid gap-4 md:grid-cols-2">
                <Field label="Priority" value={form.priority} required options={['Low', 'Medium', 'High', 'Emergency']} onChange={update('priority')} />
                <Field label="Reported By" value={form.reportedBy} required onChange={update('reportedBy')} />
                <Field label="Description" value={form.description} required onChange={update('description')} />
                <Field label="Site" value={form.site} required onChange={updateSite} suggestions={sites} placeholder="Search or select a site" />
                <Field label="Location" value={form.location} required onChange={update('location')} suggestions={locations} placeholder="Search or select a location" />
                <Field label="Asset" value={form.asset} required onChange={updateAsset} suggestions={assetOptions} placeholder="Search asset number or description" />
                <div className="md:col-span-2">
                  <Field label="Long Description" value={form.longDescription} type="textarea" onChange={update('longDescription')} />
                </div>
              </div>
            </Surface>
          )}

          {!isNew && activeTab === 'Department Review' && (
            <Surface>
              <SurfaceHeader eyebrow="Department review" title="Review and CM conversion" description="Complete routing, asset, and failure classification before creating the corrective work order." />

              <div className="grid gap-4 md:grid-cols-2">
                <Field label="Department" value={form.department} required onChange={updateDepartment} suggestions={departmentOptions} placeholder="Search or select a department" />
                <Field label="Sub Department" value={form.subDepartment || ''} required onChange={update('subDepartment')} suggestions={subDepartmentOptions} placeholder="Search or select a sub department" />
                <Field label="Assigned Department" value={form.assignedDepartment || form.department} required onChange={update('assignedDepartment')} suggestions={departmentOptions} placeholder="Search or select an assigned department" />
                <Field label="Failure Code" value={form.failureCode} required onChange={update('failureCode')} suggestions={failureOptions} placeholder="Search code or description" />
              </div>
            </Surface>
          )}

          {activeTab === 'Attachments' && (
            <Section title="Attachments" note="Add photos or documents that help explain the request">
              {attachmentError && <Alert className="mb-3" tone="danger">{attachmentError}</Alert>}
              <div className="relative grid min-h-28 cursor-pointer place-items-center content-center gap-2 rounded-2xl border border-dashed border-[var(--app-line)] bg-[var(--app-table-hover-bg)] p-5 text-center text-[var(--app-muted)]">
                <Upload size={25} />
                <strong className="text-sm text-[var(--app-ink)]">Upload attachments</strong>
                <span className="text-xs">Photos, PDFs and supporting documents · multiple files supported</span>
                <input className="absolute inset-0 cursor-pointer opacity-0" type="file" multiple disabled={!access.edit} onChange={async event => {
                  const files = Array.from(event.target.files || [])
                  event.target.value = ''
                  if (files.length) await uploadFiles(files, 'General').catch(() => {})
                }} />
              </div>
              <div className="mt-3 app-record-list">
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
            { title: 'Department Review', rows: [[['Department', form.department], ['Sub Department', form.subDepartment], ['Assigned Department', form.assignedDepartment || form.department], ['Failure Code', form.failureCode]]] }
          ]}
        />
      )}
    </div>
  )
}

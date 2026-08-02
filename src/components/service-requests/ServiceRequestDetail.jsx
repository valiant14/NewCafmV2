import { useState } from 'react'
import { AlertTriangle, Check, ChevronRight, ClipboardCheck, FileText, Paperclip, Printer, Upload, X } from 'lucide-react'
import Badge from '../ui/Badge'
import Button from '../ui/Button'
import { printWithoutBrowserTitle } from '../../lib/print'
import { Field, Section } from '../ui/FormControls'
import departments from '../../data/departments.json'
import GenericPrintReport from '../ui/GenericPrintReport'
import { statusDescription, statusTone } from '../../lib/statusMatrix'

const tabs = [
  ['Request Details', FileText],
  ['Department Review', ClipboardCheck],
  ['Attachments', Paperclip]
]

export default function ServiceRequestDetail({ request, assets, workOrders, failureOptions, onBack, onSubmit, onApprove, onOpenWorkOrder, modal = false }) {
  const [form, setForm] = useState(request)
  const [submitError, setSubmitError] = useState('')
  const [activeTab, setActiveTab] = useState('Request Details')

  const isNew = form.status === 'NEW'
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
  const sites = [...new Set([...assets.map(asset => String(asset.site)), ...workOrders.map(order => String(order.SITE))].filter(Boolean))].sort()
  const siteAssets = assets.filter(asset => !form.site || String(asset.site) === String(form.site))
  const assetOptions = siteAssets.map(asset => ({ value: asset.assetnum, label: asset.description?.trim() }))
  const locations = [...new Set([...siteAssets.map(asset => asset.location), ...workOrders.filter(order => !form.site || String(order.SITE) === String(form.site)).map(order => order['LOCATION '])].filter(Boolean))].sort()
  const departmentOptions = departments.map(department => ({ value: department.name, label: department.code }))
  const selectedDepartment = departments.find(department => department.name === form.department)
  const subDepartmentOptions = (selectedDepartment?.subDepartments || departments.flatMap(department => department.subDepartments)).map(sub => ({ value: sub.name, label: sub.code }))

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

  const handlePrimary = () => {
    if (isNew && !canSubmit) return setSubmitError('Complete Description, Site, Location, and Reported By before submitting.')
    if (!isNew && !canConvert) {
      setActiveTab(form.asset?.trim() ? 'Department Review' : 'Request Details')
      return setSubmitError('Complete Asset, Department, Sub Department, Assigned Department, and Failure Code before converting to CM.')
    }
    setSubmitError('')
    if (isNew) onSubmit(form)
    else setForm(onApprove(form))
  }

  return (
    <div className={modal ? 'flex max-h-[88vh] w-full max-w-5xl flex-col overflow-hidden rounded-3xl border border-[var(--app-line)] bg-[var(--app-panel)] shadow-2xl' : 'printable-record'}>
      <div className={modal ? '' : 'print-report-screen space-y-5'}>
        <header className={`${modal ? 'rounded-t-3xl border-b' : 'rounded-3xl border'} border-[var(--app-line)] bg-[var(--app-panel)] p-6 shadow-[0_12px_32px_rgba(32,55,45,.07)]`}>
          <div className="flex items-start justify-between gap-5">
            <div className="min-w-0">
              {!isNew && <button className="mb-4 text-xs font-bold text-[var(--app-muted)] transition hover:text-[var(--app-primary)]" onClick={onBack}>← All Job Requests</button>}
              {!isNew && <p className="text-[9px] font-extrabold uppercase tracking-[.18em] text-[var(--app-muted)]">Job request · {form.requestType?.toUpperCase() || 'SERVICE'}</p>}
              <div className="mt-2 flex flex-wrap items-center gap-3">
                <h1 className="text-3xl font-extrabold tracking-[-.045em] text-[var(--app-ink)]">{form.sr === 'AUTO' ? 'New job request' : form.sr}</h1>
                <Badge tone={statusTone(form.status)}>{form.status} · {statusDescription('serviceRequest', form.status)}</Badge>
              </div>
              <p className="mt-2 max-w-3xl text-sm text-[var(--app-muted)]">{isNew ? 'Tell us what happened and where.' : form.description}</p>
            </div>

            {isNew ? (
              <button className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-[var(--app-line)] bg-[var(--app-panel)] text-[var(--app-muted)] transition hover:bg-[var(--app-table-hover-bg)] hover:text-[var(--app-ink)]" onClick={onBack} aria-label="Close new job request"><X size={20} /></button>
            ) : (
              <div className="flex flex-wrap items-center justify-end gap-2">
                <Button variant="outline" onClick={() => printWithoutBrowserTitle()}><Printer size={15} /> Print</Button>
                {form.status === 'RESOLVED' && form.convertedWorkOrder ? (
                  <Button onClick={() => onOpenWorkOrder(form.convertedWorkOrder)}>Open WO #{form.convertedWorkOrder} <ChevronRight size={15} /></Button>
                ) : (
                  <Button onClick={handlePrimary} disabled={!canConvert}><Check size={15} /> Approve & convert to CM</Button>
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

        {!isNew && form.status !== 'RESOLVED' && !canConvert && (
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-orange-200 bg-orange-50 p-4 text-orange-800">
            <div className="flex items-center gap-3">
              <AlertTriangle size={18} />
              <div>
                <strong>Complete required information before CM conversion</strong>
                <span className="block text-xs">Missing: {missingConversionFields.join(', ')}</span>
              </div>
            </div>
            <Button variant="outline" onClick={() => setActiveTab(form.asset?.trim() ? 'Department Review' : 'Request Details')}>Complete fields <ChevronRight size={14} /></Button>
          </div>
        )}

        <main className={`${modal ? 'overflow-auto' : ''} space-y-5 p-0`}>
          {submitError && (
            <div className="flex items-center justify-between gap-3 rounded-2xl border border-orange-200 bg-orange-50 p-4 text-orange-800">
              <div className="flex items-center gap-2"><AlertTriangle size={17} /><span>{submitError}</span></div>
              <button onClick={() => setSubmitError('')}><X size={14} /></button>
            </div>
          )}

          {isNew && (
            <Section title="" note="">
              <div className="grid gap-4 md:grid-cols-2">
                <Field label="Priority" value={form.priority} required options={['Low', 'Medium', 'High', 'Emergency']} onChange={update('priority')} />
                <Field label="Description" value={form.description} required onChange={update('description')} />
                <Field label="Site" value={form.site} required onChange={updateSite} suggestions={sites} placeholder="Search or select a site" />
                <Field label="Location" value={form.location} required onChange={update('location')} suggestions={locations} placeholder="Search or select a location" />
                <Field label="Asset" value={form.asset} onChange={updateAsset} suggestions={assetOptions} placeholder="Search asset number or description" />
                <Field label="Long Description" value={form.longDescription} type="textarea" onChange={update('longDescription')} />
                <Field label="Reported By" value={form.reportedBy} required onChange={update('reportedBy')} />
              </div>
            </Section>
          )}

          {!isNew && activeTab === 'Request Details' && (
            <section className="rounded-3xl border border-[var(--app-line)] bg-[var(--app-panel)] p-5 shadow-[0_8px_24px_rgba(32,55,45,.06)]">
              <div className="mb-5 flex flex-wrap items-end justify-between gap-3 border-b border-[var(--app-line)] pb-4">
                <div>
                  <h2 className="text-lg font-extrabold text-[var(--app-ink)]">Request details</h2>
                  <p className="mt-1 text-sm text-[var(--app-muted)]">Issue, location, requester, and linked asset in one clean view.</p>
                </div>
                <div className="rounded-2xl bg-[var(--app-table-hover-bg)] px-3 py-2 text-xs font-bold text-[var(--app-muted)]">
                  Reported: <span className="text-[var(--app-ink)]">{form.reportedDate?.replace('T', ' · ') || 'Not defined'}</span>
                </div>
              </div>

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
            </section>
          )}

          {!isNew && activeTab === 'Department Review' && (
            <section className="rounded-3xl border border-[var(--app-line)] bg-[var(--app-panel)] p-5 shadow-[0_8px_24px_rgba(32,55,45,.06)]">
              <div className="mb-5 border-b border-[var(--app-line)] pb-4">
                <h2 className="text-lg font-extrabold text-[var(--app-ink)]">Review and CM conversion</h2>
                <p className="mt-1 text-sm text-[var(--app-muted)]">Complete routing, asset, and failure classification before creating the corrective work order.</p>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <Field label="Department" value={form.department} required onChange={updateDepartment} suggestions={departmentOptions} placeholder="Search or select a department" />
                <Field label="Sub Department" value={form.subDepartment || ''} required onChange={update('subDepartment')} suggestions={subDepartmentOptions} placeholder="Search or select a sub department" />
                <Field label="Assigned Department" value={form.assignedDepartment || form.department} required onChange={update('assignedDepartment')} suggestions={departmentOptions} placeholder="Search or select an assigned department" />
                <Field label="Failure Code" value={form.failureCode} required onChange={update('failureCode')} suggestions={failureOptions} placeholder="Search code or description" />
              </div>
            </section>
          )}

          {(isNew || activeTab === 'Attachments') && (
            <Section title="Attachments" note="Add photos or documents that help explain the request">
              <div className="relative grid min-h-28 cursor-pointer place-items-center content-center gap-2 rounded-2xl border border-dashed border-[var(--app-line)] bg-[var(--app-table-hover-bg)] p-5 text-center text-[var(--app-muted)]">
                <Upload size={25} />
                <strong className="text-sm text-[var(--app-ink)]">Upload attachments</strong>
                <span className="text-xs">Photos, PDFs and supporting documents · multiple files supported</span>
                <input className="absolute inset-0 cursor-pointer opacity-0" type="file" multiple />
              </div>
            </Section>
          )}
        </main>

        {isNew && (
          <footer className="sticky bottom-0 flex items-center justify-end gap-2 border-t border-[var(--app-line)] bg-[var(--app-panel)] p-5">
            <Button variant="outline" onClick={onBack}>Cancel</Button>
            <Button onClick={handlePrimary}><Check size={15} /> Submit request</Button>
          </footer>
        )}
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

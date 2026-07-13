import { useState } from 'react'
import { AlertTriangle, Building2, CalendarClock, Check, ChevronRight, MapPin, Printer, Upload, UserRound, X } from 'lucide-react'
import Badge from '../ui/Badge'
import Button from '../ui/Button'
import { Field, Section } from '../ui/FormControls'
import departments from '../../data/departments.json'

export default function ServiceRequestDetail({ request, assets, workOrders, failureOptions, onBack, onSubmit, onApprove, onOpenWorkOrder, modal = false }) {
  const [form, setForm] = useState(request)
  const [submitError, setSubmitError] = useState('')
  const [activeTab, setActiveTab] = useState('Request Details')
  const isNew = form.status === 'NEW'
  const canSubmit = Boolean(form.description?.trim() && form.site && form.location && form.reportedBy?.trim())
  const canConvert = Boolean(form.asset?.trim() && form.department?.trim() && form.subDepartment?.trim() && (form.assignedDepartment || form.department)?.trim() && form.failureCode?.trim())
  const missingConversionFields = [!form.asset?.trim() && 'Asset', !form.department?.trim() && 'Department', !form.subDepartment?.trim() && 'Sub Department', !(form.assignedDepartment || form.department)?.trim() && 'Assigned Department', !form.failureCode?.trim() && 'Failure Code'].filter(Boolean)
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
    setForm({ ...form, asset: value, location: match?.location || form.location, site: match?.site ? String(match.site) : form.site })
  }
  const updateDepartment = event => setForm({ ...form, department: event.target.value, subDepartment: '', assignedDepartment: form.assignedDepartment || event.target.value })
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
    <div className={modal ? 'flex max-h-[88vh] w-full max-w-5xl flex-col overflow-hidden rounded-3xl border border-[var(--app-line)] bg-[var(--app-panel)] shadow-2xl' : 'space-y-5'}>
      <header className={`${modal ? 'rounded-t-3xl border-b' : 'rounded-3xl border'} border-[var(--app-line)] bg-[var(--app-panel)] p-6 shadow-[0_12px_32px_rgba(32,55,45,.07)]`}>
        <div className="flex items-start justify-between gap-5">
          <div className="min-w-0">
            {!isNew && <button className="mb-4 text-xs font-bold text-[#577066] transition hover:text-[var(--app-primary)]" onClick={onBack}>← All Job Requests</button>}
            {!isNew && <p className="text-[9px] font-extrabold uppercase tracking-[.18em] text-[#7a8780]">JOB REQUEST · {form.requestType?.toUpperCase()}</p>}
            <div className="mt-2 flex flex-wrap items-center gap-3">
              <h1 className="text-3xl font-extrabold tracking-[-.045em] text-[var(--app-ink)]">{form.sr === 'AUTO' ? 'New job request' : form.sr}</h1>
              <Badge tone={form.status === 'CONVERTED' ? 'green' : 'orange'}>{form.status}</Badge>
            </div>
            <p className="mt-2 text-sm text-[var(--app-muted)]">{isNew ? 'Tell us what happened and where.' : form.description}</p>
          </div>
          {isNew ? (
            <button className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-[var(--app-line)] bg-[var(--app-panel)] text-[var(--app-muted)] transition hover:bg-[var(--app-table-hover-bg)] hover:text-[var(--app-ink)]" onClick={onBack} aria-label="Close new job request"><X size={20} /></button>
          ) : (
            <div className="flex flex-wrap items-center gap-2">
              <Button variant="outline"><Printer size={15} /> Print</Button>
              {form.status === 'CONVERTED' && form.convertedWorkOrder ? (
                <Button onClick={() => onOpenWorkOrder(form.convertedWorkOrder)}>Open WO #{form.convertedWorkOrder} <ChevronRight size={15} /></Button>
              ) : (
                <Button onClick={handlePrimary} disabled={!canConvert}><Check size={15} />Approve & convert to CM</Button>
              )}
            </div>
          )}
        </div>
      </header>

      {!isNew && (
        <div className="grid gap-3 rounded-3xl border border-[var(--app-line)] bg-white p-4 shadow-[0_8px_24px_rgba(32,55,45,.05)] md:grid-cols-5">
          {[
            ['Priority', form.priority, AlertTriangle],
            ['Site & location', `${form.site} · ${form.location}`, MapPin],
            ['Reported by', form.reportedBy, UserRound],
            ['Department', form.department || 'Pending review', Building2],
            ['Reported', form.reportedDate?.replace('T', ' · '), CalendarClock]
          ].map(([label, value, Icon]) => (
            <div key={label} className="rounded-2xl bg-[#f8faf7] p-3">
              <Icon className="mb-2 text-[#60766b]" size={16} />
              <span className="text-[9px] font-extrabold uppercase tracking-[.12em] text-[#7b8780]">{label}</span>
              <strong className="mt-1 block text-xs text-[var(--app-ink)]">{value}</strong>
            </div>
          ))}
        </div>
      )}

      {!isNew && <nav className="flex gap-1 border-b border-[var(--app-line)]">{['Request Details', 'Attachments', 'Department Review'].map(tab => <button key={tab} className={`relative px-3 py-3 text-[11px] ${activeTab === tab ? 'font-bold text-[#315a47] after:absolute after:bottom-[-1px] after:left-2 after:right-2 after:h-0.5 after:bg-[#477e63]' : 'text-[#7a847e]'}`} onClick={() => setActiveTab(tab)}>{tab}</button>)}</nav>}

      {!isNew && form.status !== 'CONVERTED' && !canConvert && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-[#f0d4bd] bg-[#fff7ef] p-4 text-[#9a5a2f]">
          <div className="flex items-center gap-3"><AlertTriangle size={18} /><div><strong>Complete required information before CM conversion</strong><span className="block text-xs">Missing: {missingConversionFields.join(', ')}</span></div></div>
          <Button variant="outline" onClick={() => setActiveTab(form.asset?.trim() ? 'Department Review' : 'Request Details')}>Complete fields <ChevronRight size={14} /></Button>
        </div>
      )}

      <main className={`${modal ? 'overflow-auto' : ''} space-y-5 p-0`}>
        {submitError && <div className="flex items-center justify-between gap-3 rounded-2xl border border-[#f0d4bd] bg-[#fff7ef] p-4 text-[#9a5a2f]"><div className="flex items-center gap-2"><AlertTriangle size={17} /><span>{submitError}</span></div><button onClick={() => setSubmitError('')}><X size={14} /></button></div>}

        {isNew && <Section title="" note=""><div className="grid gap-4 md:grid-cols-2">
          <Field label="Priority" value={form.priority} required options={['Low', 'Medium', 'High', 'Emergency']} onChange={update('priority')} />
          <Field label="Description" value={form.description} required onChange={update('description')} />
          <Field label="Site" value={form.site} required onChange={updateSite} suggestions={sites} placeholder="Search or select a site" />
          <Field label="Location" value={form.location} required onChange={update('location')} suggestions={locations} placeholder="Search or select a location" />
          <Field label="Asset" value={form.asset} onChange={updateAsset} suggestions={assetOptions} placeholder="Search asset number or description" />
          <Field label="Long Description" value={form.longDescription} type="textarea" onChange={update('longDescription')} />
          <Field label="Reported By" value={form.reportedBy} required onChange={update('reportedBy')} />
        </div></Section>}

        {!isNew && activeTab === 'Request Details' && <div className="grid gap-5 lg:grid-cols-[1fr_360px]">
          <section className="rounded-3xl border border-[var(--app-line)] bg-white p-5 shadow-[0_8px_24px_rgba(32,55,45,.06)]"><span className="text-[9px] font-extrabold uppercase tracking-[.16em] text-[#7b8780]">Reported issue</span><h2 className="mt-2 text-xl font-extrabold text-[var(--app-ink)]">{form.description}</h2><p className="mt-3 text-sm text-[var(--app-muted)]">{form.longDescription || 'No additional description was provided.'}</p></section>
          <aside className="rounded-3xl border border-[var(--app-line)] bg-white p-5 shadow-[0_8px_24px_rgba(32,55,45,.06)]"><h3 className="font-extrabold text-[var(--app-ink)]">Job request information</h3><dl className="mt-4 grid gap-3">{[['Priority', form.priority], ['Site', form.site], ['Location', form.location], ['Request type', 'Service']].map(([label, value]) => <div className="rounded-2xl bg-[#f8faf7] p-3" key={label}><dt className="text-[9px] font-extrabold uppercase tracking-[.12em] text-[#7b8780]">{label}</dt><dd className="mt-1 text-sm font-bold text-[var(--app-ink)]">{value}</dd></div>)}</dl></aside>
          <section className="rounded-3xl border border-[var(--app-line)] bg-white p-5 shadow-[0_8px_24px_rgba(32,55,45,.06)] lg:col-span-2"><div className="grid gap-4 lg:grid-cols-[1fr_360px] lg:items-end"><div><strong className="text-[var(--app-ink)]">{form.asset ? 'Linked asset' : 'Link an asset'}</strong><p className="mt-1 text-sm text-[var(--app-muted)]">{form.asset ? 'This request is ready for technical classification.' : 'An asset must be linked before this request can be converted to CM.'}</p></div><Field label="Asset" value={form.asset} required onChange={updateAsset} suggestions={assetOptions} placeholder="Search asset number or description" /></div></section>
        </div>}

        {(isNew || activeTab === 'Attachments') && <Section title="Attachments" note="Add photos or documents that help explain the request"><div className="relative grid min-h-28 cursor-pointer place-items-center content-center gap-2 rounded-2xl border border-dashed border-[#bfc9c1] bg-[#f8faf7] p-5 text-center text-[#728078]"><Upload size={25} /><strong className="text-sm text-[var(--app-ink)]">Upload attachments</strong><span className="text-xs">Photos, PDFs and supporting documents · multiple files supported</span><input className="absolute inset-0 cursor-pointer opacity-0" type="file" multiple /></div></Section>}

        {!isNew && activeTab === 'Department Review' && <div className="grid gap-5 lg:grid-cols-2">
          <section className="rounded-3xl border border-[var(--app-line)] bg-white p-5 shadow-[0_8px_24px_rgba(32,55,45,.06)]"><h3 className="font-extrabold text-[var(--app-ink)]">Work routing</h3><p className="mt-1 text-sm text-[var(--app-muted)]">Choose the teams responsible for reviewing and executing the work.</p><div className="mt-5 grid gap-4"><Field label="Department" value={form.department} required onChange={updateDepartment} suggestions={departmentOptions} placeholder="Search or select a department" /><Field label="Assigned Department" value={form.assignedDepartment || form.department} required onChange={update('assignedDepartment')} suggestions={departmentOptions} placeholder="Search or select an assigned department" /></div></section>
          <section className="rounded-3xl border border-[var(--app-line)] bg-white p-5 shadow-[0_8px_24px_rgba(32,55,45,.06)]"><h3 className="font-extrabold text-[var(--app-ink)]">Technical classification</h3><p className="mt-1 text-sm text-[var(--app-muted)]">Classify the maintenance discipline and reported failure.</p><div className="mt-5 grid gap-4"><Field label="Sub Department" value={form.subDepartment || ''} required onChange={update('subDepartment')} suggestions={subDepartmentOptions} placeholder="Search or select a sub department" /><Field label="Failure Code" value={form.failureCode} required onChange={update('failureCode')} suggestions={failureOptions} placeholder="Search code or description" /></div></section>
        </div>}
      </main>

      {isNew && <footer className="sticky bottom-0 flex items-center justify-end gap-2 border-t border-[var(--app-line)] bg-[var(--app-panel)] p-5"><Button variant="outline" onClick={onBack}>Cancel</Button><Button onClick={handlePrimary}><Check size={15} />Submit request</Button></footer>}
    </div>
  )
}

import { useState } from 'react'
import { AlertTriangle, Check, Plus, X } from 'lucide-react'
import Button from '../ui/Button'
import { Field, Section } from '../ui/FormControls'

export default function CreateWorkOrderModal({ rows, assets, onCancel, onCreate }) {
  const [form, setForm] = useState({ type: 'CM', description: '', priority: '3', site: '', location: '', asset: '' })
  const [error, setError] = useState('')
  const update = key => event => setForm({ ...form, [key]: event.target.value })
  const sites = [...new Set([...assets.map(asset => String(asset.site)), ...rows.map(order => String(order.SITE))].filter(Boolean))].sort()
  const siteAssets = assets.filter(asset => !form.site || String(asset.site) === form.site)
  const assetOptions = siteAssets.map(asset => ({ value: asset.assetnum, label: asset.description?.trim() }))
  const locations = [...new Set([...siteAssets.map(asset => asset.location), ...rows.filter(order => !form.site || String(order.SITE) === form.site).map(order => order['LOCATION '])].filter(Boolean))].sort()
  const changeSite = event => setForm({ ...form, site: event.target.value, location: '', asset: '' })
  const changeAsset = event => {
    const value = event.target.value
    const match = assets.find(asset => asset.assetnum === value)
    setForm({ ...form, asset: value, location: match?.location || form.location, site: match?.site ? String(match.site) : form.site })
  }
  const submit = () => {
    if (!form.description.trim() || !form.site || !form.location || !form.asset) return setError('Complete Description, Site, Location, and Asset before creating the work order.')
    onCreate(form)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center overflow-auto bg-[#112219]/70 p-6 backdrop-blur-sm">
      <section className="flex max-h-[88vh] w-full max-w-4xl flex-col overflow-hidden rounded-3xl border border-[#dfe6df] bg-[#fbfcfa] shadow-2xl">
        <header className="flex items-start justify-between gap-4 border-b border-[var(--app-line)] bg-white px-7 py-6">
          <div>
            <span className="text-[9px] font-extrabold uppercase tracking-[.18em] text-[#60756b]">NEW MAINTENANCE RECORD</span>
            <h2 className="mt-1 text-2xl font-extrabold tracking-[-.04em] text-[var(--app-ink)]">Create work order</h2>
            <p className="mt-1 text-sm text-[var(--app-muted)]">Start with the essential information. Configure execution details after creation.</p>
          </div>
          <button className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-[#dfe5df] bg-white text-[#617067]" onClick={onCancel}><X size={20} /></button>
        </header>

        <div className="overflow-auto px-7 py-6">
          {error && <div className="mb-5 flex items-center justify-between gap-3 rounded-2xl border border-[#f0d4bd] bg-[#fff7ef] p-4 text-[#9a5a2f]"><div className="flex items-center gap-2"><AlertTriangle size={17} /><span>{error}</span></div><button onClick={() => setError('')}><X size={14} /></button></div>}
          <Section title="Core Information" note="Required to create the work order">
            <div className="grid gap-4 md:grid-cols-2">
              <Field label="Work Type" value={form.type} required options={['CM', 'Incident']} onChange={update('type')} />
              <Field label="Priority" value={form.priority} required options={['1 - Emergency', '2 - High', '3 - Medium', '4 - Low']} onChange={update('priority')} />
              <div className="md:col-span-2"><Field label="Description" value={form.description} required onChange={update('description')} /></div>
              <Field label="Site" value={form.site} required onChange={changeSite} suggestions={sites} placeholder="Search or select a site" />
              <Field label="Location" value={form.location} required onChange={update('location')} suggestions={locations} placeholder="Search or select a location" />
              <div className="md:col-span-2"><Field label="Asset" value={form.asset} required onChange={changeAsset} suggestions={assetOptions} placeholder="Search asset number or description" /></div>
            </div>
          </Section>
          <div className="mt-5 flex gap-3 rounded-2xl border border-[#dce8df] bg-[#f1f8f3] p-4 text-[#315a47]"><Check size={17} /><div><strong>Configure after creation</strong><span className="block text-xs">Assignment, planning, failure codes, materials, PTW, actuals, meters, and closeout remain inside Work Order Details.</span></div></div>
        </div>

        <footer className="flex items-center justify-end gap-2 border-t border-[var(--app-line)] bg-white px-7 py-4">
          <Button variant="outline" onClick={onCancel}>Cancel</Button>
          <Button onClick={submit}><Plus size={15} />Create work order</Button>
        </footer>
      </section>
    </div>
  )
}

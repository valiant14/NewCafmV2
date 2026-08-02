import { useState } from 'react'
import { AlertTriangle, Check, Plus, X } from 'lucide-react'
import Button from '../ui/Button'
import { Field } from '../ui/FormControls'
import { ModalFooter, ModalHeader, ModalOverlay, ModalPanel } from '../ui/ModalFrame'

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
    <ModalOverlay>
      <ModalPanel className="max-w-4xl" labelledBy="create-work-order-title">
        <ModalHeader
          eyebrow="NEW MAINTENANCE RECORD"
          title="Create work order"
          titleId="create-work-order-title"
          description="Start with the essential information. Configure execution details after creation."
          onClose={onCancel}
        />

        <div className="overflow-auto px-6 py-5">
          {error && <div className="mb-5 flex items-center justify-between gap-3 rounded-2xl border border-orange-200 bg-orange-50 p-4 text-orange-800"><div className="flex items-center gap-2"><AlertTriangle size={17} /><span>{error}</span></div><button onClick={() => setError('')}><X size={14} /></button></div>}
          <div className="grid gap-4 md:grid-cols-2">
            <Field label="Work Type" value={form.type} required options={['CM']} onChange={update('type')} />
            <Field label="Priority" value={form.priority} required options={['1 - Emergency', '2 - High', '3 - Medium', '4 - Low']} onChange={update('priority')} />
            <div className="md:col-span-2"><Field label="Description" value={form.description} required onChange={update('description')} /></div>
            <Field label="Site" value={form.site} required onChange={changeSite} suggestions={sites} placeholder="Search or select a site" />
            <Field label="Location" value={form.location} required onChange={update('location')} suggestions={locations} placeholder="Search or select a location" />
            <div className="md:col-span-2"><Field label="Asset" value={form.asset} required onChange={changeAsset} suggestions={assetOptions} placeholder="Search asset number or description" /></div>
          </div>
          <div className="mt-5 flex gap-3 rounded-2xl border border-[var(--app-line)] bg-[var(--app-table-header-bg)] p-4 text-[var(--app-ink)]"><Check size={17} className="text-[var(--app-primary)]" /><div><strong>Configure after creation</strong><span className="block text-xs text-[var(--app-muted)]">Assignment, planning, failure codes, materials, PTW, actuals, meters, and closeout remain inside Work Order Details.</span></div></div>
        </div>

        <ModalFooter>
          <Button variant="outline" onClick={onCancel}>Cancel</Button>
          <Button onClick={submit}><Plus size={15} />Create work order</Button>
        </ModalFooter>
      </ModalPanel>
    </ModalOverlay>
  )
}

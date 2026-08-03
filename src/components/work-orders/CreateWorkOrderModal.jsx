import { useState } from 'react'
import { AlertTriangle, Check, Plus, X } from 'lucide-react'
import Button from '../ui/Button'
import { Field } from '../ui/FormControls'
import { ModalFooter, ModalHeader, ModalOverlay, ModalPanel } from '../ui/ModalFrame'
import { sameDepartment } from '../../lib/departments'
import { deriveDepartmentOptions, deriveSiteOptions } from '../../lib/referenceFallbacks'
import { useAuth } from '../../providers/AuthProvider'

const workTypes = ['CM', 'PM', 'Incident']
const priorities = ['1 - Emergency', '2 - High', '3 - Medium', '4 - Low']

export default function CreateWorkOrderModal({ rows, assets, locationRows = [], siteRecords = [], departmentRecords = [], onCancel, onCreate }) {
  const [form, setForm] = useState({ type: 'CM', description: '', priority: priorities[2], site: '', location: '', asset: '', department: '', subDepartment: '' })
  const [error, setError] = useState('')
  const { user } = useAuth()
  const update = key => event => setForm({ ...form, [key]: event.target.value })
  const sites = deriveSiteOptions({ siteRecords, user, locations: locationRows, assets, orders: rows })
  const siteAssets = assets.filter(asset => !form.site || String(asset.site) === form.site)
  const assetOptions = siteAssets.map(asset => ({ value: asset.assetnum, label: asset.description?.trim() }))
  const siteLocations = locationRows.filter(location => !form.site || String(location.site) === form.site)
  const locations = [...new Set([
    ...siteLocations.map(location => location.location),
    ...siteAssets.map(asset => asset.location),
    ...rows.filter(order => !form.site || String(order.SITE) === form.site).map(order => order['LOCATION '])
  ].filter(Boolean))].sort()
  const departmentOptions = deriveDepartmentOptions({ departmentRecords, user, assets, orders: rows, locations: locationRows })
  const subDepartmentOptions = departmentRecords
    .filter(department => department.status !== 'Inactive' && sameDepartment(department.department, form.department))
    .map(department => ({ value: department.subDepartmentCode, label: department.description }))
  const changeSite = event => setForm({ ...form, site: event.target.value, location: '', asset: '' })
  const changeAsset = event => {
    const value = event.target.value
    const match = assets.find(asset => asset.assetnum === value)
    setForm({
      ...form,
      asset: value,
      location: match?.location || form.location,
      site: match?.site ? String(match.site) : form.site,
      department: form.department || match?.department || ''
    })
  }
  // Changing department invalidates the sub-department beneath it.
  const changeDepartment = event => setForm({ ...form, department: event.target.value, subDepartment: '' })

  const missing = [
    !form.description.trim() && 'Description',
    !form.site && 'Site',
    !form.location && 'Location',
    !form.department && 'Department'
  ].filter(Boolean)

  const submit = () => {
    if (missing.length) return setError(`Complete ${missing.join(', ')} before creating the work order.`)
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
            <Field label="Work Type" value={form.type} required options={workTypes} onChange={update('type')} />
            <Field label="Priority" value={form.priority} required options={priorities} onChange={update('priority')} />
            <div className="md:col-span-2"><Field label="Description" value={form.description} required onChange={update('description')} /></div>
            <Field label="Site" value={form.site} required onChange={changeSite} suggestions={sites} placeholder="Search or select a site" />
            <Field label="Location" value={form.location} required onChange={update('location')} suggestions={locations} placeholder="Search or select a location" />
            <div className="md:col-span-2"><Field label="Asset" value={form.asset} onChange={changeAsset} suggestions={assetOptions} placeholder={assetOptions.length ? 'Search asset number or description' : 'Optional - no scoped assets available'} /></div>
            <Field label="Department" value={form.department} required onChange={changeDepartment} suggestions={departmentOptions} placeholder="Search department" />
            <Field label="Sub Department" value={form.subDepartment} onChange={update('subDepartment')} suggestions={subDepartmentOptions} placeholder={form.department ? 'Search sub department' : 'Select department first'} />
          </div>
          <div className="mt-5 flex gap-3 rounded-2xl border border-[var(--app-line)] bg-[var(--app-table-header-bg)] p-4 text-[var(--app-ink)]"><Check size={17} className="text-[var(--app-primary)]" /><div><strong>Configure after creation</strong><span className="block text-xs text-[var(--app-muted)]">Target dates, planning, failure codes, materials, PTW, actuals, meters, and closeout remain inside Work Order Details.</span></div></div>
        </div>

        <ModalFooter>
          <Button variant="outline" onClick={onCancel}>Cancel</Button>
          <Button onClick={submit}><Plus size={15} />Create work order</Button>
        </ModalFooter>
      </ModalPanel>
    </ModalOverlay>
  )
}

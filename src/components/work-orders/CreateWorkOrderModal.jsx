import { useState } from 'react'
import { Boxes, Building2, Check, ClipboardList, FileText, Flag, MapPin, Plus, Users, Wrench, X } from 'lucide-react'
import Button from '../ui/Button'
import Alert from '../ui/Alert'
import { Field, Section } from '../ui/FormControls'
import { ModalFooter, ModalHeader, ModalOverlay, ModalPanel } from '../ui/ModalFrame'
import { sameDepartment } from '../../lib/departments'
import { deriveDepartmentOptions, deriveSiteOptions } from '../../lib/referenceFallbacks'
import { useAuth } from '../../providers/AuthProvider'
import { workOrderPriorities } from '../../lib/priority'

const workTypes = ['CM', 'PM', 'Incident']
const priorities = workOrderPriorities

export default function CreateWorkOrderModal({ rows, assets, locationRows = [], siteRecords = [], departmentRecords = [], onCancel, onCreate }) {
  // The priority is stored as its code, so the form holds '3' rather than '3 - Medium'.
  const [form, setForm] = useState({ type: 'CM', description: '', priority: priorities[2].value, site: '', location: '', asset: '', department: '', subDepartment: '' })
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

  const submit = async () => {
    if (missing.length) return setError(`Complete ${missing.join(', ')} before creating the work order.`)
    try {
      await onCreate(form)
    } catch (error) {
      setError(error.message || 'Unable to create work order.')
    }
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

        {/* Same three-section shape as the job request intake: what the job is, where it is, and
            who owns it. Sections and field icons come from the shared components. */}
        <div className="grid gap-2 overflow-auto px-6 py-3">
          {error && <Alert tone="danger" actions={<button className="app-icon-button" onClick={() => setError('')} aria-label="Dismiss error"><X size={14} /></button>}>{error}</Alert>}

          <Section compact icon={ClipboardList} title="Work details" note="What needs doing and how urgent it is">
            <div className="grid gap-3 md:grid-cols-2">
              <Field label="Work Type" icon={Wrench} value={form.type} required options={workTypes} onChange={update('type')} />
              <Field label="Priority" icon={Flag} value={form.priority} required options={priorities} onChange={update('priority')} />
              <div className="md:col-span-2"><Field label="Description" icon={FileText} value={form.description} required onChange={update('description')} /></div>
            </div>
          </Section>

          <Section compact tone="green" icon={MapPin} title="Where" note="Site and location are required, asset is optional">
            <div className="grid gap-3 md:grid-cols-3">
              <Field label="Site" icon={Building2} value={form.site} required onChange={changeSite} suggestions={sites} placeholder="Search or select a site" />
              <Field label="Location" icon={MapPin} value={form.location} required onChange={update('location')} suggestions={locations} placeholder="Search or select a location" />
              <Field label="Asset" icon={Boxes} value={form.asset} onChange={changeAsset} suggestions={assetOptions} placeholder={assetOptions.length ? 'Search asset number or description' : 'Optional - no scoped assets available'} />
            </div>
          </Section>

          <Section compact tone="purple" icon={Users} title="Ownership" note="Department responsible for the work">
            <div className="grid gap-3 md:grid-cols-2">
              <Field label="Department" icon={Users} value={form.department} required onChange={changeDepartment} suggestions={departmentOptions} placeholder="Search department" />
              <Field label="Sub Department" icon={Users} value={form.subDepartment} onChange={update('subDepartment')} suggestions={subDepartmentOptions} placeholder={form.department ? 'Search sub department' : 'Select department first'} />
            </div>
          </Section>

          <Alert tone="info" icon={Check} title="Configure after creation">
            Target dates, planning, failure codes, materials, PTW, actuals, meters, and closeout remain inside Work Order Details.
          </Alert>
        </div>

        <ModalFooter>
          <Button variant="outline" onClick={onCancel}>Cancel</Button>
          <Button onClick={submit}><Plus size={15} />Create work order</Button>
        </ModalFooter>
      </ModalPanel>
    </ModalOverlay>
  )
}

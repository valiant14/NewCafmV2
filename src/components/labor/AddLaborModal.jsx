import { Building2, CalendarCheck, Clock, Hash, User, Users, Wrench } from 'lucide-react'
import MasterRecordModal from '../master-data/MasterRecordModal'
import { craftCodeOptions, craftNameOptions } from '../../lib/masterOptions'

// Craft code and craft name were both free text, so they could drift apart. Picking a
// code now fills the name, and the list narrows to the selected department.
const buildFields = (department, siteRecords = [], departmentRecords = [], laborRows = [], lockPersonId = false) => {
  const siteOptions = ['', ...siteRecords.filter(row => row.status !== 'Inactive').map(row => ({ value: row.code, label: row.name }))]
  const departmentOptions = ['', ...new Map(departmentRecords.filter(row => row.status !== 'Inactive' && row.department).map(row => [row.department, row.department])).values()]
  const subDepartmentOptions = departmentRecords
    .filter(row => row.status !== 'Inactive' && (!department || row.department === department))
    .map(row => row.description || row.subDepartmentCode)
    .filter(Boolean)

  const person = { section: 'Person', sectionIcon: User, sectionNote: 'Who the technician is' }
  const reporting = { section: 'Reporting', sectionIcon: Users, sectionNote: 'The department that owns this resource', sectionTone: 'purple' }
  const skills = { section: 'Craft & shift', sectionIcon: Wrench, sectionNote: 'What they are qualified for and when they work', sectionTone: 'green', sectionSpan: 'full' }

  return [
  { ...person, label: 'Person ID', key: 'personId', icon: Hash, required: true, locked: lockPersonId, placeholder: 'LAB-0007' },
  { ...person, label: 'Name', key: 'name', icon: User, required: true, placeholder: 'Technician full name' },
  { ...reporting, label: 'Site', key: 'site', icon: Building2, required: true, options: siteOptions },
  { ...reporting, label: 'Department', key: 'department', icon: Users, required: true, options: departmentOptions },
  { ...reporting, label: 'Sub Department', key: 'subDepartment', icon: Users, options: ['', ...subDepartmentOptions] },
  // Crafts already in use are offered, but a new one can still be typed - this is where a
  // craft first enters the system.
  { ...skills, label: 'Craft Code', key: 'craftCode', icon: Wrench, required: true, suggestions: craftCodeOptions(laborRows), placeholder: 'Select or type a craft code' },
  { ...skills, label: 'Craft', key: 'craft', icon: Wrench, suggestions: craftNameOptions(laborRows), placeholder: 'Select or type a craft name' },
  { ...skills, label: 'Shift', key: 'shift', icon: Clock, options: ['Day', 'Night'] },
  { ...skills, label: 'Availability', key: 'availability', icon: CalendarCheck, options: ['Available', 'Assigned', 'On Leave'] }
  ]
}

export default function AddLaborModal({ form, setForm, siteRecords = [], departmentRecords = [], laborRows = [], lockPersonId = false, title = 'Add labor resource', note = 'Create a technician and assign department responsibility from Settings masters.', submitLabel = 'Create labor', ...props }) {
  const updateForm = update => setForm(current => {
    const next = typeof update === 'function' ? update(current) : update
    // A department change invalidates the craft and sub-department beneath it.
    if (next.department !== current.department) return { ...next, craftCode: '', craft: '', subDepartment: '' }
    return next
  })

  return (
    <MasterRecordModal
      {...props}
      form={form}
      setForm={updateForm}
      title={title}
      note={note}
      submitLabel={submitLabel}
      fields={buildFields(form.department, siteRecords, departmentRecords, laborRows, lockPersonId)}
    />
  )
}

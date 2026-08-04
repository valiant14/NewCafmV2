import MasterRecordModal from '../master-data/MasterRecordModal'
import { craftCodeOptions, craftNameOptions } from '../../lib/masterOptions'

// Craft code and craft name were both free text, so they could drift apart. Picking a
// code now fills the name, and the list narrows to the selected department.
const buildFields = (department, departmentRecords = [], laborRows = []) => {
  const departmentOptions = ['', ...new Map(departmentRecords.filter(row => row.status !== 'Inactive' && row.department).map(row => [row.department, row.department])).values()]
  const subDepartmentOptions = departmentRecords
    .filter(row => row.status !== 'Inactive' && (!department || row.department === department))
    .map(row => row.description || row.subDepartmentCode)
    .filter(Boolean)

  return [
  { label: 'Person ID', key: 'personId', required: true, placeholder: 'LAB-0007' },
  { label: 'Name', key: 'name', required: true, placeholder: 'Technician full name' },
  { label: 'Department', key: 'department', options: departmentOptions },
  { label: 'Sub Department', key: 'subDepartment', options: ['', ...subDepartmentOptions] },
  // Crafts already in use are offered, but a new one can still be typed - this is where a
  // craft first enters the system.
  { label: 'Craft Code', key: 'craftCode', required: true, suggestions: craftCodeOptions(laborRows), placeholder: 'Select or type a craft code' },
  { label: 'Craft', key: 'craft', suggestions: craftNameOptions(laborRows), placeholder: 'Select or type a craft name' },
  { label: 'Shift', key: 'shift', options: ['Day', 'Night'] },
  { label: 'Availability', key: 'availability', options: ['Available', 'Assigned', 'On Leave'] }
  ]
}

export default function AddLaborModal({ form, setForm, departmentRecords = [], laborRows = [], ...props }) {
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
      title="Add labor resource"
      note="Create a technician and assign department responsibility from Settings masters."
      fields={buildFields(form.department, departmentRecords, laborRows)}
    />
  )
}

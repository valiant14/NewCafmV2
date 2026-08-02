import MasterRecordModal from '../master-data/MasterRecordModal'
import departments from '../../data/departments.json'
import { craftByCode, craftsForDepartment, subDepartmentsForDepartment } from '../../lib/departments'

const departmentOptions = ['', ...departments.map(department => department.name)]

// Craft code and craft name were both free text, so they could drift apart. Picking a
// code now fills the name, and the list narrows to the selected department.
const buildFields = department => [
  { label: 'Person ID', key: 'personId', required: true, placeholder: 'LAB-0007' },
  { label: 'Name', key: 'name', required: true, placeholder: 'Technician full name' },
  { label: 'Department', key: 'department', options: departmentOptions },
  { label: 'Sub Department', key: 'subDepartment', options: ['', ...subDepartmentsForDepartment(department).map(sub => sub.name)] },
  { label: 'Craft Code', key: 'craftCode', required: true, options: ['', ...craftsForDepartment(department).map(craft => craft.code)] },
  { label: 'Craft', key: 'craft', locked: true, placeholder: 'Set from the craft code' },
  { label: 'Shift', key: 'shift', options: ['Day', 'Night'] },
  { label: 'Availability', key: 'availability', options: ['Available', 'Assigned', 'On Leave'] }
]

export default function AddLaborModal({ form, setForm, ...props }) {
  const updateForm = update => setForm(current => {
    const next = typeof update === 'function' ? update(current) : update
    // A department change invalidates the craft and sub-department beneath it.
    if (next.department !== current.department) return { ...next, craftCode: '', craft: '', subDepartment: '' }
    if (next.craftCode !== current.craftCode) {
      const craft = craftByCode(next.craftCode)
      return { ...next, craft: craft?.name || '', subDepartment: next.subDepartment || craft?.subDepartment || '' }
    }
    return next
  })

  return (
    <MasterRecordModal
      {...props}
      form={form}
      setForm={updateForm}
      title="Add labor resource"
      note="Create a technician and assign craft responsibility from the approved craft list."
      fields={buildFields(form.department)}
    />
  )
}

import MasterRecordModal from '../master-data/MasterRecordModal'

const laborFields = [
  { label: 'Person ID', key: 'personId', required: true, placeholder: 'LAB-0007' },
  { label: 'Name', key: 'name', required: true, placeholder: 'Technician full name' },
  { label: 'Craft Code', key: 'craftCode', required: true, placeholder: 'HVAC-TECH' },
  { label: 'Craft', key: 'craft', placeholder: 'HVAC Technician' },
  { label: 'Department', key: 'department', placeholder: 'Mechanics' },
  { label: 'Sub Department', key: 'subDepartment', placeholder: 'HVAC' },
  { label: 'Shift', key: 'shift', options: ['Day', 'Night'] },
  { label: 'Availability', key: 'availability', options: ['Available', 'Assigned', 'On Leave'] }
]

export default function AddLaborModal(props) {
  return (
    <MasterRecordModal
      {...props}
      title="Add labor resource"
      note="Create a technician and assign craft responsibility."
      fields={laborFields}
    />
  )
}

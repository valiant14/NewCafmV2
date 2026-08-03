import MasterRecordModal from '../master-data/MasterRecordModal'

const toolFields = [
  { label: 'Tool Number', key: 'toolNumber', required: true, placeholder: 'TOOL-0007' },
  { label: 'Description', key: 'description', required: true, placeholder: 'Tool or equipment description' },
  { label: 'Category', key: 'category', placeholder: 'e.g. Electrical Test' },
  { label: 'Store / Location', key: 'location', placeholder: 'Main Tool Store' },
  { label: 'Quantity', key: 'quantity', type: 'number', min: 1 },
  { label: 'Status', key: 'status', options: ['Available', 'Allocated', 'Maintenance'] },
  { label: 'Inspection Due', key: 'inspectionDue', type: 'date', full: true }
]

export default function AddToolModal(props) {
  return (
    <MasterRecordModal
      {...props}
      title="Add tool or equipment"
      note="Create a controlled resource and inspection record."
      fields={toolFields}
    />
  )
}

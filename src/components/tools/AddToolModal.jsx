import { BarChart3, Boxes, CalendarClock, ClipboardCheck, FileText, Hash, Layers, ShieldCheck, Warehouse, Wrench } from 'lucide-react'
import MasterRecordModal from '../master-data/MasterRecordModal'

const resource = { section: 'Resource', sectionIcon: Wrench, sectionNote: 'What the tool is and where it is kept', sectionSpan: 'full' }
const control = { section: 'Stock & inspection', sectionIcon: ClipboardCheck, sectionNote: 'How many are held, when to restock, and when it is next due for inspection', sectionTone: 'green', sectionSpan: 'full' }

const toolFields = [
  { ...resource, label: 'Tool Number', key: 'toolNumber', icon: Hash, required: true, placeholder: 'TOOL-0007' },
  { ...resource, label: 'Description', key: 'description', icon: FileText, required: true, placeholder: 'Tool or equipment description' },
  { ...resource, label: 'Category', key: 'category', icon: Layers, placeholder: 'e.g. Electrical Test' },
  { ...resource, label: 'Store / Location', key: 'location', icon: Warehouse, placeholder: 'Main Tool Store' },
  { ...control, label: 'Quantity', key: 'quantity', icon: Boxes, type: 'number', min: 1 },
  { ...control, label: 'Low Level', key: 'lowLevel', icon: BarChart3, type: 'number', min: 0 },
  { ...control, label: 'Status', key: 'status', icon: ShieldCheck, options: ['Available', 'Allocated', 'Maintenance'] },
  { ...control, label: 'Inspection Due', key: 'inspectionDue', icon: CalendarClock, type: 'date' }
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

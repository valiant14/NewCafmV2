import { BarChart3, Boxes, ClipboardList, FileText, Hash, Layers, PackageCheck, Ruler, Warehouse } from 'lucide-react'
import MasterRecordModal from '../master-data/MasterRecordModal'

const item = { section: 'Item', sectionIcon: Boxes, sectionNote: 'What the part is and how it is measured', sectionSpan: 'full' }
const stock = { section: 'Stock', sectionIcon: Warehouse, sectionNote: 'Where it is held and the quantities on record', sectionTone: 'green', sectionSpan: 'full' }

const materialFields = [
  { ...item, label: 'Item Number', key: 'itemNumber', icon: Hash, required: true, placeholder: 'MAT-0007' },
  { ...item, label: 'Description', key: 'description', icon: FileText, required: true, placeholder: 'Material or spare part description' },
  { ...item, label: 'Category', key: 'category', icon: Layers, placeholder: 'e.g. HVAC Consumables' },
  { ...item, label: 'Unit', key: 'unit', icon: Ruler, options: ['EA', 'KG', 'M', 'L', 'SET'] },
  { ...stock, label: 'Storeroom', key: 'storeroom', icon: Warehouse, placeholder: 'Select a storeroom' },
  { ...stock, label: 'Balance', key: 'balance', icon: Boxes, type: 'number', min: 0 },
  { ...stock, label: 'Reserved', key: 'reserved', icon: ClipboardList, type: 'number', min: 0 },
  { ...stock, label: 'Low Level', key: 'reorderLevel', icon: BarChart3, type: 'number', min: 0 },
  { ...stock, label: 'Availability', key: 'availability', icon: PackageCheck, options: ['Available', 'Purchase Required'] }
]

export default function AddMaterialModal(props) {
  return (
    <MasterRecordModal
      {...props}
      title="Add material"
      note="Create a spare part or consumable inventory record."
      fields={materialFields}
    />
  )
}

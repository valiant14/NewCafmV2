import MasterRecordModal from '../master-data/MasterRecordModal'

const materialFields = [
  { label: 'Item Number', key: 'itemNumber', required: true, placeholder: 'MAT-0007' },
  { label: 'Description', key: 'description', required: true, placeholder: 'Material or spare part description' },
  { label: 'Category', key: 'category', placeholder: 'e.g. HVAC Consumables' },
  { label: 'Unit', key: 'unit', options: ['EA', 'KG', 'M', 'L', 'SET'] },
  { label: 'Storeroom', key: 'storeroom', placeholder: 'Select a storeroom' },
  { label: 'Balance', key: 'balance', type: 'number', min: 0 },
  { label: 'Reserved', key: 'reserved', type: 'number', min: 0 },
  { label: 'Low Level', key: 'reorderLevel', type: 'number', min: 0 },
  { label: 'Availability', key: 'availability', options: ['Available', 'Purchase Required'], full: true }
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

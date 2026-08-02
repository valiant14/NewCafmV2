import MasterRecordModal from '../master-data/MasterRecordModal'

const fields = [
  { key: 'assetnum', label: 'Asset Number', required: true, placeholder: 'e.g. FCU-400-0001' },
  { key: 'description', label: 'Description', required: true, full: true, placeholder: 'Asset description' },
  { key: 'site', label: 'Site', required: true, placeholder: '1031' },
  { key: 'location', label: 'Location', required: true, placeholder: 'Search or enter location' },
  { key: 'department', label: 'Department', placeholder: 'Mechanics' },
  { key: 'sub department', label: 'Sub Department', placeholder: '4-1-1' },
  { key: 'prioity', label: 'Priority', type: 'number', min: 1 },
  { key: 'status', label: 'Status', options: ['OPERATING', 'NOT READY', 'BROKEN', 'DECOMMISSIONED', 'RETIRED'] },
  { key: 'parent', label: 'Parent Asset' },
  { key: 'modelnum', label: 'Model Number' },
  { key: 'serialnum', label: 'Serial Number' },
  { key: 'installdate', label: 'Install Date', type: 'date' },
  { key: 'quantity', label: 'Quantity', type: 'number', min: 1 },
  { key: 'asset short name', label: 'Asset Short Name' }
]

export default function AddAssetModal({ form, setForm, onClose, onSave }) {
  return (
    <MasterRecordModal
      title="Add asset"
      note="Create a maintainable equipment or facility asset record."
      fields={fields}
      form={form}
      setForm={setForm}
      onClose={onClose}
      onSave={onSave}
      submitLabel="Create asset"
    />
  )
}

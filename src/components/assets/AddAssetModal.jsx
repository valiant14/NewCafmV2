import MasterRecordModal from '../master-data/MasterRecordModal'
import { systemNamesForDepartment } from '../../lib/departments'
import { assetTypes, nextAssetCode } from '../../lib/coding'

const typeOptions = ['', ...assetTypes.map(type => `${type.code} · ${type.name}`)]
const codeFromOption = option => String(option || '').split('·')[0].trim()

const buildFields = department => [
  { key: 'assetType', label: 'Asset Type', options: typeOptions },
  { key: 'assetnum', label: 'Asset Number', required: true, placeholder: 'Pick a type to generate' },
  { key: 'description', label: 'Description', required: true, full: true, placeholder: 'Asset description' },
  { key: 'site', label: 'Site', required: true, placeholder: '1031' },
  { key: 'location', label: 'Location', required: true, placeholder: 'Search or enter location' },
  { key: 'department', label: 'Department', placeholder: 'Mechanics' },
  { key: 'sub department', label: 'Sub Department', placeholder: '4-1-1' },
  { key: 'system', label: 'System', options: ['', ...systemNamesForDepartment(department)] },
  { key: 'prioity', label: 'Priority', type: 'number', min: 1 },
  { key: 'status', label: 'Status', options: ['OPERATING', 'NOT READY', 'BROKEN', 'DECOMMISSIONED', 'RETIRED'] },
  { key: 'parent', label: 'Parent Asset', placeholder: 'Leave blank for a top level asset' },
  { key: 'modelnum', label: 'Model Number' },
  { key: 'serialnum', label: 'Serial Number' },
  { key: 'installdate', label: 'Install Date', type: 'date' },
  { key: 'quantity', label: 'Quantity', type: 'number', min: 1 },
  { key: 'asset short name', label: 'Asset Short Name' }
]

export default function AddAssetModal({ form, setForm, onClose, onSave, rows = [], error = '' }) {
  const updateForm = update => setForm(current => {
    const next = typeof update === 'function' ? update(current) : update
    // Changing department invalidates the system beneath it.
    const cleared = next.department === current.department ? next : { ...next, system: '' }
    // Type or parent determines the code, so regenerate - but never overwrite a number
    // the user has typed themselves.
    const typeChanged = cleared.assetType !== current.assetType
    const parentChanged = cleared.parent !== current.parent
    if (!typeChanged && !parentChanged) return cleared
    const type = codeFromOption(cleared.assetType)
    if (!type) return cleared
    const generated = nextAssetCode(rows, { type, parentCode: cleared.parent })
    const untouched = !cleared.assetnum || cleared.assetnum === nextAssetCode(rows, { type: codeFromOption(current.assetType), parentCode: current.parent })
    return untouched ? { ...cleared, assetnum: generated } : cleared
  })

  return (
    <MasterRecordModal
      title="Add asset"
      note="Create a maintainable equipment or facility asset record. The asset number follows the approved coding structure."
      fields={buildFields(form.department)}
      form={form}
      setForm={updateForm}
      onClose={onClose}
      onSave={onSave}
      submitLabel="Create asset"
      error={error}
    />
  )
}

import { Activity, Boxes, Building2, CalendarClock, ClipboardList, FileText, Flag, Hash, Layers, MapPin, Tag, Users, Workflow } from 'lucide-react'
import MasterRecordModal from '../master-data/MasterRecordModal'
import { assetTypes, nextAssetCode } from '../../lib/coding'
import { assetOptions, departmentOptions, locationOptions, siteOptions, subDepartmentOptions } from '../../lib/masterOptions'
import { systemOptionsForScope } from '../../lib/routingMasters'

const typeOptions = ['', ...assetTypes.map(type => `${type.code} · ${type.name}`)]
const codeFromOption = option => String(option || '').split('·')[0].trim()

const identity = { section: 'Identity', sectionIcon: Boxes, sectionNote: 'The type generates the asset number from the approved coding structure' }
const placement = { section: 'Placement', sectionIcon: MapPin, sectionNote: 'Where the asset sits and who owns it', sectionTone: 'green' }
const record = { section: 'Record', sectionIcon: ClipboardList, sectionNote: 'Manufacturer details and how the asset is tracked', sectionTone: 'purple', sectionSpan: 'full' }

const buildFields = (form, masters = {}) => [
  { ...identity, key: 'assetType', label: 'Asset Type', icon: Layers, options: typeOptions },
  { ...identity, key: 'assetnum', label: 'Asset Number', icon: Hash, required: true, placeholder: 'Pick a type to generate' },
  { ...identity, key: 'description', label: 'Description', icon: FileText, required: true, fullWidth: true, placeholder: 'Asset description' },
  { ...identity, key: 'asset short name', label: 'Asset Short Name', icon: Tag },
  { ...identity, key: 'status', label: 'Status', icon: Activity, options: ['OPERATING', 'NOT READY', 'BROKEN', 'DECOMMISSIONED', 'RETIRED'] },

  { ...placement, key: 'site', label: 'Site', icon: Building2, required: true, suggestions: siteOptions(masters.sites), placeholder: 'Select a site' },
  { ...placement, key: 'location', label: 'Location', icon: MapPin, required: true, suggestions: locationOptions(masters.locations), placeholder: 'Select a location' },
  { ...placement, key: 'department', label: 'Department', icon: Users, suggestions: departmentOptions(masters.departments), placeholder: 'Select a department' },
  { ...placement, key: 'sub department', label: 'Sub Department', icon: Users, suggestions: subDepartmentOptions(masters.departments, form.department), placeholder: 'Select a sub department' },
  { ...placement, key: 'system', label: 'System', icon: Workflow, options: ['', ...systemOptionsForScope(masters.systems, { site: form.site, department: form.department, subDepartment: form['sub department'] })] },
  { ...placement, key: 'parent', label: 'Parent Asset', icon: Boxes, suggestions: assetOptions(masters.assets), placeholder: 'Leave blank for a top level asset' },

  { ...record, key: 'modelnum', label: 'Model Number', icon: Tag },
  { ...record, key: 'serialnum', label: 'Serial Number', icon: Hash },
  { ...record, key: 'installdate', label: 'Install Date', icon: CalendarClock, type: 'date' },
  { ...record, key: 'prioity', label: 'Priority', icon: Flag, type: 'number', min: 1 },
  { ...record, key: 'quantity', label: 'Quantity', icon: Boxes, type: 'number', min: 1 }
]

export default function AddAssetModal({ form, setForm, onClose, onSave, rows = [], error = '', siteRecords = [], departmentRecords = [], systemRecords = [], locationRows = [] }) {
  const updateForm = update => setForm(current => {
    const next = typeof update === 'function' ? update(current) : update
    // Any scope change invalidates the System selection beneath it.
    const scopeChanged = next.site !== current.site || next.department !== current.department || next['sub department'] !== current['sub department']
    const cleared = scopeChanged ? { ...next, system: '' } : next
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
      fields={buildFields(form, { sites: siteRecords, departments: departmentRecords, systems: systemRecords, locations: locationRows, assets: rows })}
      form={form}
      setForm={updateForm}
      onClose={onClose}
      onSave={onSave}
      submitLabel="Create asset"
      error={error}
    />
  )
}

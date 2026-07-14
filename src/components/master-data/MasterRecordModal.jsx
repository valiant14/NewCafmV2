import { Check } from 'lucide-react'
import Button from '../ui/Button'
import { ModalFooter, ModalHeader, ModalOverlay, ModalPanel } from '../ui/ModalFrame'

function MasterRecordField({ field, value, onChange }) {
  const inputId = `master-${field.key}`

  return (
    <label className="grid gap-2" htmlFor={inputId}>
      <span className="text-[9px] font-extrabold uppercase tracking-[.12em] text-[var(--app-muted)]">
        {field.label}
        {field.required && <b className="ml-1 text-[var(--app-required)]">*</b>}
      </span>

      {field.options ? (
        <select className="h-10 rounded-xl border border-[var(--app-field-border)] bg-[var(--app-panel)] px-3 text-sm text-[var(--app-ink)] outline-none focus:border-[var(--app-field-focus)] focus:ring-4 focus:ring-[var(--app-field-focus-ring)]" id={inputId} value={value ?? ''} onChange={event => onChange(field.key, event.target.value)}>
          {field.options.map(option => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </select>
      ) : (
        <input
          className="h-10 rounded-xl border border-[var(--app-field-border)] bg-[var(--app-panel)] px-3 text-sm text-[var(--app-ink)] outline-none placeholder:text-[var(--app-muted)] focus:border-[var(--app-field-focus)] focus:ring-4 focus:ring-[var(--app-field-focus-ring)]"
          id={inputId}
          type={field.type || 'text'}
          min={field.min}
          value={value ?? ''}
          onChange={event => onChange(field.key, event.target.value)}
          placeholder={field.placeholder}
        />
      )}
    </label>
  )
}

export default function MasterRecordModal({ title, note, fields, form, setForm, onClose, onSave, submitLabel = 'Create record' }) {
  const requiredFields = fields.filter(field => field.required)
  const valid = requiredFields.every(field => String(form[field.key] ?? '').trim())

  const updateField = (key, value) => {
    setForm(current => ({ ...current, [key]: value }))
  }

  return (
    <ModalOverlay>
      <ModalPanel className="max-w-4xl rounded-2xl" labelledBy="master-record-title">
        <ModalHeader eyebrow="MASTER DATA" title={title} titleId="master-record-title" description={note} onClose={onClose} />

        <div className="grid gap-5 overflow-auto px-6 py-5 md:grid-cols-2">
          {fields.map(field => (
            <MasterRecordField key={field.key} field={field} value={form[field.key]} onChange={updateField} />
          ))}
        </div>

        <ModalFooter className="justify-between">
          <span className="text-xs text-[var(--app-muted)]">{valid ? 'Ready to create' : 'Complete the required fields'}</span>
          <div className="flex items-center gap-2">
          <Button type="button" variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button type="button" disabled={!valid} onClick={onSave}>
            <Check size={15} />
            {submitLabel}
          </Button>
          </div>
        </ModalFooter>
      </ModalPanel>
    </ModalOverlay>
  )
}

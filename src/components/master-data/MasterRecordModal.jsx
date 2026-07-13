import { Check, X } from 'lucide-react'

function MasterRecordField({ field, value, onChange }) {
  const inputId = `master-${field.key}`

  return (
    <label className={field.full ? 'span-2' : undefined} htmlFor={inputId}>
      <span>
        {field.label}
        {field.required && <b>*</b>}
      </span>

      {field.options ? (
        <select id={inputId} value={value ?? ''} onChange={event => onChange(field.key, event.target.value)}>
          {field.options.map(option => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </select>
      ) : (
        <input
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
    <div className="wo-overlay master-modal-overlay">
      <section className="master-record-modal" aria-modal="true" role="dialog" aria-labelledby="master-record-title">
        <header>
          <div>
            <span className="record-kicker">MASTER DATA</span>
            <h2 id="master-record-title">{title}</h2>
            <p>{note}</p>
          </div>

          <button type="button" onClick={onClose} aria-label="Close">
            <X size={19} />
          </button>
        </header>

        <div className="master-modal-body">
          {fields.map(field => (
            <MasterRecordField key={field.key} field={field} value={form[field.key]} onChange={updateField} />
          ))}
        </div>

        <div className="master-modal-footer">
          <span>{valid ? 'Ready to create' : 'Complete the required fields'}</span>
          <button type="button" className="outline" onClick={onClose}>
            Cancel
          </button>
          <button type="button" className="primary" disabled={!valid} onClick={onSave}>
            <Check size={15} />
            {submitLabel}
          </button>
        </div>
      </section>
    </div>
  )
}

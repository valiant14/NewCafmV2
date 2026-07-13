import { Check, X } from 'lucide-react'
import Button from '../ui/Button'
import { cn } from '../../lib/cn'

function MasterRecordField({ field, value, onChange }) {
  const inputId = `master-${field.key}`

  return (
    <label className={cn('grid gap-2', field.full && 'md:col-span-2')} htmlFor={inputId}>
      <span className="text-[9px] font-extrabold uppercase tracking-[.12em] text-[#65746c]">
        {field.label}
        {field.required && <b className="ml-1 text-[#d77545]">*</b>}
      </span>

      {field.options ? (
        <select className="h-10 rounded-xl border border-[#d8ded8] bg-white px-3 text-sm outline-none focus:border-[#7ca18e] focus:ring-4 focus:ring-[#dfeae4]" id={inputId} value={value ?? ''} onChange={event => onChange(field.key, event.target.value)}>
          {field.options.map(option => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </select>
      ) : (
        <input
          className="h-10 rounded-xl border border-[#d8ded8] bg-white px-3 text-sm outline-none focus:border-[#7ca18e] focus:ring-4 focus:ring-[#dfeae4]"
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
    <div className="fixed inset-0 z-50 flex items-center justify-center overflow-auto bg-[#112219]/70 p-6 backdrop-blur-sm">
      <section className="flex max-h-[88vh] w-full max-w-4xl flex-col overflow-hidden rounded-2xl border border-[#dfe6df] bg-[#fbfcfa] shadow-2xl" aria-modal="true" role="dialog" aria-labelledby="master-record-title">
        <header className="flex items-start justify-between gap-4 border-b border-[var(--app-line)] bg-white px-7 py-6">
          <div>
            <span className="text-[9px] font-extrabold uppercase tracking-[.18em] text-[#60756b]">MASTER DATA</span>
            <h2 className="mt-1 text-2xl font-extrabold tracking-[-.04em] text-[var(--app-ink)]" id="master-record-title">{title}</h2>
            <p className="mt-1 text-sm text-[var(--app-muted)]">{note}</p>
          </div>

          <button className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-[#dfe5df] bg-white text-[#617067] transition hover:bg-[#f4f7f4]" type="button" onClick={onClose} aria-label="Close">
            <X size={19} />
          </button>
        </header>

        <div className="grid gap-5 overflow-auto px-7 py-6 md:grid-cols-2">
          {fields.map(field => (
            <MasterRecordField key={field.key} field={field} value={form[field.key]} onChange={updateField} />
          ))}
        </div>

        <div className="flex items-center justify-between gap-3 border-t border-[var(--app-line)] bg-white px-7 py-4">
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
        </div>
      </section>
    </div>
  )
}

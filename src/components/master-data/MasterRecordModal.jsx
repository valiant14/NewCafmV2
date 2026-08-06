import { useEffect } from 'react'
import { AlertTriangle, Check } from 'lucide-react'
import Button from '../ui/Button'
import { ModalFooter, ModalHeader, ModalOverlay, ModalPanel } from '../ui/ModalFrame'
import Field from '../ui/Field'
import Section from '../ui/Section'
import { useToast } from '../../providers/ToastProvider'

// Rendered by the shared Field so a master-data form looks and behaves like every other form -
// same label, icon, picker and textarea treatment - instead of a second implementation of them.
function MasterRecordField({ field, value, onChange }) {
  return (
    <div className={field.fullWidth || field.full ? 'md:col-span-2' : ''}>
      <Field
        label={field.label}
        icon={field.icon}
        value={value ?? ''}
        required={field.required}
        locked={field.locked}
        type={field.type}
        options={field.options}
        suggestions={field.suggestions}
        placeholder={field.placeholder}
        min={field.min}
        onChange={event => onChange(field.key, event.target.value)}
      />
    </div>
  )
}

// Fields carrying a `section` are grouped under a titled card; a form that names no sections
// renders as the single grid it always did.
const groupFields = fields => fields.reduce((groups, field) => {
  const name = field.section || ''
  const current = groups.at(-1)
  if (current && current.name === name) current.fields.push(field)
  else groups.push({ name, icon: field.sectionIcon, note: field.sectionNote, tone: field.sectionTone, span: field.sectionSpan, fields: [field] })
  return groups
}, [])

export default function MasterRecordModal({ title, note, fields, form, setForm, onClose, onSave, submitLabel = 'Create record', error = '' }) {
  const { error: notifyError } = useToast()
  const requiredFields = fields.filter(field => field.required)
  const valid = requiredFields.every(field => String(form[field.key] ?? '').trim())
  const sections = groupFields(fields)

  useEffect(() => {
    if (error) notifyError(error)
  }, [error, notifyError])

  const updateField = (key, value) => {
    setForm(current => ({ ...current, [key]: value }))
  }

  return (
    <ModalOverlay>
      <ModalPanel className="max-w-5xl rounded-2xl" labelledBy="master-record-title">
        <ModalHeader eyebrow="MASTER DATA" title={title} titleId="master-record-title" description={note} onClose={onClose} />

        {error && (
          <div className="mx-6 mt-5 flex items-center gap-2 rounded-2xl border border-[var(--app-badge-orange-text)]/25 bg-[var(--app-badge-orange-bg)] p-3 text-sm text-[var(--app-badge-orange-text)]">
            <AlertTriangle size={16} />
            <span>{error}</span>
          </div>
        )}

        {sections.length > 1 || sections[0]?.name ? (
          <div className="grid items-stretch gap-3 overflow-auto px-4 py-4 sm:px-6 lg:grid-cols-2">
            {sections.map(section => {
              const wide = section.span === 'full' || sections.length === 1
              return (
                <Section
                  compact
                  key={section.name}
                  tone={section.tone}
                  icon={section.icon}
                  title={section.name}
                  note={section.note}
                  className={wide ? 'lg:col-span-2' : ''}
                >
                  <div className={`grid gap-3 md:grid-cols-2 ${wide ? 'xl:grid-cols-3' : ''}`}>
                    {section.fields.map(field => (
                      <MasterRecordField key={field.key} field={field} value={form[field.key]} onChange={updateField} />
                    ))}
                  </div>
                </Section>
              )
            })}
          </div>
        ) : (
          <div className="grid gap-3 overflow-auto px-4 py-4 sm:px-6">
            <Section compact tone="blue">
              <div className="grid gap-4 sm:gap-5 md:grid-cols-2">
                {fields.map(field => (
                  <MasterRecordField key={field.key} field={field} value={form[field.key]} onChange={updateField} />
                ))}
              </div>
            </Section>
          </div>
        )}

        <ModalFooter className="justify-between">
          <span className="text-xs text-[var(--app-muted)]">{error ? 'Resolve the issue above' : valid ? 'Ready to create' : 'Complete the required fields'}</span>
          <div className="flex w-full flex-col-reverse gap-2 sm:w-auto sm:flex-row sm:items-center">
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

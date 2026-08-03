import { useId } from 'react'
import Combobox from './Combobox'

export function Field({ label, value = '', required, locked, disabled = false, type = 'text', options, suggestions, onChange, placeholder }) {
  const listId = useId()
  if (locked) return null
  const controlClass = `w-full rounded-xl border border-[var(--app-field-border)] px-3 text-sm outline-none transition placeholder:text-[var(--app-muted)] focus:border-[var(--app-field-focus)] focus:ring-4 focus:ring-[var(--app-field-focus-ring)] ${disabled ? 'cursor-not-allowed bg-[var(--app-table-header-bg)] text-[var(--app-muted)]' : 'bg-[var(--app-panel)] text-[var(--app-ink)]'}`
  return <label className="grid min-w-0 gap-2">
    <span className="flex items-center gap-1 text-[10px] font-extrabold uppercase tracking-[.12em] text-[var(--app-muted)]">{label}{required && <b className="text-[var(--app-required)]">*</b>}</span>
    {options ? <select className={`${controlClass} h-11`} value={value} onChange={onChange} disabled={disabled}>{options.map(option => <option key={option}>{option}</option>)}</select> :
      type === 'textarea' ? <textarea className={`${controlClass} min-h-[86px] py-3 leading-relaxed`} value={value} onChange={onChange} rows="3" disabled={disabled} /> :
      suggestions?.length ? <Combobox inputId={listId} className={`${controlClass} h-11`} value={value} suggestions={suggestions} onChange={onChange} placeholder={placeholder} /> :
      <input className={`${controlClass} h-11`} type={type} value={value} onChange={onChange} placeholder={placeholder} disabled={disabled} />}
  </label>
}

export function Section({ title, note, children }) {
  return <section className="rounded-3xl border border-[var(--app-line)] bg-[var(--app-panel)] p-5 shadow-[0_12px_32px_rgba(32,55,45,.06)]">{(title || note) && <header className="mb-5 border-b border-[var(--app-line)] pb-4"><div>{title && <h3 className="text-base font-extrabold tracking-[-.02em] text-[var(--app-ink)]">{title}</h3>}{note && <p className="mt-1 text-sm leading-relaxed text-[var(--app-muted)]">{note}</p>}</div></header>}{children}</section>
}

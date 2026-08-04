import { useId } from 'react'
import Combobox from './Combobox'
import { cn } from '../../lib/cn'

export default function Field({ label, value = '', required, locked, disabled = false, type = 'text', options, suggestions, onChange, onBlur, onKeyDown, placeholder }) {
  const listId=useId()
  const isDisabled = locked || disabled
  const controlClass = cn(
    'w-full rounded-xl border border-[var(--app-field-border)] bg-[var(--app-panel)] px-3 text-sm text-[var(--app-ink)] outline-none transition',
    'placeholder:text-[var(--app-muted)] focus:border-[var(--app-field-focus)] focus:ring-4 focus:ring-[var(--app-field-focus-ring)]',
    'read-only:bg-[var(--app-soft-bg)] read-only:text-[var(--app-muted)] disabled:bg-[var(--app-soft-bg)] disabled:text-[var(--app-muted)]',
    type === 'textarea' ? 'min-h-[86px] py-3 leading-relaxed' : 'h-11'
  )

  return (
    <label className="group grid min-w-0 content-start gap-2">
      <span className="flex items-center gap-1 text-[10px] font-extrabold uppercase tracking-[.12em] text-[var(--app-muted)]">
        {label}
        {required && <b className="text-[var(--app-required)]">*</b>}
      </span>
      {/* A fixed set of choices uses the same styled picker as a searchable list, so every
          dropdown looks and behaves alike instead of falling back to the browser's menu. */}
      {options ? (
        <Combobox
          inputId={listId}
          picker
          className={controlClass}
          value={value}
          suggestions={options}
          onChange={onChange}
          placeholder={placeholder}
          disabled={isDisabled}
        />
      ) : type === 'textarea' ? (
        <textarea className={controlClass} value={value} onChange={onChange} onBlur={onBlur} onKeyDown={onKeyDown} readOnly={isDisabled} rows="3" placeholder={placeholder} />
      ) : suggestions?.length ? (
        <Combobox
          inputId={listId}
          className={controlClass}
          value={value}
          suggestions={suggestions}
          onChange={onChange}
          placeholder={placeholder}
          disabled={isDisabled}
        />
      ) : (
        <input
          className={controlClass}
          type={type}
          value={value}
          onChange={onChange}
          onBlur={onBlur}
          onKeyDown={onKeyDown}
          readOnly={isDisabled}
          placeholder={placeholder}
        />
      )}
    </label>
  )
}

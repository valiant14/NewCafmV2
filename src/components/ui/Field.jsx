import { useId } from 'react'
import Combobox from './Combobox'
import { cn } from '../../lib/cn'

export default function Field({ label, value = '', required, locked, disabled = false, type = 'text', options, suggestions, onChange, onBlur, onKeyDown, placeholder, min, max, autoComplete, name }) {
  const listId=useId()
  const isDisabled = locked || disabled
  const controlClass = cn(
    'app-field-control',
    type === 'textarea' && 'app-field-control--textarea'
  )

  return (
    <label className="app-field">
      <span className="app-field-label">
        {label}
        {required && <b className="app-field-required">*</b>}
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
          min={min}
          max={max}
          autoComplete={autoComplete}
          name={name}
        />
      )}
    </label>
  )
}

import { useId } from 'react'
import Combobox from './Combobox'
import MultiSelect from './MultiSelect'
import { cn } from '../../lib/cn'

// `icon` is optional and sits inside the label, which is already a flex row with a gap - so a
// form can mark its fields without any per-page styling, and the icon size is decided here
// rather than at each call site.
export default function Field({ label, icon: Icon, value = '', required, locked, disabled = false, type = 'text', options, suggestions, multiple = false, onChange, onBlur, onKeyDown, placeholder, min, max, autoComplete, name }) {
  const listId=useId()
  const isDisabled = locked || disabled
  const controlClass = cn(
    'app-field-control',
    type === 'textarea' && 'app-field-control--textarea'
  )

  return (
    <label className="app-field">
      <span className="app-field-label">
        {Icon && <Icon size={12} className="app-field-icon" />}
        {label}
        {required && <b className="app-field-required">*</b>}
      </span>
      {/* A fixed set of choices uses the same styled picker as a searchable list, so every
          dropdown looks and behaves alike instead of falling back to the browser's menu. */}
      {multiple ? (
        <MultiSelect
          className={controlClass}
          value={value}
          options={options || []}
          onChange={onChange}
          placeholder={placeholder}
          disabled={isDisabled}
        />
      ) : options ? (
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

import { useId } from 'react'

export function Field({ label, value = '', required, locked, type = 'text', options, suggestions, onChange, placeholder }) {
  const listId = useId()
  if (locked) return null
  return <label className="wo-field">
    <span>{label}{required && <b>*</b>}</span>
    {options ? <select value={value} onChange={onChange}>{options.map(option => <option key={option}>{option}</option>)}</select> :
      type === 'textarea' ? <textarea value={value} onChange={onChange} rows="3" /> : <>
        <input type={type} value={value} onChange={onChange} list={suggestions?.length ? listId : undefined} placeholder={placeholder} />
        {suggestions?.length ? <datalist id={listId}>{suggestions.map(item => <option value={item.value ?? item} key={item.value ?? item}>{item.label || item.value || item}</option>)}</datalist> : null}
      </>}
  </label>
}

export function Section({ title, note, children }) {
  return <section className="wo-section"><header><div><h3>{title}</h3>{note && <p>{note}</p>}</div></header>{children}</section>
}

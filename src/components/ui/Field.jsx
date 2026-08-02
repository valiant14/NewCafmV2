import { useId } from 'react'

export default function Field({ label, value = '', required, locked, type = 'text', options, suggestions, onChange, placeholder }) {
  const listId=useId()
  return <label className="wo-field"><span>{label}{required && <b>*</b>}</span>{options ? <select value={value} onChange={onChange} disabled={locked}>{options.map(o=><option key={o}>{o}</option>)}</select> : type === 'textarea' ? <textarea value={value} onChange={onChange} readOnly={locked} rows="3"/> : <><input type={type} value={value} onChange={onChange} readOnly={locked} list={suggestions?.length?listId:undefined} placeholder={placeholder}/>{suggestions?.length ? <datalist id={listId}>{suggestions.map(item=><option value={item.value??item} key={item.value??item}>{item.label||item.value||item}</option>)}</datalist> : null}</>}</label>
}

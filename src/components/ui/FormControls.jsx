import { useId } from 'react'

export function Field({ label, value = '', required, locked, type = 'text', options, suggestions, onChange, placeholder }) {
  const listId = useId()
  if (locked) return null
  const controlClass = 'w-full rounded-xl border border-[#d8ded8] bg-white px-3 text-sm text-[var(--app-ink)] outline-none transition placeholder:text-[#9aa39d] focus:border-[#6f987f] focus:ring-4 focus:ring-[#dfeae4]'
  return <label className="grid min-w-0 gap-2">
    <span className="flex items-center gap-1 text-[10px] font-extrabold uppercase tracking-[.12em] text-[#617067]">{label}{required && <b className="text-[#c16f42]">*</b>}</span>
    {options ? <select className={`${controlClass} h-11`} value={value} onChange={onChange}>{options.map(option => <option key={option}>{option}</option>)}</select> :
      type === 'textarea' ? <textarea className={`${controlClass} min-h-[86px] py-3 leading-relaxed`} value={value} onChange={onChange} rows="3" /> : <>
        <input className={`${controlClass} h-11`} type={type} value={value} onChange={onChange} list={suggestions?.length ? listId : undefined} placeholder={placeholder} />
        {suggestions?.length ? <datalist id={listId}>{suggestions.map(item => <option value={item.value ?? item} key={item.value ?? item}>{item.label || item.value || item}</option>)}</datalist> : null}
      </>}
  </label>
}

export function Section({ title, note, children }) {
  return <section className="rounded-3xl border border-[var(--app-line)] bg-white p-5 shadow-[0_12px_32px_rgba(32,55,45,.06)]">{(title || note) && <header className="mb-5 border-b border-[#edf0ec] pb-4"><div>{title && <h3 className="text-base font-extrabold tracking-[-.02em] text-[var(--app-ink)]">{title}</h3>}{note && <p className="mt-1 text-sm leading-relaxed text-[var(--app-muted)]">{note}</p>}</div></header>}{children}</section>
}

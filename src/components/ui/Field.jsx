import { useId } from 'react'
import { cn } from '../../lib/cn'

export default function Field({ label, value = '', required, locked, type = 'text', options, suggestions, onChange, placeholder }) {
  const listId=useId()
  const controlClass = cn(
    'w-full rounded-xl border border-[#d8ded8] bg-white px-3 text-sm text-[var(--app-ink)] outline-none transition',
    'placeholder:text-[#9aa39d] focus:border-[#6f987f] focus:ring-4 focus:ring-[#dfeae4]',
    'read-only:bg-[#f4f6f2] read-only:text-[#718078] disabled:bg-[#f4f6f2] disabled:text-[#718078]',
    type === 'textarea' ? 'min-h-[86px] py-3 leading-relaxed' : 'h-11'
  )

  return (
    <label className="group grid min-w-0 gap-2">
      <span className="flex items-center gap-1 text-[10px] font-extrabold uppercase tracking-[.12em] text-[#617067]">
        {label}
        {required && <b className="text-[#c16f42]">*</b>}
      </span>
      {options ? (
        <select className={controlClass} value={value} onChange={onChange} disabled={locked}>
          {options.map(o => <option key={o}>{o}</option>)}
        </select>
      ) : type === 'textarea' ? (
        <textarea className={controlClass} value={value} onChange={onChange} readOnly={locked} rows="3" placeholder={placeholder} />
      ) : (
        <>
          <input
            className={controlClass}
            type={type}
            value={value}
            onChange={onChange}
            readOnly={locked}
            list={suggestions?.length ? listId : undefined}
            placeholder={placeholder}
          />
          {suggestions?.length ? (
            <datalist id={listId}>
              {suggestions.map(item => (
                <option value={item.value ?? item} key={item.value ?? item}>
                  {item.label || item.value || item}
                </option>
              ))}
            </datalist>
          ) : null}
        </>
      )}
    </label>
  )
}

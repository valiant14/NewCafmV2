import { useEffect, useId, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Check, ChevronDown, X } from 'lucide-react'
const optionValue = item => String(item?.value ?? item ?? '')
const optionLabel = item => String(item?.label ?? '')

// Scope fields hold the stored site code while options may use a readable display label,
// and several controls accept a comma-separated list.
// Comparing the whole string against whole options flagged both of those as unknown.
const codeOf = text => text.split('/').pop().trim().toLowerCase()
const isKnownValue = (text, suggestions) => {
  const parts = text.split(',').map(part => part.trim()).filter(Boolean)
  if (!parts.length) return true
  return parts.every(part => suggestions.some(item => {
    const option = optionValue(item)
    return option.toLowerCase() === part.toLowerCase() || codeOf(option) === codeOf(part)
  }))
}

// Native datalist filters the list by the input's contents, so a field holding a complete
// value shows an empty list and can only be changed by deleting first. This opens the
// whole list on demand instead.
// `picker` turns this into a styled replacement for a native select: the value can only be
// chosen from the list, so there is no typing and no clear button - useful for fixed sets
// like a status, where free text would be meaningless.
export default function Combobox({
  value = '',
  suggestions = [],
  onChange,
  placeholder,
  disabled,
  picker = false,
  className,
  inputId
}) {
  const fallbackId = useId()
  const id = inputId || fallbackId
  const wrapperRef = useRef(null)
  const inputRef = useRef(null)
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState(null)   // null while not typing, so the list shows everything
  const [highlight, setHighlight] = useState(-1)
  const [rect, setRect] = useState(null)

  const text = String(value ?? '')
  const typed = query === null ? '' : query.toLowerCase().trim()
  const items = typed
    ? suggestions.filter(item => `${optionValue(item)} ${optionLabel(item)}`.toLowerCase().includes(typed))
    : suggestions
  const matchesKnown = !text || isKnownValue(text, suggestions)

  // A fixed-choice field stores the code but reading back a bare "1" says nothing, so the
  // closed box shows the code with its meaning. Only picker mode can do this: a searchable
  // field has to keep showing exactly what is typed for filtering to make sense.
  const selected = suggestions.find(item => optionValue(item).toLowerCase() === text.toLowerCase())
  const selectedLabel = selected ? optionLabel(selected) : ''
  const displayText = picker && text && selectedLabel ? `${optionValue(selected)} - ${selectedLabel}` : text

  // Consumers pass DOM-style handlers - event => setThing(event.target.value) - and some
  // cascade off the value, so the shape of this object is the compatibility contract.
  const emit = next => onChange?.({ target: { value: next } })

  // The list is fixed-positioned so it can escape the modal's scroll container. That
  // means it cannot be scrolled to, so when a field sits low on screen it has to flip
  // above the input rather than render below the fold.
  const place = () => {
    const box = wrapperRef.current?.getBoundingClientRect()
    if (!box) return
    const gap = 4
    const below = window.innerHeight - box.bottom - gap
    const above = box.top - gap
    const flip = below < 180 && above > below
    setRect({
      left: box.left,
      width: box.width,
      maxHeight: Math.max(120, Math.min(256, flip ? above : below)),
      ...(flip ? { bottom: window.innerHeight - box.top + gap } : { top: box.bottom + gap })
    })
  }

  useLayoutEffect(() => {
    if (open) place()
  }, [open])

  useEffect(() => {
    if (!open) return
    const close = () => setOpen(false)
    const onClickAway = event => {
      if (!wrapperRef.current?.contains(event.target) && !event.target.closest?.('[data-combobox-list]')) close()
    }
    // Closing on scroll rather than tracking - the list is portalled out of the modal's
    // scroll container so it cannot be clipped, but it must not float away either.
    window.addEventListener('scroll', close, true)
    window.addEventListener('resize', close)
    document.addEventListener('mousedown', onClickAway)
    return () => {
      window.removeEventListener('scroll', close, true)
      window.removeEventListener('resize', close)
      document.removeEventListener('mousedown', onClickAway)
    }
  }, [open])

  const openList = () => { setQuery(null); setHighlight(-1); setOpen(true) }

  const choose = item => {
    emit(optionValue(item))
    setQuery(null)
    setOpen(false)
    inputRef.current?.focus()
  }

  const onKeyDown = event => {
    if (event.key === 'Escape') { setOpen(false); return }
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault()
      if (!open) return openList()
      const step = event.key === 'ArrowDown' ? 1 : -1
      setHighlight(current => {
        const next = current + step
        if (next < 0) return items.length - 1
        if (next >= items.length) return 0
        return next
      })
      return
    }
    if (event.key === 'Enter' && open && highlight >= 0 && items[highlight]) {
      event.preventDefault()
      choose(items[highlight])
    }
  }

  const list = open && items.length > 0 && rect ? createPortal(
    <ul
      data-combobox-list
      role="listbox"
      id={`${id}-list`}
      className="fixed z-[60] overflow-auto rounded-xl border border-[var(--app-line)] bg-[var(--app-panel)] py-1 shadow-[0_18px_40px_rgba(16,24,40,.18)]"
      style={{ top: rect.top, bottom: rect.bottom, left: rect.left, width: rect.width, maxHeight: rect.maxHeight }}
    >
      {items.map((item, index) => {
        const itemValue = optionValue(item)
        const selected = itemValue.toLowerCase() === text.toLowerCase() || codeOf(itemValue) === codeOf(text)
        return (
          <li
            key={itemValue}
            id={`${id}-option-${index}`}
            role="option"
            aria-selected={selected}
            onMouseEnter={() => setHighlight(index)}
            onMouseDown={event => { event.preventDefault(); choose(item) }}
            className={`flex cursor-pointer items-center gap-2 px-3 py-2 text-sm ${index === highlight ? 'bg-[var(--app-table-hover-bg)]' : ''} ${selected ? 'font-bold text-[var(--app-ink)]' : 'text-[var(--app-table-text)]'}`}
          >
            <Check size={14} className={selected ? 'text-[var(--app-primary)]' : 'invisible'} />
            {/* Enum lists use an empty entry to mean "none" - shown as a dash so the row is
                not a blank line. */}
            <span className="min-w-0 flex-1 truncate">{itemValue || '—'}</span>
            {optionLabel(item) && <span className="shrink-0 text-[10px] font-bold uppercase tracking-[.08em] text-[var(--app-muted)]">{optionLabel(item)}</span>}
          </li>
        )
      })}
    </ul>,
    document.body
  ) : null

  return (
    <div ref={wrapperRef} className="relative">
      <input
        ref={inputRef}
        id={id}
        role="combobox"
        aria-expanded={open}
        aria-controls={`${id}-list`}
        aria-autocomplete="list"
        aria-activedescendant={open && highlight >= 0 ? `${id}-option-${highlight}` : undefined}
        autoComplete="off"
        className={`${className} ${picker ? 'cursor-pointer pr-9' : 'pr-16'}`}
        value={query === null ? displayText : query}
        placeholder={placeholder}
        disabled={disabled}
        readOnly={disabled || picker}
        onClick={() => !disabled && openList()}
        onChange={event => { setQuery(event.target.value); setHighlight(-1); setOpen(true); emit(event.target.value) }}
        onKeyDown={onKeyDown}
        onBlur={() => setQuery(null)}
      />

      <span className="pointer-events-none absolute inset-y-0 right-2 flex items-center gap-1">
        {text && !disabled && !picker && (
          <button
            type="button"
            aria-label="Clear"
            className="pointer-events-auto grid h-6 w-6 place-items-center rounded-md text-[var(--app-muted)] transition hover:bg-[var(--app-soft-bg-hover)] hover:text-[var(--app-ink)]"
            onMouseDown={event => { event.preventDefault(); emit(''); setQuery(null); openList() }}
          >
            <X size={13} />
          </button>
        )}
        {!disabled && (
          <button
            type="button"
            tabIndex={-1}
            aria-label="Show options"
            className="pointer-events-auto grid h-6 w-6 place-items-center rounded-md text-[var(--app-muted)] transition hover:text-[var(--app-ink)]"
            onMouseDown={event => { event.preventDefault(); open ? setOpen(false) : openList() }}
          >
            <ChevronDown size={14} className={`transition-transform ${open ? 'rotate-180' : ''}`} />
          </button>
        )}
      </span>

      {!matchesKnown && (
        <span className="mt-1 block text-[10px] font-bold text-[var(--app-badge-orange-text)]" title="This value is not in the list of known records">
          Not in list
        </span>
      )}

      {list}
    </div>
  )
}

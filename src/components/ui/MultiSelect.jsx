import { useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Check, ChevronDown, Search } from 'lucide-react'
import { cn } from '../../lib/cn'

const optionValue = option => String(option?.value ?? option ?? '').trim()
const optionLabel = option => String(option?.label ?? optionValue(option)).trim()
const optionDetail = option => String(option?.detail ?? '').trim()
const keyOf = value => String(value || '').trim().toLowerCase()

export default function MultiSelect({
  value = [],
  options = [],
  onChange,
  placeholder = 'Select one or more',
  disabled = false,
  className
}) {
  const id = useId()
  const wrapperRef = useRef(null)
  const searchRef = useRef(null)
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [rect, setRect] = useState(null)
  const selectedValues = Array.isArray(value) ? value.map(optionValue).filter(Boolean) : []
  const selectedKeys = useMemo(() => new Set(selectedValues.map(keyOf)), [selectedValues])
  const selectedOptions = options.filter(option => selectedKeys.has(keyOf(optionValue(option))))
  const normalizedQuery = query.trim().toLowerCase()
  const visibleOptions = normalizedQuery
    ? options.filter(option => `${optionValue(option)} ${optionLabel(option)} ${optionDetail(option)}`.toLowerCase().includes(normalizedQuery))
    : options

  const emit = next => onChange?.({ target: { value: next } })
  const place = () => {
    const box = wrapperRef.current?.getBoundingClientRect()
    if (!box) return
    const gap = 4
    const below = window.innerHeight - box.bottom - gap
    const above = box.top - gap
    const flip = below < 260 && above > below
    setRect({
      left: box.left,
      width: box.width,
      maxHeight: Math.max(180, Math.min(360, flip ? above : below)),
      ...(flip ? { bottom: window.innerHeight - box.top + gap } : { top: box.bottom + gap })
    })
  }

  useLayoutEffect(() => {
    if (open) place()
  }, [open])

  useEffect(() => {
    if (!open) return undefined
    const close = event => {
      if (!wrapperRef.current?.contains(event.target) && !event.target.closest?.('[data-multi-select-list]')) setOpen(false)
    }
    // Mobile browsers scroll the focused search field into view as soon as this menu opens.
    // Repositioning keeps the portalled list attached to its control; closing here made the
    // Work Group Labor picker disappear immediately on phones.
    const reposition = () => requestAnimationFrame(place)
    document.addEventListener('mousedown', close)
    window.addEventListener('resize', reposition)
    window.addEventListener('scroll', reposition, true)
    return () => {
      document.removeEventListener('mousedown', close)
      window.removeEventListener('resize', reposition)
      window.removeEventListener('scroll', reposition, true)
    }
  }, [open])

  useEffect(() => {
    if (open) requestAnimationFrame(() => searchRef.current?.focus())
  }, [open])

  const toggle = option => {
    const nextValue = optionValue(option)
    const nextKey = keyOf(nextValue)
    emit(selectedKeys.has(nextKey)
      ? selectedValues.filter(item => keyOf(item) !== nextKey)
      : [...selectedValues, nextValue])
  }

  const summary = selectedOptions.length
    ? selectedOptions.length <= 2
      ? selectedOptions.map(optionLabel).join(', ')
      : `${selectedOptions.length} team members selected`
    : placeholder

  const list = open && rect ? createPortal(
    <div
      data-multi-select-list
      className="fixed z-[70] overflow-hidden rounded-xl border border-[var(--app-line)] bg-[var(--app-panel)] shadow-[0_18px_40px_rgba(16,24,40,.18)]"
      style={{ top: rect.top, bottom: rect.bottom, left: rect.left, width: rect.width, maxHeight: rect.maxHeight }}
    >
      <div className="sticky top-0 border-b border-[var(--app-line)] bg-[var(--app-panel)] p-2">
        <label className="flex items-center gap-2 rounded-lg border border-[var(--app-line)] bg-[var(--app-input-bg)] px-3">
          <Search size={15} className="shrink-0 text-[var(--app-muted)]" />
          <input
            ref={searchRef}
            className="h-9 min-w-0 flex-1 bg-transparent text-sm text-[var(--app-ink)] outline-none"
            value={query}
            onChange={event => setQuery(event.target.value)}
            placeholder="Search labor"
          />
        </label>
      </div>
      <div className="max-h-[290px] overflow-auto p-1.5" role="listbox" aria-multiselectable="true">
        {visibleOptions.map(option => {
          const itemValue = optionValue(option)
          const selected = selectedKeys.has(keyOf(itemValue))
          return (
            <button
              key={itemValue}
              type="button"
              role="option"
              aria-selected={selected}
              className="flex w-full items-center gap-3 rounded-lg px-2.5 py-2 text-left transition hover:bg-[var(--app-table-hover-bg)]"
              onClick={() => toggle(option)}
            >
              <span className={cn(
                'grid h-5 w-5 shrink-0 place-items-center rounded-md border',
                selected
                  ? 'border-[var(--app-primary)] bg-[var(--app-primary)] text-white'
                  : 'border-[var(--app-line-strong)] bg-[var(--app-input-bg)] text-transparent'
              )}>
                <Check size={13} />
              </span>
              <span className="min-w-0 flex-1">
                <strong className="block truncate text-sm font-semibold text-[var(--app-ink)]">{optionLabel(option)}</strong>
                <span className="block truncate text-xs text-[var(--app-muted)]">{optionDetail(option) || itemValue}</span>
              </span>
            </button>
          )
        })}
        {!visibleOptions.length && <p className="px-3 py-6 text-center text-sm text-[var(--app-muted)]">No matching labor records</p>}
      </div>
    </div>,
    document.body
  ) : null

  return (
    <div ref={wrapperRef} className="relative">
      <button
        id={id}
        type="button"
        className={cn(className, 'flex items-center justify-between gap-3 text-left', !selectedOptions.length && 'text-[var(--app-muted)]')}
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => {
          if (disabled) return
          setQuery('')
          setOpen(current => !current)
        }}
      >
        <span className="min-w-0 flex-1 truncate">{summary}</span>
        <ChevronDown size={15} className={cn('shrink-0 transition-transform', open && 'rotate-180')} />
      </button>
      {list}
    </div>
  )
}

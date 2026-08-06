import { useEffect, useState } from 'react'

// Deep links from a supply chain row to the item record behind it. Reservations, purchase
// requisitions and purchase orders all carry the same `type` / `itemCode` pair, so the route is
// worked out once here rather than rebuilt in each table.
//
// The item record is where Request PR lives, so this is the path out of "the store is empty"
// on every one of those pages.
export const inventoryItemPath = row => {
  const code = row?.itemCode || row?.item
  if (!code) return ''
  const area = ['Tool', 'Equipment'].includes(row?.type) ? '/tools' : '/materials'
  return `${area}/${encodeURIComponent(code)}`
}

export const openInventoryItem = row => {
  const path = inventoryItemPath(row)
  if (!path) return
  window.history.pushState({}, '', path)
  window.dispatchEvent(new PopStateEvent('popstate'))
}

// A link can point at one row of a list page. The reference rides in the URL rather than in
// component state, so the filtered view survives a refresh, can be shared, and the browser's
// back button undoes it like any other navigation.
export const RECORD_FILTER_PARAM = 'ref'

export const pathWithRecordFilter = (path, reference) => (
  reference ? `${path}?${RECORD_FILTER_PARAM}=${encodeURIComponent(reference)}` : path
)

const currentRecordFilter = () => new URLSearchParams(window.location.search).get(RECORD_FILTER_PARAM) || ''

export function useRecordFilter() {
  const [reference, setReference] = useState(currentRecordFilter)
  useEffect(() => {
    const sync = () => setReference(currentRecordFilter())
    window.addEventListener('popstate', sync)
    return () => window.removeEventListener('popstate', sync)
  }, [])
  const clear = () => {
    window.history.replaceState({}, '', window.location.pathname)
    setReference('')
  }
  return [reference, clear]
}

// An empty reference matches everything, so a page can filter unconditionally.
export const matchesReference = (row, reference, keys = []) => {
  const wanted = String(reference || '').trim().toLowerCase()
  if (!wanted) return true
  return keys.some(key => String(row?.[key] || '').trim().toLowerCase() === wanted)
}

export const normalizeSearch = value => String(value ?? '').toLowerCase().trim()

// Mirrors DataTable's own matching so behaviour is identical whether a page pre-filters
// or lets DataTable do it. `String(value ?? '')` rather than `String(value)` so a search
// for "null" does not match every empty cell.
export const filterRows = (rows = [], search = '', keys) => {
  const term = normalizeSearch(search)
  if (!term) return rows
  return rows.filter(row => {
    const values = keys?.length ? keys.map(key => row?.[key]) : Object.values(row || {})
    return values.some(value => String(value ?? '').toLowerCase().includes(term))
  })
}

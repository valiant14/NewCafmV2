const normalizedKey = value => String(value ?? '').trim().toLowerCase()

export const mergeImportedRows = (current = [], imported = [], key) => {
  const keyFor = typeof key === 'function' ? key : row => row?.[key]
  const existingByKey = new Map(current
    .map(row => [normalizedKey(keyFor(row)), row])
    .filter(([rowKey]) => rowKey))
  const importedKeys = new Set()
  const merged = []
  const mergedIndexByKey = new Map()
  imported.forEach(row => {
    const rowKey = normalizedKey(keyFor(row))
    if (!rowKey) {
      merged.push(row)
      return
    }
    importedKeys.add(rowKey)
    const mergedRow = { ...existingByKey.get(rowKey), ...row }
    if (mergedIndexByKey.has(rowKey)) {
      merged[mergedIndexByKey.get(rowKey)] = { ...merged[mergedIndexByKey.get(rowKey)], ...row }
      return
    }
    mergedIndexByKey.set(rowKey, merged.length)
    merged.push(mergedRow)
  })

  return [
    ...merged,
    ...current.filter(row => {
      const rowKey = normalizedKey(keyFor(row))
      return !rowKey || !importedKeys.has(rowKey)
    })
  ]
}

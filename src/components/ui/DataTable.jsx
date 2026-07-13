import { useMemo } from 'react'

export default function DataTable({
  rows,
  columns,
  search = '',
  pageSize = 12,
  onRowClick,
  rowKey,
  rowClassName,
  sourceLabel = 'Source: Excel mock data',
  showFooter = true
}) {
  const normalized = search.toLowerCase().trim()
  const filtered = useMemo(() => {
    if (!normalized) return rows
    return rows.filter(row => Object.values(row).some(value => String(value).toLowerCase().includes(normalized)))
  }, [rows, normalized])
  const visibleRows = filtered.slice(0, pageSize)

  const getKey = (row, index) => {
    if (typeof rowKey === 'function') return rowKey(row)
    if (rowKey) return row[rowKey]
    return index
  }
  const fallback = value => value === null || value === undefined || value === '' ? '-' : value

  return (
    <>
      <div className="table-shell">
        <table>
          <thead>
            <tr>
              {columns.map(column => <th key={column.key}>{column.label}</th>)}
            </tr>
          </thead>
          <tbody>
            {visibleRows.map((row, index) => (
              <tr
                key={getKey(row, index)}
                className={rowClassName ? rowClassName(row) : onRowClick ? 'click-row' : undefined}
                onClick={onRowClick ? () => onRowClick(row) : undefined}
              >
                {columns.map(column => (
                  <td key={column.key}>
                    {column.render ? column.render(row[column.key], row) : fallback(row[column.key])}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {showFooter && (
        <div className="table-footer">
          <span>Showing {Math.min(pageSize, filtered.length)} of {filtered.length.toLocaleString()} records</span>
          <span>{sourceLabel}</span>
        </div>
      )}
    </>
  )
}

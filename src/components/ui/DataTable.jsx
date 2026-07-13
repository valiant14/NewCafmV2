import { useEffect, useMemo, useState } from 'react'

export default function DataTable({
  rows,
  columns,
  search = '',
  pageSize = 12,
  onRowClick,
  rowKey,
  rowClassName,
  sourceLabel = 'Source: Excel mock data',
  showFooter = true,
  pagination = false,
  pageSizeOptions = [10, 25, 50]
}) {
  const [page, setPage] = useState(1)
  const [size, setSize] = useState(pageSize)
  const normalized = search.toLowerCase().trim()
  const filtered = useMemo(() => {
    if (!normalized) return rows
    return rows.filter(row => Object.values(row).some(value => String(value).toLowerCase().includes(normalized)))
  }, [rows, normalized])
  const pageCount = Math.max(1, Math.ceil(filtered.length / size))
  const currentPage = Math.min(page, pageCount)
  const start = pagination ? (currentPage - 1) * size : 0
  const end = pagination ? currentPage * size : pageSize
  const visibleRows = filtered.slice(start, end)

  useEffect(() => {
    setPage(1)
  }, [normalized, rows.length, size])

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

      {showFooter && pagination && (
        <div className="pagination-bar">
          <div>Showing <strong>{filtered.length ? start + 1 : 0}-{Math.min(end, filtered.length)}</strong> of <strong>{filtered.length}</strong></div>
          <label>
            Rows
            <select value={size} onChange={event => setSize(Number(event.target.value))}>
              {pageSizeOptions.map(option => <option value={option} key={option}>{option}</option>)}
            </select>
          </label>
          <div className="page-controls">
            <button disabled={currentPage === 1} onClick={() => setPage(value => Math.max(1, value - 1))}>Previous</button>
            <span>Page {currentPage} of {pageCount}</span>
            <button disabled={currentPage === pageCount} onClick={() => setPage(value => Math.min(pageCount, value + 1))}>Next</button>
          </div>
        </div>
      )}

      {showFooter && !pagination && (
        <div className="table-footer">
          <span>Showing {Math.min(pageSize, filtered.length)} of {filtered.length.toLocaleString()} records</span>
          <span>{sourceLabel}</span>
        </div>
      )}
    </>
  )
}

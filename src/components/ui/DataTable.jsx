import { useEffect, useMemo, useState } from 'react'
import Button from './Button'
import { cn } from '../../lib/cn'

export default function DataTable({
  rows,
  columns,
  search = '',
  pageSize = 12,
  onRowClick,
  rowKey,
  rowClassName,
  sourceLabel = '',
  showFooter = true,
  pagination = false,
  pageSizeOptions = [10, 25, 50]
}) {
  const [page, setPage] = useState(1)
  const [size, setSize] = useState(pageSize)
  const [sort, setSort] = useState({ key: '', direction: 'asc' })
  const normalized = search.toLowerCase().trim()
  const filtered = useMemo(() => {
    if (!normalized) return rows
    return rows.filter(row => Object.values(row).some(value => String(value).toLowerCase().includes(normalized)))
  }, [rows, normalized])
  const sorted = useMemo(() => {
    if (!sort.key) return filtered
    return [...filtered].sort((a, b) => {
      const left = a[sort.key] ?? ''
      const right = b[sort.key] ?? ''
      const result = typeof left === 'number' && typeof right === 'number'
        ? left - right
        : String(left).localeCompare(String(right), undefined, { numeric: true, sensitivity: 'base' })
      return sort.direction === 'asc' ? result : -result
    })
  }, [filtered, sort])
  const pageCount = Math.max(1, Math.ceil(sorted.length / size))
  const currentPage = Math.min(page, pageCount)
  const start = pagination ? (currentPage - 1) * size : 0
  const end = pagination ? currentPage * size : pageSize
  const visibleRows = sorted.slice(start, end)

  useEffect(() => {
    setPage(1)
  }, [normalized, rows.length, size])

  const getKey = (row, index) => {
    if (typeof rowKey === 'function') return rowKey(row)
    if (rowKey) return row[rowKey]
    return index
  }
  const fallback = value => value === null || value === undefined || value === '' ? '-' : value
  const toggleSort = column => {
    if (column.sortable === false || !column.key || !column.label) return
    setSort(current => current.key === column.key
      ? { key: column.key, direction: current.direction === 'asc' ? 'desc' : 'asc' }
      : { key: column.key, direction: 'asc' })
    setPage(1)
  }

  return (
    <>
      <div className="data-table-wrap">
        <table className="data-table w-full border-separate border-spacing-0 text-left text-[length:var(--app-table-font-size)]">
          <thead>
            <tr>
              {columns.map(column => (
                <th
                  key={column.key}
                  className="data-table-heading"
                >
                  <button
                    type="button"
                    className={cn('inline-flex items-center gap-1 uppercase', column.sortable === false || !column.label ? 'cursor-default' : 'hover:text-[var(--app-primary)]')}
                    onClick={() => toggleSort(column)}
                    disabled={column.sortable === false || !column.label}
                  >
                    {column.label}
                    {sort.key === column.key && <span>{sort.direction === 'asc' ? '↑' : '↓'}</span>}
                  </button>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {visibleRows.map((row, index) => (
              <tr
                key={getKey(row, index)}
                className={cn(
                  'border-b border-[var(--app-line)] transition',
                  onRowClick && 'cursor-pointer hover:bg-[var(--app-table-hover-bg)]',
                  rowClassName?.(row)
                )}
                onClick={onRowClick ? () => onRowClick(row) : undefined}
              >
                {columns.map(column => (
                  <td key={column.key} data-label={column.label || ''} className="data-table-cell">
                    <span className="data-table-value">{column.render ? column.render(row[column.key], row) : fallback(row[column.key])}</span>
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {showFooter && pagination && (
        <div className="data-table-footer">
          <div>Showing <strong className="text-[var(--app-ink)]">{filtered.length ? start + 1 : 0}-{Math.min(end, filtered.length)}</strong> of <strong className="text-[var(--app-ink)]">{filtered.length}</strong></div>
          <div className="flex flex-wrap items-center gap-3 sm:ml-auto sm:justify-end">
            <label className="flex items-center gap-2">
              Rows
              <select className="data-table-page-size" value={size} onChange={event => setSize(Number(event.target.value))}>
                {pageSizeOptions.map(option => <option value={option} key={option}>{option}</option>)}
              </select>
            </label>
            <div className="flex items-center gap-2">
              <Button variant="outline" className="h-8 px-3 text-[length:var(--app-table-footer-font-size)]" disabled={currentPage === 1} onClick={() => setPage(value => Math.max(1, value - 1))}>Previous</Button>
              <span>Page {currentPage} of {pageCount}</span>
              <Button variant="outline" className="h-8 px-3 text-[length:var(--app-table-footer-font-size)]" disabled={currentPage === pageCount} onClick={() => setPage(value => Math.min(pageCount, value + 1))}>Next</Button>
            </div>
          </div>
        </div>
      )}

      {showFooter && !pagination && (
        <div className="data-table-footer">
          <span>Showing {Math.min(pageSize, filtered.length)} of {filtered.length.toLocaleString()} records</span>
          {sourceLabel && <span>{sourceLabel}</span>}
        </div>
      )}
    </>
  )
}

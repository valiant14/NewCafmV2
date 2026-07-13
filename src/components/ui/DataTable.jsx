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
      <div className="overflow-auto">
        <table className="w-full border-collapse text-left text-[11px]">
          <thead>
            <tr>
              {columns.map(column => (
                <th
                  key={column.key}
                  className="whitespace-nowrap border-y border-[#eceee9] bg-[#f8f9f6] px-4 py-3 text-[9px] font-extrabold uppercase tracking-[.08em] text-[#858d88]"
                >
                  {column.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {visibleRows.map((row, index) => (
              <tr
                key={getKey(row, index)}
                className={cn(
                  'border-b border-[#eff1ed] transition',
                  onRowClick && 'cursor-pointer hover:bg-[#f8faf7]',
                  rowClassName?.(row)
                )}
                onClick={onRowClick ? () => onRowClick(row) : undefined}
              >
                {columns.map(column => (
                  <td key={column.key} className="max-w-[320px] px-4 py-3.5 text-[#59635e] first:font-semibold">
                    {column.render ? column.render(row[column.key], row) : fallback(row[column.key])}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {showFooter && pagination && (
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[#eef1ed] px-4 py-3 text-[10px] text-[#7d8781]">
          <div>Showing <strong className="text-[#405047]">{filtered.length ? start + 1 : 0}-{Math.min(end, filtered.length)}</strong> of <strong className="text-[#405047]">{filtered.length}</strong></div>
          <div className="ml-auto flex flex-wrap items-center justify-end gap-3">
            <label className="flex items-center gap-2">
              Rows
              <select className="h-8 rounded-lg border border-[#dfe5df] bg-white px-2 text-[10px]" value={size} onChange={event => setSize(Number(event.target.value))}>
                {pageSizeOptions.map(option => <option value={option} key={option}>{option}</option>)}
              </select>
            </label>
            <div className="flex items-center gap-2">
              <Button variant="outline" className="h-8 px-3 text-[10px]" disabled={currentPage === 1} onClick={() => setPage(value => Math.max(1, value - 1))}>Previous</Button>
              <span>Page {currentPage} of {pageCount}</span>
              <Button variant="outline" className="h-8 px-3 text-[10px]" disabled={currentPage === pageCount} onClick={() => setPage(value => Math.min(pageCount, value + 1))}>Next</Button>
            </div>
          </div>
        </div>
      )}

      {showFooter && !pagination && (
        <div className="flex justify-between border-t border-[#eef1ed] px-4 py-3 text-[10px] text-[#929894]">
          <span>Showing {Math.min(pageSize, filtered.length)} of {filtered.length.toLocaleString()} records</span>
          <span>{sourceLabel}</span>
        </div>
      )}
    </>
  )
}

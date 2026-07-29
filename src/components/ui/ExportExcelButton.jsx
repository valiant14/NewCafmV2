import { FileDown } from 'lucide-react'
import { exportRowsToExcel } from '../../lib/exportRows'

// `module` is destructured to a local name so nothing shadows the CJS identifier.
export default function ExportExcelButton({ rows = [], columns = [], module: moduleName = 'Export', sheetName, label = 'Export data' }) {
  const empty = !rows.length || !columns.length

  return (
    <button
      type="button"
      onClick={() => exportRowsToExcel(rows, columns, moduleName, sheetName)}
      disabled={empty}
      title={empty ? 'No rows to export' : `Export ${rows.length} row${rows.length === 1 ? '' : 's'} to Excel`}
      className="inline-flex h-10 items-center justify-center gap-2 rounded-[10px] border border-[var(--app-line)] bg-[var(--app-panel)] px-4 text-xs font-bold text-[var(--app-muted)] transition hover:bg-[var(--app-table-hover-bg)] hover:text-[var(--app-ink)] disabled:cursor-not-allowed disabled:opacity-50"
    >
      <FileDown size={16} />
      {label}
    </button>
  )
}

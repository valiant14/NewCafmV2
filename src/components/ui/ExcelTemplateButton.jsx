import * as XLSX from 'xlsx'
import { Download } from 'lucide-react'
export default function ExcelTemplateButton({ headers = [], fileName = 'Import_Template.xlsx', sampleRows = [], label = 'Export template' }) {
  const download = () => {
    const worksheet = XLSX.utils.json_to_sheet(
      sampleRows.length ? sampleRows : [Object.fromEntries(headers.map(header => [header, '']))],
      { header: headers }
    )
    const workbook = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Template')
    XLSX.writeFile(workbook, fileName)
  }

  return (
    <button
      type="button"
      onClick={download}
      className="inline-flex h-10 items-center justify-center gap-2 rounded-[10px] border border-[var(--app-line)] bg-[var(--app-panel)] px-4 text-xs font-bold text-[var(--app-muted)] transition hover:bg-[var(--app-table-hover-bg)] hover:text-[var(--app-ink)]"
    >
      <Download size={16} />
      {label}
    </button>
  )
}

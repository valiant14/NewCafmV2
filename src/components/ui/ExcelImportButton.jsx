import { useState } from 'react'
import * as XLSX from 'xlsx'
import { AlertTriangle, CheckCircle2, FileSpreadsheet } from 'lucide-react'
import Button from './Button'
import { ModalFooter, ModalHeader, ModalOverlay, ModalPanel } from './ModalFrame'

const parseCsv = text => {
  const rows = []
  let row = []
  let value = ''
  let quoted = false

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index]
    const next = text[index + 1]

    if (char === '"' && quoted && next === '"') {
      value += '"'
      index += 1
    } else if (char === '"') {
      quoted = !quoted
    } else if (char === ',' && !quoted) {
      row.push(value.trim())
      value = ''
    } else if ((char === '\n' || char === '\r') && !quoted) {
      if (char === '\r' && next === '\n') index += 1
      row.push(value.trim())
      if (row.some(cell => cell !== '')) rows.push(row)
      row = []
      value = ''
    } else {
      value += char
    }
  }

  row.push(value.trim())
  if (row.some(cell => cell !== '')) rows.push(row)
  if (rows.length < 2) return []

  const headers = rows[0].map(header => header.trim())
  return rows.slice(1).map(cells => Object.fromEntries(headers.map((header, index) => [header, cells[index] ?? ''])))
}

export default function ExcelImportButton({ fileName, onFile, onImport, label = 'Import Excel' }) {
  const [result, setResult] = useState(null)
  const allowed = ['xlsx', 'xls', 'csv']

  const handleFile = async event => {
    const file = event.target.files?.[0]
    event.target.value = ''

    if (!file) return

    const extension = file.name.split('.').pop()?.toLowerCase()
    if (!allowed.includes(extension)) {
      setResult({
        type: 'error',
        title: 'Import failed',
        message: 'Please upload an Excel or CSV file only.',
        fileName: file.name
      })
      return
    }

    try {
      let rows = []
      if (extension === 'csv') {
        rows = parseCsv(await file.text())
      } else {
        const workbook = XLSX.read(await file.arrayBuffer(), { type: 'array', cellDates: true })
        const sheet = workbook.Sheets[workbook.SheetNames[0]]
        rows = XLSX.utils.sheet_to_json(sheet, { defval: '', raw: false })
      }
      if (!rows.length) throw new Error('No data rows were found in the file.')
      onFile?.(file.name, rows)
      onImport?.(rows, file)
      setResult({
        type: 'success',
        title: 'Excel import completed',
        message: `${rows.length} row${rows.length === 1 ? '' : 's'} imported from ${file.name} and applied as mock data.`,
        fileName: file.name,
        rows: rows.length
      })
    } catch (error) {
      setResult({
        type: 'error',
        title: 'Import failed',
        message: error.message || 'The file could not be parsed.',
        fileName: file.name
      })
    }
  }

  return (
    <>
      <label className="inline-flex h-10 cursor-pointer items-center justify-center gap-2 rounded-[10px] border border-[var(--app-line)] bg-[var(--app-panel)] px-4 text-xs font-bold text-[var(--app-muted)] transition hover:bg-[var(--app-table-hover-bg)] hover:text-[var(--app-ink)]">
        <FileSpreadsheet size={16} />
        {label}
        <input
          className="hidden"
          type="file"
          accept=".xlsx,.xls,.csv"
          onChange={handleFile}
        />
      </label>

      {result && (
        <ModalOverlay>
          <ModalPanel className="max-w-lg" labelledBy="excel-import-result-title">
            <ModalHeader
              eyebrow="EXCEL IMPORT"
              title={result.title}
              titleId="excel-import-result-title"
              description={result.type === 'success' ? 'The upload finished without validation errors.' : 'The selected file could not be imported.'}
              onClose={() => setResult(null)}
            />
            <div className="grid gap-4 px-6 py-5">
              <div className={`flex items-start gap-3 rounded-2xl border p-4 ${result.type === 'success' ? 'border-emerald-200 bg-emerald-50 text-emerald-800' : 'border-orange-200 bg-orange-50 text-orange-800'}`}>
                {result.type === 'success' ? <CheckCircle2 size={22} /> : <AlertTriangle size={22} />}
                <div className="grid gap-1">
                  <strong className="text-sm">{result.fileName}</strong>
                  <span className="text-sm leading-relaxed">{result.message}</span>
                </div>
              </div>
            </div>
            <ModalFooter>
              <Button onClick={() => setResult(null)}>{result.type === 'success' ? 'Done' : 'Try again'}</Button>
            </ModalFooter>
          </ModalPanel>
        </ModalOverlay>
      )}
    </>
  )
}

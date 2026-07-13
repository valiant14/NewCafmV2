import { useState } from 'react'
import { AlertTriangle, CheckCircle2, FileSpreadsheet } from 'lucide-react'
import Button from './Button'
import { ModalFooter, ModalHeader, ModalOverlay, ModalPanel } from './ModalFrame'

export default function ExcelImportButton({ fileName, onFile, label = 'Import Excel' }) {
  const [result, setResult] = useState(null)
  const allowed = ['xlsx', 'xls', 'csv']

  const handleFile = event => {
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

    onFile?.(file.name)
    setResult({
      type: 'success',
      title: 'Excel import completed',
      message: `${file.name} was imported successfully and is ready as mock data.`,
      fileName: file.name
    })
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

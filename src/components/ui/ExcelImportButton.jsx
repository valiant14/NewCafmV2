import { FileSpreadsheet } from 'lucide-react'

export default function ExcelImportButton({ fileName, onFile, label = 'Import Excel' }) {
  return (
    <label className="outline inventory-import">
      <FileSpreadsheet size={16} />
      {fileName || label}
      <input
        type="file"
        accept=".xlsx,.xls,.csv"
        onChange={event => onFile(event.target.files?.[0]?.name || '')}
      />
    </label>
  )
}

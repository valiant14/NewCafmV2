import { FileSpreadsheet } from 'lucide-react'

export default function ExcelImportButton({ fileName, onFile, label = 'Import Excel' }) {
  return (
    <label className="inline-flex h-10 cursor-pointer items-center justify-center gap-2 rounded-[10px] border border-[#dfe5df] bg-white px-4 text-xs font-bold text-[#57645d] transition hover:bg-[#f7faf7]">
      <FileSpreadsheet size={16} />
      {fileName || label}
      <input
        className="hidden"
        type="file"
        accept=".xlsx,.xls,.csv"
        onChange={event => onFile(event.target.files?.[0]?.name || '')}
      />
    </label>
  )
}

import { PackageCheck, X } from 'lucide-react'

export default function ImportNotice({ fileName, onClear, subject = 'data' }) {
  if (!fileName) return null

  return (
    <div className="mb-3 flex items-center gap-3 rounded-xl border border-[#cfe4d5] bg-[#eaf5ed] px-4 py-3 text-[10px] text-[#437257]">
      <PackageCheck size={16} />
      <span className="flex-1"><strong>{fileName}</strong> ready for {subject} validation and mock data update.</span>
      <button className="text-inherit" onClick={onClear}><X size={14} /></button>
    </div>
  )
}

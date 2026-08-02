import { PackageCheck, X } from 'lucide-react'

export default function ImportNotice({ fileName, onClear, subject = 'data' }) {
  if (!fileName) return null

  return (
    <div className="inventory-import-note">
      <PackageCheck size={16} />
      <span><strong>{fileName}</strong> ready for {subject} validation and mock data update.</span>
      <button onClick={onClear}><X size={14} /></button>
    </div>
  )
}

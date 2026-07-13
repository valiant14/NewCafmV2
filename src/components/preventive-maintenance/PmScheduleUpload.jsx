import { Check, FileSpreadsheet, Upload } from 'lucide-react'
import Button from '../ui/Button'

export default function PmScheduleUpload({ headers, upload, setUpload, onCancel, onImport, onDownloadTemplate }) {
  return (
    <section className="space-y-5">
      <header className="rounded-3xl border border-[var(--app-line)] bg-white p-6 shadow-[0_12px_32px_rgba(32,55,45,.07)]">
        <button className="mb-4 text-xs font-bold text-[#577066]" onClick={onCancel}>← PM Schedule</button>
        <span className="text-[9px] font-extrabold uppercase tracking-[.18em] text-[#7a8780]">BULK MAXIMO MASTER DATA</span>
        <h1 className="mt-1 text-3xl font-extrabold tracking-[-.045em] text-[var(--app-ink)]">Upload PM schedules</h1>
        <p className="mt-1 text-sm text-[var(--app-muted)]">The template uses the exact 19 Excel columns provided.</p>
      </header>

      <div className="grid gap-5 xl:grid-cols-[1fr_360px]">
        <section className="rounded-3xl border border-[var(--app-line)] bg-white p-5 shadow-[0_8px_24px_rgba(32,55,45,.06)]">
          <div className="mb-5 grid gap-3 md:grid-cols-3">
            {['Download template', 'Upload & validate', 'Create schedules'].map((step, index) => (
              <div className="rounded-2xl bg-[#f8faf7] p-4" key={step}><b className="text-[#315a47]">{index + 1}</b><span className="ml-2 text-sm font-bold text-[var(--app-ink)]">{step}</span></div>
            ))}
          </div>
          <div className="mb-5 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-[#e4ebe4] bg-[#fbfcfa] p-4">
            <div className="flex items-center gap-3"><FileSpreadsheet className="text-[#477e63]" /><div><strong>PM_Master_Upload_Template.csv</strong><span className="block text-xs text-[var(--app-muted)]">19 matching columns · opens in Excel</span></div></div>
            <Button variant="outline" onClick={onDownloadTemplate}>Download template</Button>
          </div>
          <label className={`grid cursor-pointer place-items-center rounded-3xl border border-dashed p-10 text-center transition ${upload ? 'border-[#8fb79f] bg-[#f1f8f3]' : 'border-[#ccd8cf] bg-[#fbfcfa]'}`}>
            <input className="hidden" type="file" accept=".xlsx,.xls,.csv" onChange={event => setUpload(event.target.files?.[0] || null)} />
            <Upload className="text-[#60766b]" />
            <strong className="mt-3 text-[var(--app-ink)]">{upload ? upload.name : 'Drop Excel file here or browse'}</strong>
            <span className="mt-1 text-sm text-[var(--app-muted)]">{upload ? 'Ready to validate against the 19-column PM structure' : 'Accepted: .xlsx, .xls, .csv'}</span>
          </label>
          {upload && <div className="mt-5 flex gap-3 rounded-2xl border border-[#dce8df] bg-[#f1f8f3] p-4 text-[#315a47]"><Check /><div><strong>PM workbook ready</strong><span className="block text-xs">Headers will be matched exactly; blank rows are ignored.</span></div></div>}
          <Button className="mt-5 w-full" disabled={!upload} onClick={onImport}><Upload size={16} />Import PM schedules</Button>
        </section>

        <aside className="rounded-3xl border border-[var(--app-line)] bg-white p-5 shadow-[0_8px_24px_rgba(32,55,45,.06)]">
          <h3 className="font-extrabold text-[var(--app-ink)]">Exact Excel columns</h3>
          <div className="mt-4 grid gap-2">
            {headers.map((header, index) => <div className="grid grid-cols-[32px_1fr_auto] items-center gap-2 rounded-xl bg-[#f8faf7] p-2 text-xs" key={header}><b>{index + 1}</b><span>{header}</span><Check size={14} /></div>)}
          </div>
        </aside>
      </div>
    </section>
  )
}

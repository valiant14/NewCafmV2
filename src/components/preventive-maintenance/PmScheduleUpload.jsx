import { ArrowLeft, Check, FileSpreadsheet, Upload } from 'lucide-react'
import Alert from '../ui/Alert'
import Button from '../ui/Button'
import PageHeader from '../ui/PageHeader'
import Surface, { SurfaceHeader } from '../ui/Surface'

export default function PmScheduleUpload({ headers, upload, setUpload, onCancel, onImport, onDownloadTemplate }) {
  return (
    <section>
      <PageHeader
        eyebrow="Bulk Maximo master data"
        title="Upload PM schedules"
        description="The template uses the exact 19 Excel columns provided."
        actions={<Button variant="ghost" onClick={onCancel}><ArrowLeft size={15} />PM Schedule</Button>}
      />

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_340px]">
        <Surface>
          <ol className="app-process-steps">
            {['Download template', 'Upload and validate', 'Create schedules'].map((step, index) => (
              <li className="app-process-step" key={step}><b>{index + 1}</b><span>{step}</span></li>
            ))}
          </ol>

          <div className="app-file-template">
            <div className="flex min-w-0 items-center gap-3">
              <FileSpreadsheet className="shrink-0 text-[var(--app-primary)]" />
              <div className="min-w-0">
                <strong className="block truncate text-sm text-[var(--app-ink)]">PM_Master_Upload_Template.csv</strong>
                <span className="block text-xs text-[var(--app-muted)]">19 matching columns, opens in Excel</span>
              </div>
            </div>
            <Button variant="outline" onClick={onDownloadTemplate}>Download template</Button>
          </div>

          <label className={`app-upload-zone ${upload ? 'app-upload-zone--ready' : ''}`}>
            <input className="hidden" type="file" accept=".xlsx,.xls,.csv" onChange={event => setUpload(event.target.files?.[0] || null)} />
            <Upload />
            <strong>{upload ? upload.name : 'Drop Excel file here or browse'}</strong>
            <span>{upload ? 'Ready to validate against the 19-column PM structure' : 'Accepted: .xlsx, .xls, .csv'}</span>
          </label>

          {upload && <Alert className="mt-4" tone="success" title="PM workbook ready">Headers will be matched exactly; blank rows are ignored.</Alert>}
          <Button className="mt-4 w-full" disabled={!upload} onClick={onImport}><Upload size={16} />Import PM schedules</Button>
        </Surface>

        <Surface as="aside" flush>
          <SurfaceHeader title="Exact Excel columns" description="Columns are matched by header name." />
          <div className="app-column-list">
            {headers.map((header, index) => (
              <div className="app-column-item" key={header}>
                <b>{index + 1}</b>
                <span>{header}</span>
                <Check size={14} />
              </div>
            ))}
          </div>
        </Surface>
      </div>
    </section>
  )
}

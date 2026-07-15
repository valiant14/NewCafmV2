import { AlertTriangle, Check, FileText, ShieldCheck, Upload, X } from 'lucide-react'
import Badge from '../ui/Badge'

const workspaceClass = 'grid gap-3 lg:grid-cols-2'
const ptwCardClass = required => `flex flex-wrap items-center justify-between gap-4 rounded-2xl border bg-[var(--app-panel)] p-3 ${required ? 'border-[var(--warning)]' : 'border-[var(--app-line)]'} lg:col-span-2`
const toggleButtonClass = active => `rounded-lg px-4 py-2 text-xs font-bold transition ${active ? 'bg-[var(--app-panel)] text-[var(--app-primary)] shadow-sm' : 'text-[var(--app-muted)] hover:text-[var(--app-primary)]'}`
const documentCardClass = 'rounded-2xl border border-[var(--app-line)] bg-[var(--app-panel)] p-3 [&>header]:mb-3 [&>header]:flex [&>header]:items-start [&>header]:justify-between [&>header]:gap-3 [&>header]:border-b [&>header]:border-[var(--app-line)] [&>header]:pb-3 [&_header_span]:text-[9px] [&_header_span]:font-extrabold [&_header_span]:uppercase [&_header_span]:tracking-[.12em] [&_header_span]:text-[var(--app-muted)] [&_header_h3]:mt-1 [&_header_h3]:text-base [&_header_h3]:font-extrabold [&_header_h3]:text-[var(--app-ink)] [&_header_p]:mt-1 [&_header_p]:text-xs [&_header_p]:text-[var(--app-muted)]'
const uploadClass = 'relative mb-4 grid cursor-pointer place-items-center gap-2 rounded-2xl border border-dashed border-[var(--app-field-border)] bg-[var(--app-soft-bg)] p-6 text-center text-[var(--app-muted)]'
const listClass = 'grid overflow-hidden rounded-2xl border border-[var(--app-line)] [&>div]:flex [&>div]:items-center [&>div]:gap-3 [&>div]:border-b [&>div]:border-[var(--app-line)] [&>div]:p-3 [&>div:last-child]:border-b-0 [&_strong]:text-sm [&_strong]:text-[var(--app-ink)] [&_small]:text-xs [&_small]:text-[var(--app-muted)]'
const actionsClass = 'ml-auto flex shrink-0 items-center gap-2'
const downloadButtonClass = 'inline-flex h-8 items-center justify-center rounded-lg border border-[var(--app-line)] bg-[var(--app-panel)] px-3 text-xs font-bold text-[var(--app-muted)] transition hover:bg-[var(--app-soft-bg-hover)] hover:text-[var(--app-ink)]'
const removeButtonClass = 'inline-flex h-8 w-8 items-center justify-center rounded-lg text-[var(--app-muted)] transition hover:bg-[var(--app-badge-orange-bg)] hover:text-[var(--app-badge-orange-text)]'

function FileRow({ file, label, showBadge, onDownload, onRemove, removeLabel }) {
  return (
    <div>
      <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-[var(--app-badge-green-bg)] text-[var(--app-badge-green-text)]">
        <FileText size={16} />
      </span>
      <div className="min-w-0">
        <strong className="block truncate">{file.name}</strong>
        <small>{file.size} · {label}</small>
      </div>
      {showBadge && <Badge tone="green">Attached</Badge>}
      <div className={actionsClass}>
        <button className={downloadButtonClass} onClick={onDownload}>Download</button>
        <button className={removeButtonClass} aria-label={removeLabel} onClick={onRemove}><X size={14} /></button>
      </div>
    </div>
  )
}

export default function WorkOrderDocumentsTab({
  ptwRequired,
  setPtwRequired,
  ptwFiles,
  setPtwFiles,
  generalFiles,
  setGeneralFiles,
  addFiles,
  downloadFile
}) {
  return (
    <div className={workspaceClass}>
      <section className={ptwCardClass(ptwRequired)}>
        <div className="flex items-center gap-3">
          <span className="grid h-9 w-9 place-items-center rounded-xl bg-[var(--app-badge-green-bg)] text-[var(--app-badge-green-text)]"><ShieldCheck size={20} /></span>
          <div>
            <strong>Permit to Work required?</strong>
            <p className="text-xs text-[var(--app-muted)]">Default is No. Enable only when execution requires an approved permit.</p>
          </div>
        </div>
        <div className="flex rounded-xl border border-[var(--app-line)] bg-[var(--app-soft-bg)] p-1">
          <button className={toggleButtonClass(!ptwRequired)} onClick={() => setPtwRequired(false)}>No</button>
          <button className={toggleButtonClass(ptwRequired)} onClick={() => setPtwRequired(true)}>Yes</button>
        </div>
      </section>

      {ptwRequired ? (
        <section className={documentCardClass}>
          <header>
            <div><span>PTW</span><h3>Permit documents</h3><p>Upload one or more approved permits before execution.</p></div>
            <Badge tone={ptwFiles.length ? 'green' : 'orange'}>{ptwFiles.length ? 'Permit attached' : 'Permit missing'}</Badge>
          </header>
          <label className={uploadClass}>
            <Upload size={18} />
            <div><strong>Add PTW documents</strong><span>PDF, DOCX, JPG or PNG · multiple files accepted</span></div>
            <input type="file" multiple onChange={addFiles(setPtwFiles)} />
          </label>
          {ptwFiles.length > 0 && (
            <div className={listClass}>
              {ptwFiles.map((file, index) => (
                <FileRow
                  key={`${file.name}-${index}`}
                  file={file}
                  label="PTW document"
                  showBadge
                  onDownload={() => downloadFile(file)}
                  onRemove={() => setPtwFiles(files => files.filter((_, i) => i !== index))}
                  removeLabel="Remove PTW document"
                />
              ))}
            </div>
          )}
          {!ptwFiles.length && (
            <div className="m-3 flex items-center gap-2 rounded-xl bg-[var(--app-badge-orange-bg)] p-3 text-xs text-[var(--app-badge-orange-text)]">
              <AlertTriangle size={16} />
              <span>Work Order status is HOLD until a PTW document is attached.</span>
            </div>
          )}
        </section>
      ) : (
        <section className="flex min-h-40 items-center justify-center gap-3 rounded-2xl border border-[var(--app-line)] bg-[var(--app-panel)] p-3 text-[var(--success)]">
          <Check size={18} />
          <div><strong>No permit required</strong><span className="block text-xs text-[var(--app-muted)]">This work order can proceed without a Permit to Work.</span></div>
        </section>
      )}

      <section className={documentCardClass}>
        <header>
          <div><span>FILES</span><h3>General attachments</h3><p>Photos, reports, drawings, and supporting documents.</p></div>
          <Badge>{generalFiles.length} files</Badge>
        </header>
        <label className={uploadClass}>
          <Upload size={18} />
          <div><strong>Add attachments</strong><span>Choose multiple files if needed</span></div>
          <input type="file" multiple onChange={addFiles(setGeneralFiles)} />
        </label>
        <div className={listClass}>
          {generalFiles.map((file, index) => (
            <FileRow
              key={`${file.name}-${index}`}
              file={file}
              label={file.type}
              onDownload={() => downloadFile(file)}
              onRemove={() => setGeneralFiles(files => files.filter((_, i) => i !== index))}
              removeLabel="Remove attachment"
            />
          ))}
        </div>
      </section>
    </div>
  )
}

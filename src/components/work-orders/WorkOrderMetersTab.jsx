import { ExternalLink, Gauge } from 'lucide-react'
import Badge from '../ui/Badge'
import Field from '../ui/Field'
import Section from '../ui/Section'

const noteClass = 'flex items-start gap-3 rounded-2xl bg-[var(--app-badge-green-bg)] p-4 text-[var(--app-badge-green-text)]'
const formGridClass = 'grid grid-cols-1 gap-4 md:grid-cols-[1.2fr_.8fr_.8fr]'
const selectClass = 'h-11 w-full rounded-xl border border-[var(--app-field-border)] bg-[var(--app-panel)] px-3 text-sm text-[var(--app-ink)] outline-none transition focus:border-[var(--app-field-focus)] focus:ring-4 focus:ring-[var(--app-field-focus-ring)]'

const same = (left, right) => String(left || '').trim().toLowerCase() === String(right || '').trim().toLowerCase()
const openMeter = meterId => {
  window.history.pushState({}, '', `/meters/${encodeURIComponent(meterId)}`)
  window.dispatchEvent(new PopStateEvent('popstate'))
}

const relatedMetersForAsset = (meterRows, assetValue) => [...new Map(meterRows
  .filter(row => row.meterId)
  .filter(row => !assetValue || same(row.asset, assetValue))
  .map(row => [row.meterId, row])).values()]

export default function WorkOrderMetersTab({
  workOrderNumber,
  assetValue,
  siteValue,
  department,
  meterRows = [],
  meterId,
  setMeterId,
  meterReading,
  setMeterReading,
  meterReadingDate,
  setMeterReadingDate
}) {
  const meterOptions = relatedMetersForAsset(meterRows, assetValue)
  const selectedMeter = meterOptions.find(row => row.meterId === meterId) || null
  const savedRow = meterRows
    .filter(row => String(row.workOrder) === String(workOrderNumber))
    .filter(row => row.meterId === meterId)
    .sort((left, right) => String(right.readingDate || '').localeCompare(String(left.readingDate || '')))[0]
  const relatedRow = meterId && meterReading !== '' ? {
    ...(savedRow || {}),
    meterId,
    meterType: selectedMeter?.meterType || savedRow?.meterType || 'General',
    reading: meterReading,
    unit: selectedMeter?.unit || savedRow?.unit || '',
    asset: assetValue,
    site: siteValue,
    department,
    readingDate: meterReadingDate
  } : null

  return (
    <>
      <div className={noteClass}>
        <Gauge size={18} />
        <div className="grid gap-1">
          <strong className="text-sm">Select the related asset meter first</strong>
          <span className="text-xs text-[var(--app-muted)]">Choose one meter from /meters for this asset, then post the new reading value.</span>
        </div>
      </div>

      <Section compact title="Meter Reading">
        <div className={formGridClass}>
          <label className="grid gap-2">
            <span className="text-[10px] font-extrabold uppercase tracking-[.12em] text-[var(--app-muted)]">Related Meter</span>
            <select
              className={selectClass}
              value={meterId}
              onChange={event => {
                setMeterId(event.target.value)
                if (!event.target.value) setMeterReading('')
              }}
            >
              <option value="">Select asset meter first</option>
              {meterOptions.map(row => (
                <option key={row.meterId} value={row.meterId}>
                  {row.meterId}{row.meterType ? ` · ${row.meterType}` : ''}{row.unit ? ` · ${row.unit}` : ''}{row.reading ? ` · Last ${row.reading}` : ''}
                </option>
              ))}
            </select>
          </label>
          <Field label={`Reading Value${selectedMeter?.unit ? ` (${selectedMeter.unit})` : ''}`} value={meterReading} onChange={event => setMeterReading(event.target.value)} type="number" locked={!meterId} placeholder={meterId ? 'Enter reading value' : 'Select meter first'} />
          <Field label="Reading Date" value={meterReadingDate} onChange={event => setMeterReadingDate(event.target.value)} type="datetime-local" locked={!meterId} />
        </div>
        {!meterOptions.length && (
          <p className="mt-4 rounded-2xl border border-dashed border-[var(--app-line)] p-4 text-sm text-[var(--app-muted)]">No /meters record is linked to asset {assetValue || '-'}. Add the meter in /meters first.</p>
        )}
      </Section>

      <Section compact title="Related /meters record">
        {relatedRow ? (
          <div className="overflow-hidden rounded-2xl border border-[var(--app-line)]">
            <table className="w-full border-collapse text-left text-xs">
              <thead>
                <tr className="border-b border-[var(--app-line)] bg-[var(--app-table-header-bg)] text-[9px] font-extrabold uppercase tracking-[.1em] text-[var(--app-table-heading)]">
                  <th className="px-4 py-3">Meter ID</th>
                  <th className="px-4 py-3">Type</th>
                  <th className="px-4 py-3">Reading</th>
                  <th className="px-4 py-3">Asset</th>
                  <th className="px-4 py-3">Date</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3"></th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td className="px-4 py-3 font-bold text-[var(--app-ink)]">{relatedRow.meterId}</td>
                  <td className="px-4 py-3">{relatedRow.meterType}</td>
                  <td className="px-4 py-3 font-bold">{relatedRow.reading} {relatedRow.unit}</td>
                  <td className="px-4 py-3">{relatedRow.asset || '-'}</td>
                  <td className="px-4 py-3">{relatedRow.readingDate || '-'}</td>
                  <td className="px-4 py-3"><Badge tone={relatedRow.meterReadingId ? 'green' : 'orange'}>{relatedRow.meterReadingId ? 'Saved in /meters' : 'Auto-saving'}</Badge></td>
                  <td className="px-4 py-3 text-right">
                    <button type="button" className="inline-flex h-8 items-center gap-2 rounded-lg border border-[var(--app-line)] px-3 text-xs font-bold text-[var(--app-muted)] hover:bg-[var(--app-soft-bg-hover)] hover:text-[var(--app-ink)]" onClick={() => openMeter(relatedRow.meterId)}>
                      <ExternalLink size={14} />Open
                    </button>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        ) : (
          <p className="rounded-2xl border border-dashed border-[var(--app-line)] p-4 text-sm text-[var(--app-muted)]">Select a meter related to this asset, then enter the reading value.</p>
        )}
      </Section>
    </>
  )
}

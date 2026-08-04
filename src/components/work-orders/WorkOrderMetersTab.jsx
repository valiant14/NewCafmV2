import { ExternalLink } from 'lucide-react'
import Badge from '../ui/Badge'
import Field from '../ui/Field'
import Section from '../ui/Section'

const formGridClass = 'grid grid-cols-1 gap-4 md:grid-cols-[1.2fr_.8fr_.8fr]'

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
  const savedRows = meterRows
    .filter(row => row.meterId === meterId || (selectedMeter?.asset && same(row.asset, selectedMeter.asset)))
    .sort((left, right) => String(right.readingDate || '').localeCompare(String(left.readingDate || '')))
  const historicalRows = savedRows

  return (
    <>
      <Section compact title="Meter Reading">
        <div className={formGridClass}>
          <Field
            label="Related Meter"
            value={meterId}
            suggestions={[{ value: '', label: 'None' }, ...meterOptions.map(row => ({
              value: row.meterId,
              label: [row.meterType, row.unit, row.reading ? `Last ${row.reading}` : ''].filter(Boolean).join(' / ')
            }))]}
            onChange={event => {
              setMeterId(event.target.value)
              if (!event.target.value) setMeterReading('')
            }}
            placeholder="Select asset meter first"
          />
          <Field label={`Reading Value${selectedMeter?.unit ? ` (${selectedMeter.unit})` : ''}`} value={meterReading} onChange={event => setMeterReading(event.target.value)} type="number" locked={!meterId} placeholder={meterId ? 'Enter reading value' : 'Select meter first'} />
          <Field label="Reading Date" value={meterReadingDate} onChange={event => setMeterReadingDate(event.target.value)} type="datetime-local" locked={!meterId} />
        </div>
        {!meterOptions.length && (
          <p className="mt-4 rounded-2xl border border-dashed border-[var(--app-line)] p-4 text-sm text-[var(--app-muted)]">No /meters record is linked to asset {assetValue || '-'}. Add the meter in /meters first.</p>
        )}
      </Section>

      <Section compact title="Meter Reading History">
        {historicalRows.length ? (
          <div className="overflow-hidden rounded-2xl border border-[var(--app-line)]">
            <table className="w-full border-collapse text-left text-xs">
              <thead>
                <tr className="border-b border-[var(--app-line)] bg-[var(--app-table-header-bg)] text-[9px] font-extrabold uppercase tracking-[.1em] text-[var(--app-table-heading)]">
                  <th className="px-4 py-3">Meter ID</th>
                  <th className="px-4 py-3">Type</th>
                  <th className="px-4 py-3">Reading</th>
                  <th className="px-4 py-3">Asset</th>
                  <th className="px-4 py-3">Work Order</th>
                  <th className="px-4 py-3">Date</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3"></th>
                </tr>
              </thead>
              <tbody>
                {historicalRows.map((row, index) => (
                  <tr key={`${row.meterId}-${row.readingDate}-${row.workOrder || 'standalone'}-${index}`} className="border-b border-[var(--app-line)] last:border-b-0">
                    <td className="px-4 py-3 font-bold text-[var(--app-ink)]">{row.meterId}</td>
                    <td className="px-4 py-3">{row.meterType}</td>
                    <td className="px-4 py-3 font-bold">{row.reading} {row.unit}</td>
                    <td className="px-4 py-3">{row.asset || '-'}</td>
                    <td className="px-4 py-3">{row.workOrder || '-'}</td>
                    <td className="px-4 py-3">{row.readingDate || '-'}</td>
                    <td className="px-4 py-3"><Badge tone="green">{row.status || 'Posted'}</Badge></td>
                    <td className="px-4 py-3 text-right">
                      <button type="button" className="inline-flex h-8 items-center gap-2 rounded-lg border border-[var(--app-line)] px-3 text-xs font-bold text-[var(--app-muted)] hover:bg-[var(--app-soft-bg-hover)] hover:text-[var(--app-ink)]" onClick={() => openMeter(row.meterId)}>
                        <ExternalLink size={14} />Open
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="rounded-2xl border border-dashed border-[var(--app-line)] p-4 text-sm text-[var(--app-muted)]">Select a meter related to this asset to see its history and related work orders.</p>
        )}
      </Section>
    </>
  )
}

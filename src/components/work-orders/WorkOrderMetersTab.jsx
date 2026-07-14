import { Gauge } from 'lucide-react'
import Field from '../ui/Field'
import Section from '../ui/Section'

const noteClass = 'flex items-start gap-3 rounded-2xl bg-[var(--app-badge-green-bg)] p-4 text-[var(--app-badge-green-text)]'
const formGridClass = 'grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4'

export default function WorkOrderMetersTab({
  meterReading,
  setMeterReading,
  waterConsumption,
  setWaterConsumption,
  energyConsumption,
  setEnergyConsumption,
  meterReadingDate,
  setMeterReadingDate
}) {
  return (
    <>
      <div className={noteClass}>
        <Gauge size={18} />
        <div className="grid gap-1">
          <strong className="text-sm">Optional meter readings</strong>
          <span className="text-xs text-[var(--app-muted)]">Complete only when readings are available or required by the related asset.</span>
        </div>
      </div>

      <Section compact title="Meter Readings">
        <div className={formGridClass}>
          <Field label="General Meter Reading" value={meterReading} onChange={event => setMeterReading(event.target.value)} type="number" />
          <Field label="Water Consumption (m³)" value={waterConsumption} onChange={event => setWaterConsumption(event.target.value)} type="number" />
          <Field label="Energy Consumption (kWh)" value={energyConsumption} onChange={event => setEnergyConsumption(event.target.value)} type="number" />
          <Field label="Reading Date" value={meterReadingDate} onChange={event => setMeterReadingDate(event.target.value)} type="datetime-local" />
        </div>
      </Section>
    </>
  )
}

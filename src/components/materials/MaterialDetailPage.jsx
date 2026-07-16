import { Archive, BarChart3, Boxes, ClipboardList, PackageCheck, Warehouse } from 'lucide-react'
import { DetailHeader, DetailTabs, InfoCard } from '../ui/DetailScaffold'
import GenericPrintReport from '../ui/GenericPrintReport'

const statusTone = {
  Available: 'green',
  'Purchase Required': 'orange'
}

const materialStatuses = ['Available', 'Purchase Required']

function stockState(material) {
  const available = Math.max(0, Number(material.balance || 0) - Number(material.reserved || 0))
  const reorderLevel = Number(material.reorderLevel || 0)
  const coverage = reorderLevel ? Math.min(100, Math.round((available / reorderLevel) * 100)) : 100
  const needsPurchase = material.availability === 'Purchase Required' || available <= reorderLevel

  return { available, coverage, needsPurchase }
}

export default function MaterialDetailPage({ material, onBack, onUpdate }) {
  const stock = stockState(material)
  const tone = statusTone[material.availability] || 'green'
  const changeStatus = event => onUpdate?.(material.itemNumber, { availability: event.target.value })

  return (
    <section className="printable-record">
      <div className="print-report-screen space-y-5">
        <DetailHeader
          eyebrow="INVENTORY MATERIAL"
          id={material.itemNumber}
          title={material.description}
          status={material.availability}
          statusTone={tone}
          onBack={onBack}
          backLabel="Back to materials"
          stats={[
            { label: 'Unit', value: material.unit },
            { label: 'Storeroom', value: material.storeroom },
            { label: 'Available Balance', value: `${stock.available} ${material.unit}` },
            { label: 'Reserved', value: `${material.reserved || 0} ${material.unit}` }
          ]}
          actions={(
            <label className="flex items-center gap-2 rounded-xl border border-[var(--app-line)] bg-[var(--app-panel)] px-3 py-2 text-xs font-bold text-[var(--app-muted)]">
              Status
              <select
                value={material.availability}
                onChange={changeStatus}
                className="min-w-[170px] rounded-xl border border-[var(--app-line)] bg-[var(--app-panel)] px-3 py-2 text-xs font-extrabold text-[var(--app-ink)] outline-none focus:border-[var(--app-primary)]"
              >
                {materialStatuses.map(status => <option key={status} value={status}>{status}</option>)}
              </select>
            </label>
          )}
        />

        <DetailTabs tabs={['Material Details']} />

        <main className="space-y-4">
          <section className="grid gap-3 md:grid-cols-4">
            {[
              { icon: Boxes, label: 'Balance', value: material.balance, note: `Total ${material.unit}` },
              { icon: ClipboardList, label: 'Reserved', value: material.reserved || 0, note: 'Committed' },
              { icon: PackageCheck, label: 'Available', value: stock.available, note: `Ready ${material.unit}` },
              { icon: BarChart3, label: 'Reorder Level', value: material.reorderLevel, note: `${stock.coverage}% coverage` }
            ].map(metric => {
              const Icon = metric.icon
              return (
                <div key={metric.label} className="rounded-2xl border border-[var(--app-line)] bg-[var(--app-panel)] p-4 shadow-[0_8px_24px_rgba(32,55,45,.05)]">
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-[9px] font-extrabold uppercase tracking-[.14em] text-[var(--app-muted)]">{metric.label}</span>
                    <Icon size={16} className="text-[var(--app-primary)]" />
                  </div>
                  <strong className="mt-2 block text-2xl font-extrabold tracking-[-.04em] text-[var(--app-ink)]">{metric.value}</strong>
                  <small className="text-[11px] font-semibold text-[var(--app-muted)]">{metric.note}</small>
                </div>
              )
            })}
          </section>

          <section className="grid gap-4 lg:grid-cols-2">
          <InfoCard
            icon={Archive}
            kicker="ITEM"
            title="Material Information"
            items={[
              ['Description', material.description],
              ['Item Number', material.itemNumber],
              ['Category', material.category],
              ['Unit', material.unit]
            ]}
          />

          <InfoCard
            icon={Warehouse}
            kicker="INVENTORY"
            title="Stock Position"
            items={[
              ['Storeroom', material.storeroom],
              ['Current Balance', material.balance],
              ['Reserved', material.reserved],
              ['Available Balance', stock.available],
              ['Status', material.availability],
              ['Purchase Required', stock.needsPurchase ? 'Yes' : 'No']
            ]}
          />
          </section>
        </main>
      </div>
      <GenericPrintReport
        reportTitle="Material Report"
        reportSubtitle="Inventory material report"
        number={material.itemNumber}
        status={material.availability}
        description={material.description}
        summary={[['Category', material.category], ['Storeroom', material.storeroom], ['Available', `${stock.available} ${material.unit}`]]}
        sections={[
          { title: 'Material Information', rows: [[['Item Number', material.itemNumber], ['Description', material.description], ['Category', material.category], ['Unit', material.unit]]] },
          { title: 'Stock Position', rows: [[['Storeroom', material.storeroom], ['Balance', material.balance], ['Reserved', material.reserved], ['Available Balance', stock.available]]] },
          { title: 'Reorder Control', rows: [[['Reorder Level', material.reorderLevel], ['Status', material.availability], ['Coverage', `${stock.coverage}%`], ['Purchase Required', stock.needsPurchase ? 'Yes' : 'No']]] }
        ]}
      />
    </section>
  )
}

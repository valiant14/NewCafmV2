import { AlertTriangle, Archive, BadgeCheck, BarChart3, Boxes, ClipboardList, PackageCheck, Warehouse } from 'lucide-react'
import { DetailHeader, DetailTabs, FocusCard, InfoCard, ProfileStrip, TimelineCard } from '../ui/DetailScaffold'

const statusTone = {
  Available: 'green',
  'Purchase Required': 'orange'
}

function stockState(material) {
  const available = Math.max(0, Number(material.balance || 0) - Number(material.reserved || 0))
  const reorderLevel = Number(material.reorderLevel || 0)
  const coverage = reorderLevel ? Math.min(100, Math.round((available / reorderLevel) * 100)) : 100
  const needsPurchase = material.availability === 'Purchase Required' || available <= reorderLevel

  return { available, coverage, needsPurchase }
}

export default function MaterialDetailPage({ material, onBack }) {
  const stock = stockState(material)
  const tone = statusTone[material.availability] || 'green'

  return (
    <section className="space-y-5">
      <DetailHeader
        eyebrow="INVENTORY MATERIAL"
        id={material.itemNumber}
        title={material.description}
        status={material.availability}
        statusTone={tone}
        onBack={onBack}
        backLabel="Back to materials"
      />

      <ProfileStrip
        icon={PackageCheck}
        eyebrow="Inventory Item"
        title={material.description}
        description={`${material.category} · ${material.storeroom}`}
        stats={[
          { label: 'Unit', value: material.unit },
          { label: 'Available Balance', value: `${stock.available} ${material.unit}` }
        ]}
      />

      <DetailTabs tabs={['Material Details']} />

      <main className="grid gap-5 lg:grid-cols-2">
        <FocusCard
          icon={stock.needsPurchase ? AlertTriangle : BadgeCheck}
          eyebrow="STOCK READINESS"
          title={stock.needsPurchase ? 'Reorder attention required' : 'Stock ready for reservation'}
          description={`${stock.available} ${material.unit} available after reservations from ${material.balance} ${material.unit} total balance.`}
          progress={stock.coverage}
          warning={stock.needsPurchase}
          metrics={[
            { icon: Boxes, label: 'Balance', value: material.balance, note: `Total stock in ${material.storeroom}` },
            { icon: ClipboardList, label: 'Reserved', value: material.reserved, note: 'Committed to work orders' },
            { icon: BarChart3, label: 'Reorder Level', value: material.reorderLevel, note: 'Minimum planning level' }
          ]}
        />

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
            ['Available Balance', stock.available]
          ]}
        />

        <TimelineCard
          icon={PackageCheck}
          kicker="WORK ORDER USE"
          title="Material Request Context"
          rows={[
            { icon: BadgeCheck, text: 'Selectable from the Work Order Plan tab as a required material.', value: material.itemNumber },
            { icon: BadgeCheck, text: 'Reservations reduce available balance before issue confirmation.', value: `${material.reserved} reserved` },
            { icon: BadgeCheck, text: 'Status can guide purchasing before execution starts.', value: material.availability }
          ]}
        />
      </main>
    </section>
  )
}

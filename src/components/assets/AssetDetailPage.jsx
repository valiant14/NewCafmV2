import { BadgeCheck, Boxes, Building2, CalendarClock, ClipboardList, Factory, MapPin, ShieldCheck, Tag } from 'lucide-react'
import { DetailHeader, DetailTabs, FocusCard, InfoCard, ProfileStrip, TimelineCard } from '../ui/DetailScaffold'

export default function AssetDetailPage({ asset, workOrders = [], onBack }) {
  const assetWorkOrders = workOrders.filter(order => String(order.ASSET || '').trim() === String(asset.assetnum || '').trim())
  const openOrders = assetWorkOrders.filter(order => !['COMP', 'CLOSE', 'CAN'].includes(String(order.STATUS || '').toUpperCase()))
  const statusTone = asset.status === 'OPERATING' ? 'green' : asset.status === 'BROKEN' ? 'orange' : 'neutral'
  const healthy = asset.status === 'OPERATING'

  return (
    <section className="space-y-5">
      <DetailHeader
        eyebrow="ASSET MASTER"
        id={asset.assetnum}
        title={asset.description}
        status={asset.status || 'UNKNOWN'}
        statusTone={statusTone}
        onBack={onBack}
        backLabel="Back to assets"
        printLabel="Print asset"
      />

      <ProfileStrip
        icon={Boxes}
        tone={healthy ? 'default' : 'orange'}
        eyebrow="Maintainable Asset"
        title={asset.description}
        description={`${asset.location || 'No location'} · Site ${asset.site || '-'}`}
        stats={[
          { label: 'Department', value: asset.department || 'Not configured' },
          { label: 'Open Work Orders', value: openOrders.length }
        ]}
      />

      <DetailTabs tabs={['Asset Details']} />

      <main className="grid gap-5 lg:grid-cols-2">
        <FocusCard
          icon={healthy ? BadgeCheck : ShieldCheck}
          eyebrow="ASSET READINESS"
          title={healthy ? 'Asset operating and available' : 'Asset requires attention'}
          description={assetWorkOrders.length ? `${assetWorkOrders.length} work orders are linked to this asset record.` : 'No work orders are currently linked to this asset in the mock data.'}
          progress={healthy ? 92 : 45}
          warning={!healthy}
          metrics={[
            { icon: MapPin, label: 'Site', value: asset.site, note: asset.location || 'Location not set' },
            { icon: ClipboardList, label: 'Work Orders', value: assetWorkOrders.length, note: `${openOrders.length} currently open` },
            { icon: Tag, label: 'Priority', value: asset.prioity, note: 'Asset criticality from workbook' }
          ]}
        />

        <InfoCard
          icon={Boxes}
          kicker="IDENTITY"
          title="Asset Information"
          items={[
            ['Asset Number', asset.assetnum],
            ['Description', asset.description],
            ['Short Name', asset['asset short name']],
            ['Parent Asset', asset.parent]
          ]}
        />

        <InfoCard
          icon={Building2}
          kicker="LOCATION"
          title="Site Context"
          items={[
            ['Site', asset.site],
            ['Location', asset.location],
            ['Department', asset.department],
            ['Sub Department', asset['sub department']]
          ]}
        />

        <InfoCard
          icon={Factory}
          kicker="MANUFACTURER"
          title="Model & Serial"
          items={[
            ['Model Number', asset.modelnum],
            ['Serial Number', asset.serialnum],
            ['Install Date', asset.installdate],
            ['Quantity', asset.quantity]
          ]}
        />

        <TimelineCard
          icon={CalendarClock}
          kicker="MAINTENANCE CONTEXT"
          title="Work Order Relationship"
          rows={[
            { icon: BadgeCheck, text: 'Used in Service Request and Work Order asset selection.', value: asset.assetnum },
            { icon: BadgeCheck, text: 'Open maintenance activity linked to this asset.', value: `${openOrders.length} open` },
            { icon: BadgeCheck, text: 'Asset status controls operational visibility.', value: asset.status }
          ]}
        />
      </main>
    </section>
  )
}

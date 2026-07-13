import { BadgeCheck, Boxes, Building2, CalendarClock, ClipboardList, Factory, MapPin, Printer, ShieldCheck, Tag } from 'lucide-react'

function DetailItem({ label, value }) {
  return (
    <div>
      <span>{label}</span>
      <strong>{value || '-'}</strong>
    </div>
  )
}

function MetricCard({ icon: Icon, label, value, note }) {
  return (
    <article className="resource-metric-card">
      <Icon size={17} />
      <div>
        <span>{label}</span>
        <strong>{value || '-'}</strong>
        <small>{note}</small>
      </div>
    </article>
  )
}

export default function AssetDetailPage({ asset, workOrders = [], onBack }) {
  const assetWorkOrders = workOrders.filter(order => String(order.ASSET || '').trim() === String(asset.assetnum || '').trim())
  const openOrders = assetWorkOrders.filter(order => !['COMP', 'CLOSE', 'CAN'].includes(String(order.STATUS || '').toUpperCase()))
  const statusTone = asset.status === 'OPERATING' ? 'green' : asset.status === 'BROKEN' ? 'orange' : 'neutral'

  return (
    <section className="master-detail-page resource-detail-page asset-detail-page">
      <header className="record-page-header resource-detail-header">
        <div className="record-header-copy">
          <div className="record-header-nav">
            <button className="back-link" onClick={onBack}>← Back to assets</button>
            <span className="record-kicker">ASSET MASTER</span>
          </div>
          <div className="wo-title-line">
            <h1>{asset.assetnum}</h1>
            <span className={`badge ${statusTone}`}><i />{asset.status || 'UNKNOWN'}</span>
          </div>
          <p>{asset.description}</p>
        </div>

        <div className="record-header-actions">
          <button className="outline" onClick={() => window.print()}><Printer size={15} />Print asset</button>
        </div>
      </header>

      <section className="resource-profile-strip">
        <div className="resource-icon asset"><Boxes size={25} /></div>
        <div>
          <span>Maintainable Asset</span>
          <strong>{asset.description}</strong>
          <p>{asset.location || 'No location'} · Site {asset.site || '-'}</p>
        </div>
        <div className="resource-profile-status">
          <span>Department</span>
          <strong>{asset.department || 'Not configured'}</strong>
        </div>
        <div className="resource-profile-status">
          <span>Open Work Orders</span>
          <strong>{openOrders.length}</strong>
        </div>
      </section>

      <nav className="record-tabs">
        <button className="active">Asset Details</button>
      </nav>

      <main className="resource-detail-content">
        <section className="resource-focus-card">
          <div className="resource-focus-head">
            <div>
              <span>ASSET READINESS</span>
              <h2>{asset.status === 'OPERATING' ? 'Asset operating and available' : 'Asset requires attention'}</h2>
              <p>{assetWorkOrders.length ? `${assetWorkOrders.length} work orders are linked to this asset record.` : 'No work orders are currently linked to this asset in the mock data.'}</p>
            </div>
            {asset.status === 'OPERATING' ? <BadgeCheck size={30} /> : <ShieldCheck size={30} />}
          </div>

          <div className={`resource-readiness-bar ${asset.status === 'OPERATING' ? '' : 'warning'}`}>
            <span style={{ width: asset.status === 'OPERATING' ? '92%' : '45%' }} />
          </div>

          <div className="resource-metric-grid">
            <MetricCard icon={MapPin} label="Site" value={asset.site} note={asset.location || 'Location not set'} />
            <MetricCard icon={ClipboardList} label="Work Orders" value={assetWorkOrders.length} note={`${openOrders.length} currently open`} />
            <MetricCard icon={Tag} label="Priority" value={asset.prioity} note="Asset criticality from workbook" />
          </div>
        </section>

        <section className="resource-detail-card">
          <header>
            <Boxes size={18} />
            <div>
              <span>IDENTITY</span>
              <h2>Asset Information</h2>
            </div>
          </header>
          <div className="resource-detail-list">
            <DetailItem label="Asset Number" value={asset.assetnum} />
            <DetailItem label="Description" value={asset.description} />
            <DetailItem label="Short Name" value={asset['asset short name']} />
            <DetailItem label="Parent Asset" value={asset.parent} />
          </div>
        </section>

        <section className="resource-detail-card">
          <header>
            <Building2 size={18} />
            <div>
              <span>LOCATION</span>
              <h2>Site Context</h2>
            </div>
          </header>
          <div className="resource-detail-list">
            <DetailItem label="Site" value={asset.site} />
            <DetailItem label="Location" value={asset.location} />
            <DetailItem label="Department" value={asset.department} />
            <DetailItem label="Sub Department" value={asset['sub department']} />
          </div>
        </section>

        <section className="resource-detail-card">
          <header>
            <Factory size={18} />
            <div>
              <span>MANUFACTURER</span>
              <h2>Model & Serial</h2>
            </div>
          </header>
          <div className="resource-detail-list">
            <DetailItem label="Model Number" value={asset.modelnum} />
            <DetailItem label="Serial Number" value={asset.serialnum} />
            <DetailItem label="Install Date" value={asset.installdate} />
            <DetailItem label="Quantity" value={asset.quantity} />
          </div>
        </section>

        <section className="resource-detail-card resource-wide-card">
          <header>
            <CalendarClock size={18} />
            <div>
              <span>MAINTENANCE CONTEXT</span>
              <h2>Work Order Relationship</h2>
            </div>
          </header>
          <div className="resource-timeline">
            <div><BadgeCheck size={15} /><span>Used in Service Request and Work Order asset selection.</span><strong>{asset.assetnum}</strong></div>
            <div><BadgeCheck size={15} /><span>Open maintenance activity linked to this asset.</span><strong>{openOrders.length} open</strong></div>
            <div><BadgeCheck size={15} /><span>Asset status controls operational visibility.</span><strong>{asset.status}</strong></div>
          </div>
        </section>
      </main>
    </section>
  )
}

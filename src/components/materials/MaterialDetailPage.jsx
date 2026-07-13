import { AlertTriangle, Archive, BadgeCheck, BarChart3, Boxes, ClipboardList, PackageCheck, Printer, Warehouse } from 'lucide-react'

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
        <strong>{value}</strong>
        <small>{note}</small>
      </div>
    </article>
  )
}

export default function MaterialDetailPage({ material, onBack }) {
  const stock = stockState(material)
  const tone = statusTone[material.availability] || 'green'

  return (
    <section className="master-detail-page resource-detail-page material-detail-page">
      <header className="record-page-header resource-detail-header">
        <div className="record-header-copy">
          <div className="record-header-nav">
            <button className="back-link" onClick={onBack}>← Back to materials</button>
            <span className="record-kicker">INVENTORY MATERIAL</span>
          </div>
          <div className="wo-title-line">
            <h1>{material.itemNumber}</h1>
            <span className={`badge ${tone}`}><i />{material.availability}</span>
          </div>
          <p>{material.description}</p>
        </div>

        <div className="record-header-actions">
          <button className="outline" onClick={() => window.print()}><Printer size={15} />Print record</button>
        </div>
      </header>

      <section className="resource-profile-strip">
        <div className="resource-icon"><PackageCheck size={25} /></div>
        <div>
          <span>Inventory Item</span>
          <strong>{material.description}</strong>
          <p>{material.category} · {material.storeroom}</p>
        </div>
        <div className="resource-profile-status">
          <span>Unit</span>
          <strong>{material.unit}</strong>
        </div>
        <div className="resource-profile-status">
          <span>Available Balance</span>
          <strong>{stock.available} {material.unit}</strong>
        </div>
      </section>

      <nav className="record-tabs">
        <button className="active">Material Details</button>
      </nav>

      <main className="resource-detail-content">
        <section className="resource-focus-card">
          <div className="resource-focus-head">
            <div>
              <span>STOCK READINESS</span>
              <h2>{stock.needsPurchase ? 'Reorder attention required' : 'Stock ready for reservation'}</h2>
              <p>{stock.available} {material.unit} available after reservations from {material.balance} {material.unit} total balance.</p>
            </div>
            {stock.needsPurchase ? <AlertTriangle size={30} /> : <BadgeCheck size={30} />}
          </div>

          <div className={`resource-readiness-bar ${stock.needsPurchase ? 'warning' : ''}`}>
            <span style={{ width: `${stock.coverage}%` }} />
          </div>

          <div className="resource-metric-grid">
            <MetricCard icon={Boxes} label="Balance" value={material.balance} note={`Total stock in ${material.storeroom}`} />
            <MetricCard icon={ClipboardList} label="Reserved" value={material.reserved} note="Committed to work orders" />
            <MetricCard icon={BarChart3} label="Reorder Level" value={material.reorderLevel} note="Minimum planning level" />
          </div>
        </section>

        <section className="resource-detail-card">
          <header>
            <Archive size={18} />
            <div>
              <span>ITEM</span>
              <h2>Material Information</h2>
            </div>
          </header>
          <div className="resource-detail-list">
            <DetailItem label="Description" value={material.description} />
            <DetailItem label="Item Number" value={material.itemNumber} />
            <DetailItem label="Category" value={material.category} />
            <DetailItem label="Unit" value={material.unit} />
          </div>
        </section>

        <section className="resource-detail-card">
          <header>
            <Warehouse size={18} />
            <div>
              <span>INVENTORY</span>
              <h2>Stock Position</h2>
            </div>
          </header>
          <div className="resource-detail-list">
            <DetailItem label="Storeroom" value={material.storeroom} />
            <DetailItem label="Current Balance" value={material.balance} />
            <DetailItem label="Reserved" value={material.reserved} />
            <DetailItem label="Available Balance" value={stock.available} />
          </div>
        </section>

        <section className="resource-detail-card resource-wide-card">
          <header>
            <PackageCheck size={18} />
            <div>
              <span>WORK ORDER USE</span>
              <h2>Material Request Context</h2>
            </div>
          </header>
          <div className="resource-timeline">
            <div><BadgeCheck size={15} /><span>Selectable from the Work Order Plan tab as a required material.</span><strong>{material.itemNumber}</strong></div>
            <div><BadgeCheck size={15} /><span>Reservations reduce available balance before issue confirmation.</span><strong>{material.reserved} reserved</strong></div>
            <div><BadgeCheck size={15} /><span>Status can guide purchasing before execution starts.</span><strong>{material.availability}</strong></div>
          </div>
        </section>
      </main>
    </section>
  )
}

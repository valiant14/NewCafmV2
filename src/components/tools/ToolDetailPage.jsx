import { AlertTriangle, BadgeCheck, CalendarClock, ClipboardCheck, MapPin, Printer, ShieldCheck, TimerReset, Wrench } from 'lucide-react'

const statusTone = {
  Available: 'green',
  Allocated: 'orange',
  Maintenance: 'orange'
}

function daysUntil(dateValue) {
  if (!dateValue) return null
  const today = new Date('2026-07-12T00:00:00')
  const target = new Date(`${dateValue}T00:00:00`)
  return Math.ceil((target - today) / 86400000)
}

function inspectionState(tool) {
  const days = daysUntil(tool.inspectionDue)
  const dueSoon = days !== null && days <= 30
  const overdue = days !== null && days < 0
  const label = overdue ? 'Inspection overdue' : dueSoon ? 'Inspection due soon' : 'Inspection current'
  const progress = days === null ? 0 : Math.max(8, Math.min(100, Math.round((days / 120) * 100)))

  return { days, dueSoon, overdue, label, progress }
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

export default function ToolDetailPage({ tool, onBack }) {
  const inspection = inspectionState(tool)
  const tone = statusTone[tool.status] || 'green'
  const availableUnits = tool.status === 'Available' ? tool.quantity : Math.max(0, tool.quantity - 1)

  return (
    <section className="master-detail-page resource-detail-page tool-detail-page">
      <header className="record-page-header resource-detail-header">
        <div className="record-header-copy">
          <div className="record-header-nav">
            <button className="back-link" onClick={onBack}>← Back to tools</button>
            <span className="record-kicker">TOOL & EQUIPMENT</span>
          </div>
          <div className="wo-title-line">
            <h1>{tool.toolNumber}</h1>
            <span className={`badge ${tone}`}><i />{tool.status}</span>
          </div>
          <p>{tool.description}</p>
        </div>

        <div className="record-header-actions">
          <button className="outline" onClick={() => window.print()}><Printer size={15} />Print record</button>
        </div>
      </header>

      <section className="resource-profile-strip">
        <div className="resource-icon tool"><Wrench size={25} /></div>
        <div>
          <span>Controlled Resource</span>
          <strong>{tool.description}</strong>
          <p>{tool.category} · {tool.location}</p>
        </div>
        <div className="resource-profile-status">
          <span>Quantity</span>
          <strong>{tool.quantity}</strong>
        </div>
        <div className="resource-profile-status">
          <span>Inspection Due</span>
          <strong>{tool.inspectionDue || '-'}</strong>
        </div>
      </section>

      <nav className="record-tabs">
        <button className="active">Tool Details</button>
      </nav>

      <main className="resource-detail-content">
        <section className="resource-focus-card">
          <div className="resource-focus-head">
            <div>
              <span>RESOURCE READINESS</span>
              <h2>{tool.status === 'Available' && !inspection.dueSoon ? 'Ready for work order use' : inspection.label}</h2>
              <p>{availableUnits} unit{availableUnits === 1 ? '' : 's'} available from {tool.location}. Inspection due {tool.inspectionDue || 'not scheduled'}.</p>
            </div>
            {tool.status === 'Available' && !inspection.dueSoon ? <ShieldCheck size={30} /> : <AlertTriangle size={30} />}
          </div>

          <div className={`resource-readiness-bar ${tool.status !== 'Available' || inspection.dueSoon ? 'warning' : ''}`}>
            <span style={{ width: `${inspection.progress}%` }} />
          </div>

          <div className="resource-metric-grid">
            <MetricCard icon={ClipboardCheck} label="Status" value={tool.status} note="Current control state" />
            <MetricCard icon={Wrench} label="Available Units" value={availableUnits} note="Ready for planning" />
            <MetricCard icon={TimerReset} label="Inspection Window" value={inspection.days === null ? '-' : `${inspection.days}d`} note={inspection.label} />
          </div>
        </section>

        <section className="resource-detail-card">
          <header>
            <Wrench size={18} />
            <div>
              <span>RESOURCE</span>
              <h2>Tool Information</h2>
            </div>
          </header>
          <div className="resource-detail-list">
            <DetailItem label="Description" value={tool.description} />
            <DetailItem label="Tool Number" value={tool.toolNumber} />
            <DetailItem label="Category" value={tool.category} />
            <DetailItem label="Quantity" value={tool.quantity} />
          </div>
        </section>

        <section className="resource-detail-card">
          <header>
            <MapPin size={18} />
            <div>
              <span>CONTROL</span>
              <h2>Location & Inspection</h2>
            </div>
          </header>
          <div className="resource-detail-list">
            <DetailItem label="Location" value={tool.location} />
            <DetailItem label="Status" value={tool.status} />
            <DetailItem label="Inspection Due" value={tool.inspectionDue} />
            <DetailItem label="Inspection State" value={inspection.label} />
          </div>
        </section>

        <section className="resource-detail-card resource-wide-card">
          <header>
            <CalendarClock size={18} />
            <div>
              <span>WORK ORDER USE</span>
              <h2>Tool Request Context</h2>
            </div>
          </header>
          <div className="resource-timeline">
            <div><BadgeCheck size={15} /><span>Selectable from the Work Order Plan tab as a required tool or equipment.</span><strong>{tool.toolNumber}</strong></div>
            <div><BadgeCheck size={15} /><span>Status controls whether the resource is ready, allocated, or under maintenance.</span><strong>{tool.status}</strong></div>
            <div><BadgeCheck size={15} /><span>Inspection due date helps prevent unsafe equipment assignment.</span><strong>{tool.inspectionDue || '-'}</strong></div>
          </div>
        </section>
      </main>
    </section>
  )
}

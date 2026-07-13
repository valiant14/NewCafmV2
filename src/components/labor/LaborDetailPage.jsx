import { Activity, BadgeCheck, BriefcaseBusiness, CalendarDays, Clock3, Printer, ShieldCheck, UserRound, Wrench } from 'lucide-react'

const workloadByStatus = {
  Available: { openWork: 1, weekHours: 14, utilization: 42, nextAssignment: 'Ready for dispatch' },
  Assigned: { openWork: 3, weekHours: 31, utilization: 78, nextAssignment: 'Active work queue' },
  'On Leave': { openWork: 0, weekHours: 0, utilization: 0, nextAssignment: 'Unavailable' }
}

const toneByStatus = {
  Available: 'green',
  Assigned: 'orange',
  'On Leave': 'orange'
}

function initials(name) {
  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map(part => part[0])
    .join('')
    .toUpperCase()
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
    <article className="labor-metric-card">
      <Icon size={17} />
      <div>
        <span>{label}</span>
        <strong>{value}</strong>
        <small>{note}</small>
      </div>
    </article>
  )
}

export default function LaborDetailPage({ labor, onBack }) {
  const workload = workloadByStatus[labor.availability] || workloadByStatus.Available
  const statusTone = toneByStatus[labor.availability] || 'green'

  return (
    <section className="master-detail-page labor-detail-page">
      <header className="record-page-header labor-detail-header">
        <div className="record-header-copy">
          <div className="record-header-nav">
            <button className="back-link" onClick={onBack}>← Back to labor</button>
            <span className="record-kicker">LABOR RESOURCE</span>
          </div>
          <div className="wo-title-line">
            <h1>{labor.personId}</h1>
            <span className={`badge ${statusTone}`}><i />{labor.availability}</span>
          </div>
          <p>{labor.name} · {labor.craft}</p>
        </div>

        <div className="record-header-actions">
          <button className="outline" onClick={() => window.print()}><Printer size={15} />Print record</button>
        </div>
      </header>

      <section className="labor-profile-strip">
        <div className="labor-avatar">{initials(labor.name)}</div>
        <div>
          <span>Technician Profile</span>
          <strong>{labor.name}</strong>
          <p>{labor.craftCode} · {labor.department} / {labor.subDepartment}</p>
        </div>
        <div className="labor-profile-status">
          <span>Shift</span>
          <strong>{labor.shift}</strong>
        </div>
        <div className="labor-profile-status">
          <span>Next action</span>
          <strong>{workload.nextAssignment}</strong>
        </div>
      </section>

      <nav className="record-tabs">
        <button className="active">Labor Details</button>
      </nav>

      <main className="labor-detail-content">
        <section className="labor-focus-card">
          <div className="labor-focus-head">
            <div>
              <span>RESOURCE READINESS</span>
              <h2>{labor.availability === 'Available' ? 'Ready for assignment' : labor.availability}</h2>
              <p>{labor.craft} assigned to {labor.department} with {labor.shift.toLowerCase()} shift coverage.</p>
            </div>
            <ShieldCheck size={30} />
          </div>

          <div className="labor-readiness-bar">
            <span style={{ width: `${workload.utilization}%` }} />
          </div>

          <div className="labor-metric-grid">
            <MetricCard icon={BriefcaseBusiness} label="Open Work" value={workload.openWork} note="Current assigned workload" />
            <MetricCard icon={Clock3} label="Week Hours" value={`${workload.weekHours}h`} note="Planned labor capacity" />
            <MetricCard icon={Activity} label="Utilization" value={`${workload.utilization}%`} note="Mock schedule load" />
          </div>
        </section>

        <section className="labor-detail-card">
          <header>
            <UserRound size={18} />
            <div>
              <span>IDENTITY</span>
              <h2>Labor Information</h2>
            </div>
          </header>
          <div className="labor-detail-list">
            <DetailItem label="Name" value={labor.name} />
            <DetailItem label="Person ID" value={labor.personId} />
            <DetailItem label="Shift" value={labor.shift} />
            <DetailItem label="Availability" value={labor.availability} />
          </div>
        </section>

        <section className="labor-detail-card">
          <header>
            <Wrench size={18} />
            <div>
              <span>QUALIFICATION</span>
              <h2>Craft & Responsibility</h2>
            </div>
          </header>
          <div className="labor-detail-list">
            <DetailItem label="Craft Code" value={labor.craftCode} />
            <DetailItem label="Craft" value={labor.craft} />
            <DetailItem label="Department" value={labor.department} />
            <DetailItem label="Sub Department" value={labor.subDepartment} />
          </div>
        </section>

        <section className="labor-detail-card labor-wide-card">
          <header>
            <CalendarDays size={18} />
            <div>
              <span>WORK CONTEXT</span>
              <h2>Recent Planning Use</h2>
            </div>
          </header>
          <div className="labor-timeline">
            <div><BadgeCheck size={15} /><span>Craft can be selected in Work Order planning and actual labor.</span><strong>{labor.craftCode}</strong></div>
            <div><BadgeCheck size={15} /><span>Supervisor can dispatch this resource by department and work group.</span><strong>{labor.department}</strong></div>
            <div><BadgeCheck size={15} /><span>Availability is visible before assignment to avoid overbooking.</span><strong>{labor.availability}</strong></div>
          </div>
        </section>
      </main>
    </section>
  )
}

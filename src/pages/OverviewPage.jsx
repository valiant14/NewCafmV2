import { useState } from 'react'
import { Boxes, CalendarClock, ChevronRight, ClipboardList, MoreHorizontal, Plus, ShieldCheck, Sparkles } from 'lucide-react'
import Badge from '../components/ui/Badge'
import DataTable from '../components/ui/DataTable'
import ExcelImportButton from '../components/ui/ExcelImportButton'
import ImportNotice from '../components/ui/ImportNotice'
import { assets, excelDate, failureCodes, pmRecords, workOrders } from '../data/cafmData'

const Metric = ({ label, value, detail, icon: Icon, tone }) => (
  <article className="metric-card">
    <div className={`metric-icon ${tone}`}><Icon size={19} /></div>
    <div>
      <p>{label}</p>
      <strong>{value}</strong>
      <small>{detail}</small>
    </div>
    <button aria-label={`View ${label}`}><ChevronRight size={18} /></button>
  </article>
)

const Donut = ({ value, label }) => (
  <div className="donut-wrap">
    <div className="donut" style={{ '--value': value }}>
      <div>
        <strong>{value}%</strong>
        <span>{label}</span>
      </div>
    </div>
  </div>
)

export default function OverviewPage({ onNavigate }) {
  const [imported, setImported] = useState('')
  const operating = assets.filter(asset => asset.status === 'OPERATING').length

  return (
    <>
      <section className="welcome">
        <div>
          <Badge tone="green">Live workspace</Badge>
          <h1>Good morning, Ahmed.</h1>
          <p>Here is what needs attention across your facilities today.</p>
        </div>
        <div className="heading-actions">
          <ExcelImportButton fileName={imported} onFile={setImported} label="Import Excel data" />
          <button className="primary" onClick={() => onNavigate('Work Orders')}><Plus size={17} /> New work order</button>
        </div>
      </section>

      <ImportNotice fileName={imported} subject="workspace" onClear={() => setImported('')} />

      <section className="metrics">
        <Metric label="Open work orders" value={workOrders.length} detail="All awaiting approval" icon={ClipboardList} tone="orange" />
        <Metric label="Assets online" value={`${operating}/${assets.length}`} detail="100% operational" icon={Boxes} tone="green" />
        <Metric label="PM programs" value={pmRecords.length} detail="Recurring schedules" icon={CalendarClock} tone="blue" />
        <Metric label="Failure codes" value={failureCodes.length.toLocaleString()} detail="Searchable library" icon={ShieldCheck} tone="purple" />
      </section>

      <section className="overview-grid">
        <article className="panel work-panel">
          <header>
            <div>
              <p className="eyebrow">OPERATIONS</p>
              <h2>Active work orders</h2>
            </div>
            <button onClick={() => onNavigate('Work Orders')}>View all <ChevronRight size={16} /></button>
          </header>
          <DataTable
            rows={workOrders}
            search=""
            pageSize={5}
            columns={[
              { key: 'WORKORDER', label: 'Order', render: value => <strong className="mono">#{value}</strong> },
              { key: 'DESCRIPITION', label: 'Description' },
              { key: 'LOCATION PRIORTY', label: 'Location', render: value => <Badge tone={value?.trim() === 'VIP' ? 'purple' : 'orange'}>{value}</Badge> },
              { key: 'STATUS', label: 'Status', render: value => <Badge tone="orange">{value}</Badge> },
              { key: 'TARGET START ', label: 'Target', render: excelDate }
            ]}
          />
        </article>

        <aside className="side-stack">
          <article className="panel health">
            <header>
              <div>
                <p className="eyebrow">PORTFOLIO</p>
                <h2>Facility health</h2>
              </div>
              <MoreHorizontal />
            </header>
            <Donut value={96} label="healthy" />
            <div className="health-row"><span><i className="green-dot" />Operational</span><strong>{operating}</strong></div>
            <div className="health-row"><span><i className="orange-dot" />Open orders</span><strong>{workOrders.length}</strong></div>
          </article>

          <article className="insight-card">
            <div className="spark"><Sparkles size={18} /></div>
            <div>
              <span>SMART INSIGHT</span>
              <strong>All current work orders are PM-related.</strong>
              <p>Bundle technician visits by site to reduce travel time.</p>
            </div>
          </article>
        </aside>
      </section>

      <section className="panel schedule">
        <header>
          <div>
            <p className="eyebrow">MAINTENANCE</p>
            <h2>Preventive maintenance</h2>
          </div>
          <button onClick={() => onNavigate('Preventive Maintenance')}>Open schedule <ChevronRight size={16} /></button>
        </header>
        <div className="pm-strip">
          {pmRecords.slice(0, 4).map((pm, index) => (
            <div className="pm-item" key={pm.PMNUM}>
              <div className="date-tile">
                <span>{String(index + 14).padStart(2, '0')}</span>
                <small>JUL</small>
              </div>
              <div>
                <strong>{pm['PM DESCRIPTION']}</strong>
                <span>{pm.ASSETNUM} - {pm.FREQUENCY} {pm.FREQUNIT}</span>
              </div>
              <Badge tone={index === 0 ? 'orange' : 'blue'}>{index === 0 ? 'Due soon' : 'Scheduled'}</Badge>
            </div>
          ))}
        </div>
      </section>
    </>
  )
}

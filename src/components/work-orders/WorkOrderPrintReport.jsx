const PrintCell = ({ label, value }) => (
  <div className="wo-print-cell">
    <span>{label}</span>
    <strong>{value || '-'}</strong>
  </div>
)

export default function WorkOrderPrintReport({
  number,
  description,
  workType,
  status,
  priority,
  siteValue,
  department,
  subDepartment,
  assignedDepartment,
  locationValue,
  assetValue,
  assetDescription,
  targetStart,
  targetFinish,
  actualStart,
  actualFinish,
  slaLabel,
  plannedTasks,
  plannedLabor,
  plannedResources,
  failureClass,
  problemCode,
  causeCode,
  remedyCode,
  technicianRemarks,
  completionNotes,
  actualLabor,
  actualHours
}) {
  return (
    <section className="wo-print-report">
      <h1>Work Order #{number}</h1>
      <p>{description || 'Work order'}</p>
      <h2>Work Order Information</h2>
      <div className="wo-print-grid">
        {[
          ['Work Type', workType],
          ['Status', status],
          ['Priority', priority],
          ['Site', siteValue],
          ['Department', department],
          ['Sub Department', subDepartment],
          ['Assigned Department', assignedDepartment],
          ['Location', locationValue],
          ['Asset', assetValue],
          ['Asset Description', assetDescription],
          ['Target Start', targetStart],
          ['Target Finish', targetFinish],
          ['Actual Start', actualStart],
          ['Actual Finish', actualFinish],
          ['SLA Met?', slaLabel]
        ].map(([label, value]) => <PrintCell key={label} label={label} value={value} />)}
      </div>

      <h2>Job Plan & Tasks</h2>
      <ul className="wo-print-list">
        {plannedTasks.map((task, index) => (
          <li key={index}><strong>{task.sequence || index + 1}. {task.description || 'Task instruction'}</strong><span> Duration: {task.duration || '-'} minutes</span></li>
        ))}
      </ul>

      <h2>Planned Labor / Materials / Tools</h2>
      <div className="wo-print-grid">
        {plannedLabor.map((row, index) => <PrintCell key={`labor-${index}`} label="Labor" value={`${row.craft || '-'} · ${row.hours || '-'} hours`} />)}
        {plannedResources.map((row, index) => <PrintCell key={`resource-${index}`} label={row.type} value={`${row.item || '-'} · Qty ${row.quantity || '-'}`} />)}
      </div>

      <h2>Failure & Actuals</h2>
      <div className="wo-print-grid">
        {[
          ['Failure Code', failureClass],
          ['Problem Code', problemCode],
          ['Cause Code', causeCode],
          ['Remedy Code', remedyCode],
          ['Technician Remarks', technicianRemarks],
          ['Completion Notes', completionNotes],
          ['Actual Labor', actualLabor],
          ['Actual Hours', actualHours]
        ].map(([label, value]) => <PrintCell key={label} label={label} value={value} />)}
      </div>
    </section>
  )
}

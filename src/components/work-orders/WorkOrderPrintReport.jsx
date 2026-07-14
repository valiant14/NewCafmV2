const PrintCell = ({ label, value }) => (
  <div className="wo-print-cell">
    <span>{label}</span>
    <strong>{value || '-'}</strong>
  </div>
)

const listNames = rows => rows?.length ? rows.map(file => file.name).join(', ') : ''

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
  jobPlan,
  estimatedDuration,
  pmNumber,
  pmCycle,
  plannedTasks = [],
  plannedLabor = [],
  plannedResources = [],
  ptwRequired,
  ptwFiles = [],
  generalFiles = [],
  meterReading,
  waterConsumption,
  energyConsumption,
  meterReadingDate,
  failureClass,
  problemCode,
  causeCode,
  remedyCode,
  technicianRemarks,
  completionNotes,
  actualLabor,
  actualHours,
  actualMaterials = [],
  actualTools = []
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

      <h2>PM / Job Plan</h2>
      <div className="wo-print-grid">
        {[
          ['PM Number', pmNumber],
          ['PM Cycle', pmCycle],
          ['Job Plan', jobPlan],
          ['Estimated Duration', estimatedDuration ? `${estimatedDuration} minutes` : '']
        ].map(([label, value]) => <PrintCell key={label} label={label} value={value} />)}
      </div>

      <h2>Job Tasks</h2>
      <ul className="wo-print-list">
        {plannedTasks.map((task, index) => (
          <li key={`${task.sequence}-${index}`}>
            <strong>{task.sequence || index + 1}. {task.description || 'Task instruction'}</strong>
            <span> Duration: {task.duration || '-'} minutes</span>
          </li>
        ))}
        {!plannedTasks.length && <li><strong>No job tasks configured</strong></li>}
      </ul>

      <h2>Planned Labor / Materials / Tools</h2>
      <div className="wo-print-grid">
        {plannedLabor.map((row, index) => <PrintCell key={`labor-${index}`} label="Labor" value={`${row.craft || '-'} · ${row.hours || '-'} hours`} />)}
        {plannedResources.map((row, index) => <PrintCell key={`resource-${index}`} label={row.type} value={`${row.item || '-'} · Qty ${row.quantity || '-'}`} />)}
        {!plannedLabor.length && !plannedResources.length && <PrintCell label="Plan" value="No planned resources configured" />}
      </div>

      <h2>PTW, Files & Meters</h2>
      <div className="wo-print-grid">
        <PrintCell label="PTW Required" value={ptwRequired ? 'Yes' : 'No'} />
        <PrintCell label="PTW Files" value={listNames(ptwFiles)} />
        <PrintCell label="Attachments" value={listNames(generalFiles)} />
        <PrintCell label="Meter Reading" value={meterReading} />
        <PrintCell label="Water Consumption" value={waterConsumption} />
        <PrintCell label="Energy Consumption" value={energyConsumption} />
        <PrintCell label="Reading Date" value={meterReadingDate} />
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
        {actualMaterials.map((row, index) => <PrintCell key={`actual-material-${index}`} label="Actual Material" value={`${row.item || '-'} · Qty ${row.actualQuantity || '-'}`} />)}
        {actualTools.map((row, index) => <PrintCell key={`actual-tool-${index}`} label="Actual Tool / Equipment" value={`${row.item || '-'} · Qty ${row.actualQuantity || '-'}`} />)}
      </div>
    </section>
  )
}

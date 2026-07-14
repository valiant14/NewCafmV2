const value = input => input || '-'
const listNames = rows => rows?.length ? rows.map(file => file.name).join(', ') : '-'

function FieldTable({ title, rows }) {
  return (
    <section className="wo-print-section">
      <h2>{title}</h2>
      <table className="wo-print-field-table">
        <tbody>
          {rows.map((row, rowIndex) => (
            <tr key={rowIndex}>
              {row.map(([label, content]) => (
                <td key={label}>
                  <span>{label}</span>
                  <strong>{value(content)}</strong>
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  )
}

function DataRows({ title, columns, rows, emptyText }) {
  return (
    <section className="wo-print-section">
      <h2>{title}</h2>
      <table className="wo-print-data-table">
        <thead>
          <tr>{columns.map(column => <th key={column.key}>{column.label}</th>)}</tr>
        </thead>
        <tbody>
          {rows.length ? rows.map((row, index) => (
            <tr key={row.key || index}>
              {columns.map(column => <td key={column.key}>{value(column.render ? column.render(row, index) : row[column.key])}</td>)}
            </tr>
          )) : (
            <tr><td colSpan={columns.length}>{emptyText}</td></tr>
          )}
        </tbody>
      </table>
    </section>
  )
}

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
    <article className="wo-print-report">
      <header className="wo-print-header">
        <div className="wo-print-brand">
          <div className="wo-print-logo">S</div>
          <div>
            <strong>SEDER CAFM</strong>
            <span>Maximo-style work order report</span>
          </div>
        </div>
        <div className="wo-print-title">
          <h1>Work Order</h1>
          <p>Corrective / Preventive Maintenance</p>
        </div>
        <div className="wo-print-number">
          <span>WORK ORDER</span>
          <strong>{value(number)}</strong>
          <i>{value(status)}</i>
        </div>
      </header>

      <div className="wo-print-summary">
        <div>
          <span>Description</span>
          <strong>{value(description)}</strong>
        </div>
        <div>
          <span>Work Type</span>
          <strong>{value(workType)}</strong>
        </div>
        <div>
          <span>Priority</span>
          <strong>{value(priority)}</strong>
        </div>
        <div>
          <span>SLA Met?</span>
          <strong>{value(slaLabel)}</strong>
        </div>
      </div>

      <FieldTable
        title="Work Order Information"
        rows={[
          [['Site', siteValue], ['Status', status], ['Work Type', workType], ['Priority', priority]],
          [['Department', department], ['Sub Department', subDepartment], ['Assigned Department', assignedDepartment], ['Location', locationValue]],
          [['Target Start', targetStart], ['Target Finish', targetFinish], ['Actual Start', actualStart], ['Actual Finish', actualFinish]]
        ]}
      />

      <FieldTable
        title="Asset and PM Context"
        rows={[
          [['Asset', assetValue], ['Asset Description', assetDescription], ['Location', locationValue], ['Site', siteValue]],
          [['PM Number', pmNumber], ['PM Cycle', pmCycle], ['Job Plan', jobPlan], ['Estimated Duration', estimatedDuration ? `${estimatedDuration} minutes` : '']]
        ]}
      />

      <DataRows
        title="Job Tasks"
        columns={[
          { key: 'sequence', label: 'Seq.' },
          { key: 'description', label: 'Task Description' },
          { key: 'duration', label: 'Duration (Min)' }
        ]}
        rows={plannedTasks.map((task, index) => ({ ...task, sequence: task.sequence || index + 1 }))}
        emptyText="No job tasks configured."
      />

      <DataRows
        title="Planned Labor"
        columns={[
          { key: 'craft', label: 'Craft / Labor' },
          { key: 'crew', label: 'Crew' },
          { key: 'hours', label: 'Estimated Hours' }
        ]}
        rows={plannedLabor}
        emptyText="No planned labor configured."
      />

      <DataRows
        title="Planned Materials, Tools and Equipment"
        columns={[
          { key: 'type', label: 'Type' },
          { key: 'item', label: 'Item / Description' },
          { key: 'quantity', label: 'Qty' },
          { key: 'availability', label: 'Availability' }
        ]}
        rows={plannedResources}
        emptyText="No planned materials, tools, or equipment configured."
      />

      <FieldTable
        title="Failure Classification"
        rows={[
          [['Failure Code', failureClass], ['Problem Code', problemCode], ['Cause Code', causeCode], ['Remedy Code', remedyCode]]
        ]}
      />

      <FieldTable
        title="PTW, Attachments and Meter Readings"
        rows={[
          [['PTW Required', ptwRequired ? 'Yes' : 'No'], ['PTW Files', listNames(ptwFiles)], ['Attachments', listNames(generalFiles)], ['Reading Date', meterReadingDate]],
          [['Meter Reading', meterReading], ['Water Consumption', waterConsumption], ['Energy Consumption', energyConsumption], ['SLA Met?', slaLabel]]
        ]}
      />

      <FieldTable
        title="Execution Notes and Actuals"
        rows={[
          [['Technician Remarks', technicianRemarks], ['Completion Notes', completionNotes]],
          [['Actual Labor', actualLabor], ['Actual Hours', actualHours], ['Actual Start', actualStart], ['Actual Finish', actualFinish]]
        ]}
      />

      <DataRows
        title="Actual Materials"
        columns={[
          { key: 'item', label: 'Item / Description' },
          { key: 'actualQuantity', label: 'Actual Qty' }
        ]}
        rows={actualMaterials}
        emptyText="No actual material consumption recorded."
      />

      <DataRows
        title="Actual Tools and Equipment"
        columns={[
          { key: 'item', label: 'Tool / Equipment' },
          { key: 'actualQuantity', label: 'Actual Qty' }
        ]}
        rows={actualTools}
        emptyText="No actual tool or equipment consumption recorded."
      />

      <section className="wo-print-signatures">
        <div><span>Prepared By</span><strong>________________________</strong></div>
        <div><span>Supervisor Approval</span><strong>________________________</strong></div>
        <div><span>Closed By</span><strong>________________________</strong></div>
      </section>

      <footer className="wo-print-footer">
        <span>Generated from Seder CAFM mock data</span>
        <span>Page 1</span>
      </footer>
    </article>
  )
}

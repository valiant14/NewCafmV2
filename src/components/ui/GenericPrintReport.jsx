import sederLogo from '../../Assets/seder-logo.png'

const value = input => input || '-'

function FieldTable({ title, rows = [] }) {
  return (
    <section className="wo-print-section">
      <h2>{title}</h2>
      <table className="wo-print-field-table">
        <tbody>
          {rows.map((row, index) => (
            <tr key={index}>
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

function DataTable({ title, columns = [], rows = [], emptyText = 'No records.' }) {
  return (
    <section className="wo-print-section wo-print-section-table">
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

export default function GenericPrintReport({
  reportTitle,
  reportSubtitle = 'Seder CAFM report',
  number,
  status,
  description,
  summary = [],
  sections = [],
  tables = [],
  signatures = ['Prepared By', 'Reviewed By', 'Approved By']
}) {
  return (
    <article className="wo-print-report generic-print-report">
      <header className="wo-print-header">
        <div className="wo-print-brand">
          <div className="wo-print-logo"><img src={sederLogo} alt="Seder" /></div>
          <div>
            <strong>SEDER CAFM</strong>
            <span>{reportSubtitle}</span>
          </div>
        </div>
        <div className="wo-print-title">
          <h1>{reportTitle}</h1>
          <p>Official printable record</p>
        </div>
        <div className="wo-print-number">
          <span>Record Number</span>
          <strong>{value(number)}</strong>
          {status && <i>{status}</i>}
        </div>
      </header>

      <div className="wo-print-summary">
        <div>
          <span>Description</span>
          <strong>{value(description)}</strong>
        </div>
        {summary.slice(0, 3).map(([label, content]) => (
          <div key={label}>
            <span>{label}</span>
            <strong>{value(content)}</strong>
          </div>
        ))}
      </div>

      {sections.map(section => (
        <FieldTable key={section.title} title={section.title} rows={section.rows} />
      ))}

      {tables.map(table => (
        <DataTable key={table.title} {...table} />
      ))}

      <section className="wo-print-signatures">
        {signatures.map(label => (
          <div key={label}><span>{label}</span><strong>________________________</strong></div>
        ))}
      </section>

      <footer className="wo-print-footer">
        <span>Generated from Seder CAFM mock data</span>
        <span>Seder CAFM</span>
      </footer>
    </article>
  )
}

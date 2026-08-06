// The work order's schedule, compressed into the tabs row - every date visible on one line no
// matter which tab is open. The two targets stay editable pickers (the workflow needs them set
// before approval); reported and actuals are system-recorded, so they render as plain text.
export default function WorkOrderDatesBar({
  readOnly = false,
  isPM = false,
  reportedDate,
  targetStart,
  setTargetStart,
  targetFinish,
  setTargetFinish,
  actualStart,
  actualFinish
}) {
  const shown = value => (value ? String(value).replace('T', ' ') : '—')
  const dates = [
    ['Reported', shown(reportedDate)],
    ['Target Start', targetStart, setTargetStart, readOnly || isPM, reportedDate],
    ['Target Finish', targetFinish, setTargetFinish, readOnly, targetStart || reportedDate],
    ['Actual Start', shown(actualStart)],
    ['Actual Finish', shown(actualFinish)]
  ]

  return (
    <div className="app-detail-tabs-meta">
      {dates.map(([label, value, set, locked, min]) => (
        <span key={label} className="app-detail-date">
          <span>{label}</span>
          {set && !locked
            ? <input type="datetime-local" value={value} min={min} onChange={event => set(event.target.value)} aria-label={label} />
            : <strong>{set ? shown(value) : value}</strong>}
        </span>
      ))}
    </div>
  )
}

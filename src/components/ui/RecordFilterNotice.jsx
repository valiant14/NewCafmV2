import Alert from './Alert'
import Button from './Button'

// Shown when a list page was opened pointing at a single record. Without it a filtered list
// looks like a list that lost its rows, so it says what is being shown and how to get back.
export default function RecordFilterNotice({ reference, count = 0, onClear, className = 'mb-3' }) {
  if (!reference) return null

  return (
    <Alert
      className={className}
      tone={count ? 'info' : 'warning'}
      title={`Showing ${reference}`}
      actions={<Button variant="outline" onClick={onClear}>Show all</Button>}
    >
      {count ? `${count} matching record${count === 1 ? '' : 's'}, opened from another page.` : 'No record here matches that reference - it may be outside your site or department scope.'}
    </Alert>
  )
}

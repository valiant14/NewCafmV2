import Badge from './Badge'
import { priorityCode, priorityLabel, priorityTone } from '../../lib/priority'

export default function PriorityBadge({ value, showCode = true, className }) {
  const code = priorityCode(value)
  const label = priorityLabel(value) || String(value ?? '').trim() || 'Not set'
  const display = showCode && code ? `${code} · ${label}` : label

  return <Badge className={className} tone={priorityTone(value)} title={`Priority: ${display}`}>{display}</Badge>
}

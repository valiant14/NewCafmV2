import Badge from './Badge'
import { statusCode, statusDescription, statusTone } from '../../lib/statusMatrix'

export default function StatusBadge({ value, application, showCode = true, className }) {
  const code = statusCode(application, value)
  const description = statusDescription(application, value)
  const label = showCode && code && description && code.toUpperCase() !== description.toUpperCase()
    ? `${code} · ${description}`
    : description || code || 'Not set'

  return <Badge className={className} tone={statusTone(code || value)} title={label}>{label}</Badge>
}

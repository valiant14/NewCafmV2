import Surface from './Surface'

export default function TablePanel({ children, className, tone }) {
  return <Surface flush tone={tone} className={className}>{children}</Surface>
}

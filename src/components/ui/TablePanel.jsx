import Surface from './Surface'

export default function TablePanel({ children, className }) {
  return <Surface flush className={className}>{children}</Surface>
}

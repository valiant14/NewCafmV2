import BaseField from './Field'
import BaseSection from './Section'

export function Field({ locked, ...props }) {
  if (locked) return null
  return <BaseField {...props} />
}

export function Section(props) {
  return <BaseSection {...props} />
}

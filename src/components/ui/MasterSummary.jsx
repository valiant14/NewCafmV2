export default function MasterSummary({ icon: Icon, label, value, detail }) {
  return (
    <section className="master-summary">
      {Icon && <Icon size={18} />}
      <span>{label}</span>
      <strong>{value}</strong>
      {detail && <i>{detail}</i>}
    </section>
  )
}

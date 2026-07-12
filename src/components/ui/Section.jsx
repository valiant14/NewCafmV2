export default function Section({ title, note, children }) {
  return <section className="wo-section"><header><div><h3>{title}</h3>{note&&<p>{note}</p>}</div></header>{children}</section>
}

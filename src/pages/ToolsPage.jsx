import { useState } from 'react'
import { Plus, Wrench } from 'lucide-react'
import toolSeed from '../data/tools.json'
import AddToolModal from '../components/tools/AddToolModal'
import ToolDetailPage from '../components/tools/ToolDetailPage'

const empty = {
  toolNumber: '',
  description: '',
  category: '',
  location: '',
  quantity: 1,
  status: 'Available',
  inspectionDue: ''
}

export default function ToolsPage() {
  const [rows, setRows] = useState(toolSeed)
  const [adding, setAdding] = useState(false)
  const [form, setForm] = useState(empty)
  const routeId = decodeURIComponent(window.location.pathname.split('/tools/')[1] || '')
  const [selected, setSelected] = useState(rows.find(row => row.toolNumber === routeId) || null)

  const open = row => {
    setSelected(row)
    window.history.pushState({}, '', `/tools/${row.toolNumber}`)
  }

  const close = () => {
    setSelected(null)
    window.history.pushState({}, '', '/tools')
  }

  const save = () => {
    if (!form.toolNumber || !form.description) return
    const row = { ...form, quantity: Number(form.quantity) }
    setRows(current => [...current, row])
    setAdding(false)
    setForm(empty)
    open(row)
  }

  if (selected) {
    return <ToolDetailPage tool={selected} onBack={close} />
  }

  return (
    <>
      <section className="page-heading">
        <div>
          <p className="eyebrow">RESOURCE MASTER DATA</p>
          <h1>Tools & Equipment</h1>
          <p>Maintain tools, equipment locations, quantities, status, and inspections.</p>
        </div>
        <button className="primary" onClick={() => setAdding(true)}><Plus size={17} />Add tool or equipment</button>
      </section>

      <section className="master-summary">
        <Wrench size={18} />
        <span>Tools and equipment</span>
        <strong>{rows.length}</strong>
        <i>Available {rows.filter(row => row.status === 'Available').length}</i>
      </section>

      <section className="panel register">
        <div className="table-shell">
          <table>
            <thead>
              <tr>
                <th>Tool number</th>
                <th>Description</th>
                <th>Category</th>
                <th>Location</th>
                <th>Quantity</th>
                <th>Status</th>
                <th>Inspection due</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(row => (
                <tr className="click-row" key={row.toolNumber} onClick={() => open(row)}>
                  <td><strong className="mono">{row.toolNumber}</strong></td>
                  <td>{row.description}</td>
                  <td>{row.category}</td>
                  <td>{row.location}</td>
                  <td>{row.quantity}</td>
                  <td><span className={`badge ${row.status === 'Available' ? 'green' : 'orange'}`}><i />{row.status}</span></td>
                  <td>{row.inspectionDue}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {adding && <AddToolModal form={form} setForm={setForm} onClose={() => setAdding(false)} onSave={save} />}
    </>
  )
}

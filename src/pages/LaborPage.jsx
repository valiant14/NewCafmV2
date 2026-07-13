import { useState } from 'react'
import { Plus, Users } from 'lucide-react'
import laborSeed from '../data/labor.json'
import AddLaborModal from '../components/labor/AddLaborModal'
import LaborDetailPage from '../components/labor/LaborDetailPage'

const empty = {
  personId: '',
  name: '',
  craftCode: '',
  craft: '',
  department: '',
  subDepartment: '',
  shift: 'Day',
  availability: 'Available'
}

export default function LaborPage() {
  const [rows, setRows] = useState(laborSeed)
  const [adding, setAdding] = useState(false)
  const [form, setForm] = useState(empty)
  const routeId = decodeURIComponent(window.location.pathname.split('/labor/')[1] || '')
  const [selected, setSelected] = useState(rows.find(row => row.personId === routeId) || null)

  const open = row => {
    setSelected(row)
    window.history.pushState({}, '', `/labor/${row.personId}`)
  }

  const close = () => {
    setSelected(null)
    window.history.pushState({}, '', '/labor')
  }

  const save = () => {
    if (!form.personId || !form.name || !form.craftCode) return
    setRows(current => [...current, form])
    setAdding(false)
    setForm(empty)
    open(form)
  }

  if (selected) {
    return <LaborDetailPage labor={selected} onBack={close} />
  }

  return (
    <>
      <section className="page-heading">
        <div>
          <p className="eyebrow">RESOURCE MASTER DATA</p>
          <h1>Labor</h1>
          <p>Maintain technicians, craft codes, departments, shifts, and availability.</p>
        </div>
        <button className="primary" onClick={() => setAdding(true)}><Plus size={17} />Add labor</button>
      </section>

      <section className="master-summary">
        <Users size={18} />
        <span>Labor resources</span>
        <strong>{rows.length}</strong>
        <i>Available {rows.filter(row => row.availability === 'Available').length}</i>
      </section>

      <section className="panel register">
        <div className="table-shell">
          <table>
            <thead>
              <tr>
                <th>Person ID</th>
                <th>Name</th>
                <th>Craft code</th>
                <th>Craft</th>
                <th>Department</th>
                <th>Sub Department</th>
                <th>Shift</th>
                <th>Availability</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(row => (
                <tr className="click-row" key={row.personId} onClick={() => open(row)}>
                  <td><strong className="mono">{row.personId}</strong></td>
                  <td>{row.name}</td>
                  <td>{row.craftCode}</td>
                  <td>{row.craft}</td>
                  <td>{row.department}</td>
                  <td>{row.subDepartment}</td>
                  <td>{row.shift}</td>
                  <td><span className={`badge ${row.availability === 'Available' ? 'green' : 'orange'}`}><i />{row.availability}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {adding && <AddLaborModal form={form} setForm={setForm} onClose={() => setAdding(false)} onSave={save} />}
    </>
  )
}

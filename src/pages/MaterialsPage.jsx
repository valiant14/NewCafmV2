import { useState } from 'react'
import { FileSpreadsheet, PackageCheck, Plus, X } from 'lucide-react'
import materialSeed from '../data/materials.json'
import AddMaterialModal from '../components/materials/AddMaterialModal'
import MaterialDetailPage from '../components/materials/MaterialDetailPage'

const empty = {
  itemNumber: '',
  description: '',
  category: '',
  unit: 'EA',
  storeroom: 'DIWAN-MAIN',
  balance: 0,
  reserved: 0,
  reorderLevel: 0,
  availability: 'Available'
}

export default function MaterialsPage() {
  const [rows, setRows] = useState(materialSeed)
  const [adding, setAdding] = useState(false)
  const [form, setForm] = useState(empty)
  const [imported, setImported] = useState('')
  const routeId = decodeURIComponent(window.location.pathname.split('/materials/')[1] || '')
  const [selected, setSelected] = useState(rows.find(row => row.itemNumber === routeId) || null)

  const open = row => {
    setSelected(row)
    window.history.pushState({}, '', `/materials/${row.itemNumber}`)
  }

  const close = () => {
    setSelected(null)
    window.history.pushState({}, '', '/materials')
  }

  const save = () => {
    if (!form.itemNumber || !form.description) return
    const row = {
      ...form,
      balance: Number(form.balance),
      reserved: Number(form.reserved),
      reorderLevel: Number(form.reorderLevel)
    }
    setRows(current => [...current, row])
    setAdding(false)
    setForm(empty)
    open(row)
  }

  if (selected) {
    return <MaterialDetailPage material={selected} onBack={close} />
  }

  return (
    <>
      <section className="page-heading">
        <div>
          <p className="eyebrow">INVENTORY MASTER DATA</p>
          <h1>Materials</h1>
          <p>Maintain spare parts, consumables, balances, reservations, and reorder levels.</p>
        </div>
        <div className="heading-actions">
          <label className="outline inventory-import">
            <FileSpreadsheet size={16} />
            {imported || 'Import Excel'}
            <input type="file" accept=".xlsx,.xls,.csv" onChange={event => setImported(event.target.files?.[0]?.name || '')} />
          </label>
          <button className="primary" onClick={() => setAdding(true)}><Plus size={17} />Add material</button>
        </div>
      </section>

      {imported && (
        <div className="inventory-import-note">
          <PackageCheck size={16} />
          <span><strong>{imported}</strong> ready for inventory validation and stock update.</span>
          <button onClick={() => setImported('')}><X size={14} /></button>
        </div>
      )}

      <section className="master-summary">
        <PackageCheck size={18} />
        <span>Inventory items</span>
        <strong>{rows.length}</strong>
        <i>Purchase required {rows.filter(row => row.availability === 'Purchase Required').length}</i>
      </section>

      <section className="panel register">
        <div className="table-shell">
          <table>
            <thead>
              <tr>
                <th>Item number</th>
                <th>Description</th>
                <th>Category</th>
                <th>Unit</th>
                <th>Storeroom</th>
                <th>Balance</th>
                <th>Reserved</th>
                <th>Reorder level</th>
                <th>Availability</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(row => (
                <tr className="click-row" key={row.itemNumber} onClick={() => open(row)}>
                  <td><strong className="mono">{row.itemNumber}</strong></td>
                  <td>{row.description}</td>
                  <td>{row.category}</td>
                  <td>{row.unit}</td>
                  <td>{row.storeroom}</td>
                  <td>{row.balance}</td>
                  <td>{row.reserved}</td>
                  <td>{row.reorderLevel}</td>
                  <td><span className={`badge ${row.availability === 'Available' ? 'green' : 'orange'}`}><i />{row.availability}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {adding && <AddMaterialModal form={form} setForm={setForm} onClose={() => setAdding(false)} onSave={save} />}
    </>
  )
}

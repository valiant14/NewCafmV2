import { Boxes, ListChecks, Lock, Plus, Users, X } from 'lucide-react'
import Section from '../ui/Section'

const workspaceClass = 'grid gap-3'
const addButtonClass = 'mb-2 inline-flex items-center gap-2 rounded-lg bg-[var(--app-badge-green-bg)] px-2.5 py-1.5 text-xs font-bold text-[var(--app-badge-green-text)] transition hover:brightness-95 disabled:cursor-not-allowed disabled:opacity-40'
const secondaryAddButtonClass = 'mb-2 inline-flex items-center gap-2 rounded-lg bg-[var(--app-badge-blue-bg)] px-2.5 py-1.5 text-xs font-bold text-[var(--app-badge-blue-text)] transition hover:brightness-95 disabled:cursor-not-allowed disabled:opacity-40'
const actionRowClass = 'flex flex-wrap gap-2'
const tableClass = 'overflow-hidden rounded-2xl border border-[var(--app-line)] bg-[var(--app-table-bg)]'
const headBaseClass = 'gap-2 bg-[var(--app-table-header-bg)] px-3 py-2 text-[length:var(--app-table-header-font-size)] font-extrabold uppercase tracking-[.08em] text-[var(--app-table-heading)]'
const laborHeadClass = `grid grid-cols-[1fr_120px_1fr] ${headBaseClass}`
const editableLaborHeadClass = `grid grid-cols-[1fr_120px_1fr_40px] ${headBaseClass}`
const resourceHeadClass = `grid grid-cols-[120px_1fr_110px_40px] ${headBaseClass}`
const taskHeadClass = `grid grid-cols-[90px_1fr_120px_40px] ${headBaseClass}`
const rowBaseClass = 'items-center gap-2 border-t border-[var(--app-line)] px-3 py-2 text-[length:var(--app-table-font-size)] text-[var(--app-table-text)] hover:bg-[var(--app-table-hover-bg)] [&_input]:h-9 [&_input]:rounded-lg [&_input]:border [&_input]:border-[var(--app-line)] [&_input]:bg-[var(--app-table-bg)] [&_input]:px-2.5 [&_input]:text-[length:var(--app-table-font-size)] [&_input]:text-[var(--app-table-text)] [&_select]:h-9 [&_select]:rounded-lg [&_select]:border [&_select]:border-[var(--app-line)] [&_select]:bg-[var(--app-table-bg)] [&_select]:px-2.5 [&_select]:text-[length:var(--app-table-font-size)] [&_select]:text-[var(--app-table-text)] [&_button]:rounded-lg [&_button]:p-2 [&_button]:text-[var(--app-muted)] [&_button:hover]:bg-[var(--app-table-hover-bg)]'
const laborRowClass = `grid grid-cols-[1fr_120px_1fr] ${rowBaseClass}`
const editableLaborRowClass = `grid grid-cols-[1fr_120px_1fr_40px] ${rowBaseClass}`
const resourceRowClass = `grid grid-cols-[120px_1fr_110px_40px] ${rowBaseClass}`
const taskRowClass = `grid grid-cols-[90px_1fr_120px_40px] ${rowBaseClass}`
const emptyClass = 'border-t border-[var(--app-line)] px-3 py-6 text-center text-sm text-[var(--app-muted)]'
const hasTransaction = row => Boolean(row.transactionRef || row.purchaseRequest || row.purchaseOrder || row.reservation)

export default function WorkOrderPlanTab({
  readOnly = false,
  isPM,
  tasksLocked = isPM,
  jobPlanNumber,
  plannedLabor,
  setPlannedLabor,
  plannedResources,
  setPlannedResources,
  plannedTasks,
  setPlannedTasks,
  plannedCraftOptions,
  plannedCrewOptions,
  materialMaster,
  toolMaster,
  updatePlanRow,
  updatePlannedResource,
  updatePlannedResourceField
}) {
  return (
    <div className={workspaceClass}>
      <Section compact tone="purple" icon={Users} title="Planned Labor" note={isPM ? 'Generated from the linked job plan' : 'Add the crafts, crews, and estimated hours required'}>
        {!isPM && (
          <button className={addButtonClass} disabled={readOnly} onClick={() => setPlannedLabor(rows => [...rows, { craft: '', hours: '', crew: '' }])}>
            <Plus size={15} />Add labor
          </button>
        )}
        <datalist id="planned-craft-options">{plannedCraftOptions.map(item => <option value={item.value} key={item.value}>{item.label}</option>)}</datalist>
        <datalist id="planned-crew-options">{plannedCrewOptions.map(item => <option value={item.value} key={item.value}>{item.label}</option>)}</datalist>
        <div className={tableClass}>
          <div className={isPM ? laborHeadClass : editableLaborHeadClass}>
            <span>Labor craft</span>
            <span>Estimated hours</span>
            <span>Assigned crew</span>
            {!isPM && <span />}
          </div>
          {plannedLabor.map((row, index) => (
            <div className={isPM ? laborRowClass : editableLaborRowClass} key={index}>
              <input value={row.craft} list="planned-craft-options" readOnly={readOnly || isPM} onChange={event => updatePlanRow(setPlannedLabor, index, 'craft', event.target.value)} placeholder="Search craft code or description" />
              <input value={row.hours} readOnly={readOnly || isPM} type="number" onChange={event => updatePlanRow(setPlannedLabor, index, 'hours', event.target.value)} placeholder="Hours" />
              <input value={row.crew} list="planned-crew-options" readOnly={readOnly || isPM} onChange={event => updatePlanRow(setPlannedLabor, index, 'crew', event.target.value)} placeholder="Search technician or crew" />
              {!isPM && <button disabled={readOnly} onClick={() => setPlannedLabor(rows => rows.filter((_, itemIndex) => itemIndex !== index))}><X size={14} /></button>}
            </div>
          ))}
        </div>
      </Section>

      <Section compact tone="green" icon={Boxes} title="Planned Materials & Tools" note="Left empty by default. Data entry users add materials, tools, or equipment manually when needed; availability is managed in Materials.">
        <div className={actionRowClass}>
          <button className={addButtonClass} disabled={readOnly} onClick={() => setPlannedResources(rows => [...rows, { type: 'Material', item: '', quantity: '', availability: 'Available' }])}><Plus size={15} />Add material</button>
          <button className={secondaryAddButtonClass} disabled={readOnly} onClick={() => setPlannedResources(rows => [...rows, { type: 'Tool', item: '', quantity: '', availability: 'Available' }])}><Plus size={15} />Add tool</button>
        </div>
        <datalist id="planned-material-options">{materialMaster.map(item => <option value={item.description} key={item.itemNumber}>{item.itemNumber} · {item.category}</option>)}</datalist>
        <datalist id="planned-tool-options">{toolMaster.map(item => <option value={item.description} key={item.toolNumber}>{item.toolNumber} · {item.category}</option>)}</datalist>
        <div className={tableClass}>
          <div className={resourceHeadClass}><span>Type</span><span>Item / description</span><span>Quantity</span><span /></div>
          {plannedResources.length ? plannedResources.map((row, index) => {
            const locked = readOnly || hasTransaction(row)
            return (
            <div className={resourceRowClass} key={index}>
              <select value={row.type} disabled={locked} title={locked ? 'Submitted resource lines cannot be changed. Add a new row for extra quantity.' : undefined} onChange={event => updatePlannedResourceField(index, 'type', event.target.value)}>
                <option>Material</option><option>Tool</option><option>Equipment</option>
              </select>
              <input value={row.item} readOnly={locked} title={locked ? 'Submitted resource lines cannot be changed. Add a new row for extra quantity.' : undefined} list={row.type === 'Material' ? 'planned-material-options' : 'planned-tool-options'} onChange={event => updatePlannedResource(index, event.target.value)} placeholder={`Search ${row.type.toLowerCase()} number or description`} />
              <input value={row.quantity} readOnly={locked} title={locked ? 'Submitted resource lines cannot be changed. Add a new row for extra quantity.' : undefined} type="number" min="1" step="1" onChange={event => updatePlannedResourceField(index, 'quantity', event.target.value)} placeholder="Enter count" />
              {locked ? <span className="grid h-9 w-9 place-items-center text-[var(--app-muted)]" title="Submitted resource lines cannot be changed. Add a new row for extra quantity."><Lock size={14} /></span> : <button onClick={() => setPlannedResources(rows => rows.filter((_, itemIndex) => itemIndex !== index))}><X size={14} /></button>}
            </div>
          )}) : <div className={emptyClass}>No planned materials or tools yet.</div>}
        </div>
      </Section>

      <Section compact icon={ListChecks} title="Job Tasks" note={tasksLocked ? `Generated from job plan ${jobPlanNumber}` : 'Configure sequence, instructions, and expected duration'}>
        {!tasksLocked && <button className={addButtonClass} disabled={readOnly} onClick={() => setPlannedTasks(rows => [...rows, { sequence: (rows.length + 1) * 10, description: '', duration: '' }])}><Plus size={15} />Add task</button>}
        <div className={tableClass}>
          <div className={taskHeadClass}><span>Sequence</span><span>Task instruction</span><span>Duration (min)</span><span /></div>
          {plannedTasks.map((row, index) => (
            <div className={taskRowClass} key={index}>
              <input type="number" value={row.sequence} readOnly={readOnly || tasksLocked} onChange={event => updatePlanRow(setPlannedTasks, index, 'sequence', event.target.value)} />
              <input value={row.description} readOnly={readOnly || tasksLocked} onChange={event => updatePlanRow(setPlannedTasks, index, 'description', event.target.value)} placeholder="Describe the task to complete" />
              <input type="number" value={row.duration} readOnly={readOnly || tasksLocked} onChange={event => updatePlanRow(setPlannedTasks, index, 'duration', event.target.value)} placeholder="Minutes" />
              {!tasksLocked && <button disabled={readOnly} onClick={() => setPlannedTasks(rows => rows.filter((_, itemIndex) => itemIndex !== index))}><X size={14} /></button>}
            </div>
          ))}
          {!plannedTasks.length && (
            <div className={emptyClass}>
              {jobPlanNumber ? `Job plan ${jobPlanNumber} has no task lines. Add the tasks manually below.` : 'No job plan linked. Add the tasks required to complete this work order.'}
            </div>
          )}
        </div>
      </Section>
    </div>
  )
}

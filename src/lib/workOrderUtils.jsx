import { statusDescription, statusOptions } from './statusMatrix'

export const workOrderTabs = ['Overview', 'Plan', 'Failure', 'Material Requests', 'PTW & Files', 'Meters', 'Actual']
export const workOrderBodyClass = 'grid gap-3 p-0'
export const maximoWorkOrderStatusDescriptions = new Proxy({}, { get: (_, status) => statusDescription('workOrder', status) })

export const cleanText = value => String(value ?? '').trim()

export const toLocationPriority = value => {
  const text = String(value || '').trim()
  if (text.startsWith('1') || text === 'Emergency') return 1
  if (text.startsWith('2') || text === 'High') return 2
  return 3
}

export const normalizeWoStatus = value => {
  const status = cleanText(value).toUpperCase()
  return statusOptions('workOrder').includes(status) ? status : 'WAPPR'
}

export const getWorkOrderJobPlan = order => cleanText(order['JOB PLAN'] || order.JPNUM || order.JPNUMBER || order['JOP PLAN '] || order['JOP PLAN'] || order.jobPlan)

export const taskToPlanRow = (task, index = 0) => ({
  sequence: task.sequence ?? task['JOB TASK SEQUENCE'] ?? task.SEQUENCE ?? index + 1,
  description: task.description ?? task['JOB TASK DESCRIPTION'] ?? task.DESCRIPTION ?? '',
  duration: task.duration ?? Math.max(5, Math.round(Number(task['TASK DURATION IN HOUR'] || 0) * 1440))
})

export const assetFromMaster = (assetNumber, masterAssets = []) => masterAssets.find(asset => cleanText(asset.assetnum) === cleanText(assetNumber))

export const assetDescriptionFromMaster = (assetNumber, masterAssets = []) => assetFromMaster(assetNumber, masterAssets)?.description?.trim() || ''

export function WorkOrderWorkflowNotice({ status, missing = [], nextStep }) {
  const clear = missing.length === 0
  return (
    <section className={`rounded-2xl border px-4 py-3 ${clear ? 'border-[var(--app-line)] bg-[var(--app-badge-green-bg)] text-[var(--app-badge-green-text)]' : 'border-[var(--app-badge-orange-text)]/20 bg-[var(--app-badge-orange-bg)] text-[var(--app-badge-orange-text)]'}`}>
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0">
          <p className="text-[9px] font-extrabold uppercase tracking-[.16em] opacity-80">Workflow guidance</p>
          <h3 className="mt-1 text-sm font-extrabold">{clear ? 'Ready for the next workflow action' : 'Update needed before the next workflow action'}</h3>
          <div className="mt-2 flex flex-wrap gap-2">
            {clear ? (
              <span className="rounded-full bg-white/60 px-2.5 py-1 text-[10px] font-bold">No blocking fields</span>
            ) : missing.map(item => (
              <span className="rounded-full bg-white/70 px-2.5 py-1 text-[10px] font-bold" key={item}>{item}</span>
            ))}
          </div>
        </div>
        <div className="rounded-xl bg-white/70 px-3 py-2 text-xs">
          <span className="block text-[9px] font-extrabold uppercase tracking-[.14em] opacity-70">Current status</span>
          <strong>{status}</strong>
          <span className="mx-2 opacity-50">·</span>
          <span>{nextStep}</span>
        </div>
      </div>
    </section>
  )
}

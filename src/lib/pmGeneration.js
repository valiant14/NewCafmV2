import { parseLocal, toLocalDateInput } from './datetime'

// Shared by the PM Schedule page and the PM Schedule Rules page so both raise work orders
// the same way. Duplicate generation is prevented by PM number plus NEXTDATE cycle.
export const cycleKey = plan => `${plan.pmNumber}-${plan.startDate}`

export const addFrequency = plan => {
  const date = parseLocal(plan.startDate) || new Date()
  const amount = Number(plan.frequency) || 1
  if (plan.freqUnit === 'DAYS') date.setDate(date.getDate() + amount)
  if (plan.freqUnit === 'WEEKS') date.setDate(date.getDate() + amount * 7)
  if (plan.freqUnit === 'MONTHS') date.setMonth(date.getMonth() + amount)
  if (plan.freqUnit === 'YEARS') date.setFullYear(date.getFullYear() + amount)
  return toLocalDateInput(date)
}

export const generationCutoff = () => new Date('2026-08-31')

export const generatePmWorkOrders = ({ plans = [], jobTasks = [], setRows, onGenerate }) => {
  const cutoff = generationCutoff()
  const due = plans.filter(plan => plan.pmStatus === 'ACTIVE' && new Date(plan.startDate) <= cutoff && plan.lastGeneratedCycle !== cycleKey(plan))
  const made = due.map((plan, index) => ({ ...plan, workOrder: `PMWO-${20260801 + index}`, cycle: cycleKey(plan), nextDue: addFrequency(plan) }))
  setRows?.(rows => rows.map(plan => {
    const generated = made.find(item => item.pmNumber === plan.pmNumber)
    return generated ? { ...plan, startDate: generated.nextDue, lastGeneratedCycle: generated.cycle, pmCounter: Number(plan.pmCounter) + 1 } : plan
  }))
  made.forEach(plan => onGenerate?.(plan, jobTasks.filter(task => task.JPNUM === plan.jobPlan)))
  return made
}

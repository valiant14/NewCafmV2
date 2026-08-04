import { parseLocal } from './datetime'
import { scheduleForPlan } from './pmGeneration'

export const PM_DUE_STATES = {
  OVERDUE: 'Overdue',
  DUE_SOON: 'Due Soon',
  SCHEDULED: 'Scheduled',
  NOT_SCHEDULED: 'Not Scheduled'
}

const dayMs = 86400000

const startOfDay = date => new Date(date.getFullYear(), date.getMonth(), date.getDate())

// A plan becomes "due soon" once today falls inside its own lead time - the Maximo
// meaning of the field. Note a plan with leadTime 0 has no warning window at all and
// goes straight from Scheduled to Overdue; that is faithful to the data, not a bug here.
export const pmDueState = (plan, now = new Date(), rules = []) => {
  if (String(plan?.pmStatus || '').toUpperCase() !== 'ACTIVE') return 'NOT_SCHEDULED'
  // parseLocal, not new Date: a date-only string parses as UTC midnight and the
  // comparison shifts by a day near boundaries.
  const next = parseLocal(plan?.startDate)
  if (!next) return 'NOT_SCHEDULED'

  const today = startOfDay(now)
  const due = startOfDay(next)
  if (due < today) return 'OVERDUE'

  const leadDays = Math.max(0, Number(scheduleForPlan(plan, rules).leadTime) || 0)
  return (due - today) / dayMs <= leadDays ? 'DUE_SOON' : 'SCHEDULED'
}

export const pmDueLabel = (plan, rules = []) => PM_DUE_STATES[pmDueState(plan, new Date(), rules)] || PM_DUE_STATES.NOT_SCHEDULED

export const pmDueTone = (plan, rules = []) => {
  const state = pmDueState(plan, new Date(), rules)
  if (state === 'OVERDUE') return 'orange'
  if (state === 'DUE_SOON') return 'purple'
  if (state === 'SCHEDULED') return 'blue'
  return 'neutral'
}

export const countPmDueState = (plans = [], state, rules = []) => plans.filter(plan => pmDueState(plan, new Date(), rules) === state).length

// Shared schedule resolution for PM list and detail views. Work-order generation is
// deliberately backend-only so duplicate prevention and timing remain transactional.

const frequencyAliases = {
  MINUTE: 'MINUTES', MINUTELY: 'MINUTES',
  HOUR: 'HOURS', HOURLY: 'HOURS',
  DAY: 'DAYS', DAILY: 'DAYS',
  WEEK: 'WEEKS', WEEKLY: 'WEEKS',
  MONTH: 'MONTHS', MONTHLY: 'MONTHS',
  QUARTER: 'QUARTERS', QUARTERLY: 'QUARTERS',
  YEAR: 'YEARS', YEARLY: 'YEARS', ANNUALLY: 'YEARS'
}

export const normalizePmFrequencyUnit = value => {
  const unit = String(value || 'MONTHS').trim().toUpperCase()
  return frequencyAliases[unit] || unit
}

const pmWorkOrderStatusLabels = Object.freeze({
  WSCH: 'Waiting',
  SCHED: 'Assigned',
  INPRG: 'In Progress',
  COMP: 'Completed',
  CLOSE: 'Closed',
  ON_HOLD_MATERIAL: 'Waiting for Material',
  ON_HOLD_PERMIT: 'Waiting for Permit',
  CAN: 'Cancelled'
})

export const pmWorkOrderStatusLabel = (value, fallback = '') => (
  pmWorkOrderStatusLabels[String(value || '').trim().toUpperCase()] || fallback || String(value || '').trim()
)

export const activeRuleForPlan = (plan, rules = []) => {
  const activeRules = rules.filter(rule => String(rule.status || '').toLowerCase() === 'active')
  if (!activeRules.length) return null
  if (plan.scheduleRule) {
    return activeRules.find(rule => rule.name === plan.scheduleRule) || null
  }
  return null
}

export const scheduleForPlan = (plan, rules = []) => {
  const rule = activeRuleForPlan(plan, rules)
  return {
    rule,
    frequency: Number(rule?.frequency || plan.frequency) || 1,
    freqUnit: normalizePmFrequencyUnit(rule?.freqUnit || plan.freqUnit || 'MONTHS'),
    leadTime: Number(rule?.leadTimeDays ?? plan.leadTime) || 0,
    horizonDays: Number(rule?.horizonDays ?? plan.leadTime ?? 30) || 0,
    triggerHour: Math.max(0, Math.min(23, Number(rule?.triggerHour) || 0)),
    woPrefix: rule?.woPrefix || 'PMWO-',
    woStatus: rule?.defaultWoStatus || plan.woStatus || ''
  }
}

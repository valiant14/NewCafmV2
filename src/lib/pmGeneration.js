import { parseLocal, toLocalDateTimeInput } from './datetime'

// Shared by the PM Schedule page and the PM Schedule Rules page so both raise work orders
// the same way. Duplicate generation is prevented by PM number plus NEXTDATE cycle.
export const cycleKey = plan => `${plan.pmNumber}-${plan.startDate}`

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
    freqUnit: rule?.freqUnit || plan.freqUnit || 'MONTHS',
    leadTime: Number(rule?.leadTimeDays ?? plan.leadTime) || 0,
    horizonDays: Number(rule?.horizonDays ?? plan.leadTime ?? 30) || 0,
    triggerHour: Math.max(0, Math.min(23, Number(rule?.triggerHour) || 0)),
    woPrefix: rule?.woPrefix || 'PMWO-',
    woStatus: rule?.defaultWoStatus || plan.woStatus || 'WSCH'
  }
}

export const addFrequency = (plan, rules = []) => {
  const date = parseLocal(plan.startDate) || new Date()
  const schedule = scheduleForPlan(plan, rules)
  const amount = schedule.frequency
  if (schedule.freqUnit === 'MINUTES') date.setMinutes(date.getMinutes() + amount)
  if (schedule.freqUnit === 'HOURS') date.setHours(date.getHours() + amount)
  if (schedule.freqUnit === 'DAYS') date.setDate(date.getDate() + amount)
  if (schedule.freqUnit === 'WEEKS') date.setDate(date.getDate() + amount * 7)
  if (schedule.freqUnit === 'MONTHS') date.setMonth(date.getMonth() + amount)
  if (schedule.freqUnit === 'YEARS') date.setFullYear(date.getFullYear() + amount)
  return toLocalDateTimeInput(date)
}

export const generationCutoff = (plan, rules = [], now = new Date()) => {
  const date = new Date(now)
  date.setDate(date.getDate() + scheduleForPlan(plan, rules).horizonDays)
  return date
}

const generationAllowedNow = (plan, rules, now) => {
  const schedule = scheduleForPlan(plan, rules)
  if (['MINUTES', 'HOURS'].includes(schedule.freqUnit)) return true
  return now.getHours() >= schedule.triggerHour
}

export const generatePmWorkOrders = ({ plans = [], rules = [], jobTasks = [], setRows, onGenerate, now = new Date() }) => {
  const due = plans.filter(plan => {
    const next = parseLocal(plan.startDate)
    return Boolean(next) &&
      plan.pmStatus === 'ACTIVE' &&
      next <= generationCutoff(plan, rules, now) &&
      generationAllowedNow(plan, rules, now) &&
      plan.lastGeneratedCycle !== cycleKey(plan)
  })
  const made = due.map((plan, index) => {
    const schedule = scheduleForPlan(plan, rules)
    return {
      ...plan,
      frequency: schedule.frequency,
      freqUnit: schedule.freqUnit,
      leadTime: schedule.leadTime,
      woStatus: schedule.woStatus,
      workOrder: `${schedule.woPrefix}${new Date().getFullYear()}-${String(Date.now() + index).slice(-6)}`,
      cycle: cycleKey(plan),
      nextDue: addFrequency(plan, rules)
    }
  })
  setRows?.(rows => rows.map(plan => {
    const generated = made.find(item => item.pmNumber === plan.pmNumber)
    return generated ? { ...plan, startDate: generated.nextDue, lastGeneratedCycle: generated.cycle, pmCounter: Number(plan.pmCounter) + 1 } : plan
  }))
  made.forEach(plan => onGenerate?.(plan, jobTasks.filter(task => task.JPNUM === plan.jobPlan)))
  return made
}

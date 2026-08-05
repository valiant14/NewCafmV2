// Shared schedule resolution for PM list and detail views. Work-order generation is
// deliberately backend-only so duplicate prevention and timing remain transactional.

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
    woStatus: rule?.defaultWoStatus || plan.woStatus || ''
  }
}

// Demonstration work orders for the material-hold / SLA-pause behaviour.
//
// Dates are computed relative to load time rather than hardcoded: a fixture with fixed
// dates stops demonstrating "overdue" the moment it ages, and these exist precisely to
// show the difference between a paused clock and a running one.
//
// The workbook's Work Order Tracking sheet is header-only, so without these the app opens
// with an empty list and none of this behaviour is visible.

const DAY = 24 * 60 * 60 * 1000
const at = days => new Date(Date.now() + days * DAY)
// The app's own date fields are local `YYYY-MM-DDTHH:mm` strings (toDateTimeInput), so
// seeds use the same shape and every existing consumer reads them unchanged.
const local = days => {
  const date = at(days)
  return new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 16)
}
const iso = days => at(days).toISOString()

// Every seed is a Mechanics job, matching the department on its asset's master record.
const base = {
  'WORK TYPE ': 'CM',
  'LOCATION PRIORTY': 2,
  PRIORTY: 2,
  'DEPARTMENT ': 'Mechanics',
  'SUB DEPARTMENT  NAME': 'HVAC',
  'ASSIGNED DEPARTMENT': 'Mechanics',
  SYSTEM: 'Split & Window Unit System',
  'PTW REQUIRED': false
}

const workOrderSeeds = [
  {
    // The case the consultant raised: waiting on a fan belt that is On PR. Its target
    // finish passed 3 days ago, but it has been held 6 days - so the effective deadline is
    // still ahead and it must NOT count as breached.
    ...base,
    WORKORDER: '56540101',
    'DESCRIPITION ': 'AHU-2 fan belt replacement — awaiting spare',
    STATUS: 'ON_HOLD_MATERIAL',
    'STATUS DESCRIPITION': 'On Hold – Material',
    'HELD FROM': 'INPRG',
    holdPeriods: [{ startedAt: iso(-6), endedAt: null, reason: 'MATERIAL' }],
    ASSET: 'ALS-HV-00001',
    'ASSET DESCRIPTION': 'SPLIT A/C UNIT',
    'LOCATION ': 'RC-1031-RD-001-00-055',
    'DEPARTMENT ': 'Mechanics',
    SITE: '1031',
    'REPORTED DATE ': local(-9),
    'TARGET START ': local(-8),
    'TARGET FINISH ': local(-3),
    'PLANNED LABOR': [{ craft: 'HVAC Technician', hours: '3', crew: 'Omar Al Harbi' }],
    'PLANNED RESOURCES': [
      { type: 'Material', item: 'Fan belt A-42', quantity: 2 },
      { type: 'Material', item: 'Air filter 500 × 500 mm', quantity: 4 },
      { type: 'Tool', item: 'Digital multimeter', quantity: 1 }
    ]
  },
  {
    // Healthy contrast: running, comfortably inside its target.
    ...base,
    WORKORDER: '56540102',
    'DESCRIPITION ': 'Quarterly filter clean — window units, east wing',
    STATUS: 'INPRG',
    'STATUS DESCRIPITION': 'In Progress',
    ASSET: 'WWU-100-0001',
    'ASSET DESCRIPTION': 'WINDOW UNIT',
    'LOCATION ': 'RC-1031-RD-001-00-055',
    SITE: '1031',
    'REPORTED DATE ': local(-2),
    'TARGET START ': local(-1),
    'TARGET FINISH ': local(5),
    'PLANNED LABOR': [{ craft: 'HVAC Technician', hours: '2', crew: 'Fahad Al Qahtani' }],
    'PLANNED RESOURCES': [{ type: 'Material', item: 'Air filter 500 × 500 mm', quantity: 6 }]
  },
  {
    // Genuinely late, never held - proves the pause is not a blanket amnesty. This one
    // must still be counted as an SLA violation.
    ...base,
    WORKORDER: '56540103',
    'DESCRIPITION ': 'Condensate drain blocked — meeting room 054',
    STATUS: 'INPRG',
    'STATUS DESCRIPITION': 'In Progress',
    ASSET: 'SSU-200-0001',
    'ASSET DESCRIPTION': 'SPLIT UNIT',
    'LOCATION ': 'RC-1031-RD-001-00-056',
    'DEPARTMENT ': 'Mechanics',
    'SUB DEPARTMENT  NAME': 'Plumbing',
    SYSTEM: 'Drainage System',
    'LOCATION PRIORTY': 1,
    PRIORTY: 1,
    SITE: '1031',
    'REPORTED DATE ': local(-6),
    'TARGET START ': local(-5),
    'TARGET FINISH ': local(-2),
    'PLANNED LABOR': [{ craft: 'Plumbing Technician', hours: '2', crew: 'Khalid Al Mutairi' }],
    'PLANNED RESOURCES': [{ type: 'Material', item: 'PVC pipe 25 mm', quantity: 3 }]
  },
  {
    // Resumed after a 4-day hold. Not currently held, target finish passed 1 day ago, but
    // the 4 days are credited back - so it is inside its effective deadline. This is the
    // "extend on resume" case.
    ...base,
    WORKORDER: '56540104',
    'DESCRIPITION ': 'FCU grille refit — resumed after spare delivery',
    STATUS: 'INPRG',
    'STATUS DESCRIPITION': 'In Progress',
    'HELD FROM': '',
    holdPeriods: [{ startedAt: iso(-7), endedAt: iso(-3), reason: 'MATERIAL' }],
    ASSET: 'FCU-100-0001-RGS-500-0009',
    'ASSET DESCRIPTION': 'FAN COIL UNIT',
    'LOCATION ': 'RC-1034-AS-008-04-190',
    'DEPARTMENT ': 'Mechanics',
    SITE: '1034',
    'REPORTED DATE ': local(-9),
    'TARGET START ': local(-8),
    'TARGET FINISH ': local(-1),
    'SUB DEPARTMENT  NAME': 'Mechanical Systems',
    SYSTEM: 'Air Handling & FCU System',
    'PLANNED LABOR': [{ craft: 'Mechanical Technician', hours: '4', crew: 'Majed Al Ghamdi' }],
    'PLANNED RESOURCES': [
      { type: 'Material', item: 'Refrigerant R410A', quantity: 2 },
      { type: 'Tool', item: 'Refrigerant recovery machine', quantity: 1 }
    ]
  }
]

export default workOrderSeeds

const firstValue = (row, keys, fallback = '') => {
  for (const key of keys) {
    const value = row?.[key]
    if (value !== undefined && value !== null && String(value).trim() !== '') return value
  }
  return fallback
}

const normalizePriority = value => {
  const text = String(value || '').trim()
  if (text.startsWith('1') || /emergency/i.test(text)) return 1
  if (text.startsWith('2') || /high/i.test(text)) return 2
  if (text.startsWith('3') || /medium|low/i.test(text)) return 3
  return Number(text) || 3
}

const normalizeWorkType = value => {
  const text = String(value || '').trim().toUpperCase()
  if (text === 'PM') return 'PM'
  if (text === 'INCIDENT') return 'Incident'
  return 'CM'
}

export const normalizeWorkOrderRow = row => {
  const status = String(firstValue(row, ['STATUS', 'Status'], 'WAPPR')).trim().toUpperCase() || 'WAPPR'
  const workType = normalizeWorkType(firstValue(row, ['WORK TYPE ', 'WORK TYPE', 'WORKTYPE', 'Work Type'], 'CM'))

  return {
    ...row,
    WORKORDER: String(firstValue(row, ['WORKORDER', 'WO Number', 'Work Order Number'], row.WORKORDER || '')).trim(),
    'DESCRIPITION ': firstValue(row, ['DESCRIPITION ', 'DESCRIPTION', 'Description', 'description'], ''),
    'LONG DESCRIPTION': firstValue(row, ['LONG DESCRIPTION', 'LONG DESCRIPTION ', 'Long Description'], ''),
    'LOCATION ': firstValue(row, ['LOCATION ', 'LOCATION', 'Location', 'location'], ''),
    'LOCATION PRIORTY': firstValue(row, ['LOCATION PRIORTY', 'LOCATION PRIORITY', 'Location Priority'], 3),
    ASSET: firstValue(row, ['ASSET', 'ASSETNUM', 'Asset', 'asset'], ''),
    'ASSET DESCRIPTION': firstValue(row, ['ASSET DESCRIPTION', 'Asset Description'], ''),
    STATUS: status,
    'WORK TYPE ': workType,
    'STATUS DESCRIPITION': firstValue(row, ['STATUS DESCRIPITION', 'STATUS DESCRIPTION', 'Status Description'], status),
    'DEPARTMENT ': firstValue(row, ['DEPARTMENT ', 'DEPARTMENT', 'Department', 'department'], ''),
    'SUB DEPARTMENT  NAME': firstValue(row, ['SUB DEPARTMENT  NAME', 'SUB DEPARTMENT NAME', 'SUB DEPARTMENT', 'Sub Department', 'subDepartment'], ''),
    'ASSIGNED DEPARTMENT': firstValue(row, ['ASSIGNED DEPARTMENT', 'Assigned Department', 'assignedDepartment'], firstValue(row, ['DEPARTMENT ', 'DEPARTMENT', 'Department', 'department'], '')),
    PRIORTY: normalizePriority(firstValue(row, ['PRIORTY', 'PRIORITY', 'Priority', 'priority'], 3)),
    SITE: String(firstValue(row, ['SITE', 'Site', 'site'], '1031')).trim(),
    'TARGET START ': firstValue(row, ['TARGET START ', 'TARGET START', 'Target Start'], null),
    'TARGET FINISH ': firstValue(row, ['TARGET FINISH ', 'TARGET FINISH', 'Target Finish'], null),
    'ACTUAL START ': firstValue(row, ['ACTUAL START ', 'ACTUAL START', 'Actual Start'], null),
    'ACTUAL FINISH ': firstValue(row, ['ACTUAL FINISH ', 'ACTUAL FINISH', 'Actual Finish'], null),
    'REPORTED DATE ': firstValue(row, ['REPORTED DATE ', 'REPORTED DATE', 'Reported Date'], null),
    'FAILURE CODE': firstValue(row, ['FAILURE CODE', 'Failure Code'], ''),
    'PROBLEM CODE': firstValue(row, ['PROBLEM CODE', 'Problem Code'], ''),
    'CAUSE CODE': firstValue(row, ['CAUSE CODE', 'Cause Code'], ''),
    'REMEDY CODE': firstValue(row, ['REMEDY CODE', 'Remedy Code'], ''),
    'JOB PLAN': firstValue(row, ['JOB PLAN', 'JPNUM', 'JOP PLAN ', 'JOP PLAN'], ''),
    'PM NUMBER': firstValue(row, ['PM NUMBER', 'PM ', 'PM', 'PMNUM'], '')
  }
}

export const normalizeWorkOrderRows = rows => rows
  .map(normalizeWorkOrderRow)
  .filter(row => row.WORKORDER || row['DESCRIPITION '])

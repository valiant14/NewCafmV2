import structure from '../data/codingStructure.json'

// Patterns live in codingStructure.json as strings and are compiled here, so swapping in
// the approved structure for a project is a data edit rather than a code change.
const assetSegment = structure.asset.segment
const assetPattern = new RegExp(`^${assetSegment}(-${assetSegment})*$`)
const locationPattern = new RegExp(`^${structure.location.segment}$`)

const clean = value => String(value ?? '').trim().toUpperCase()

export const assetTypes = structure.asset.types
export const assetTypeName = code => assetTypes.find(type => type.code === clean(code))?.name || ''
export const projectPrefix = structure.project

const pad = (value, length) => String(value).padStart(length, '0')

export const isDuplicateCode = (rows = [], key, value, ignore = '') => {
  const target = clean(value)
  if (!target) return false
  return rows.some(row => clean(row?.[key]) === target && clean(row?.[key]) !== clean(ignore))
}

// A root asset is one TYPE-SERIES-SEQUENCE segment; a child is its parent's whole code
// plus one more segment, which is how FCU-100-0001-RGS-500-0009 is built.
export const validateAssetCode = (code, { rows = [], parentCode = '', ignore = '' } = {}) => {
  const value = clean(code)
  if (!value) return { valid: false, reason: 'Asset number is required.' }
  if (!assetPattern.test(value)) {
    return { valid: false, reason: `Asset number must follow ${structure.asset.pattern} (for example SSU-100-0001).` }
  }
  const parent = clean(parentCode)
  if (parent && !value.startsWith(`${parent}-`)) {
    return { valid: false, reason: `A child asset must start with its parent code ${parent}.` }
  }
  if (isDuplicateCode(rows, 'assetnum', value, ignore)) {
    return { valid: false, reason: `Asset number ${value} already exists.` }
  }
  return { valid: true, reason: '' }
}

export const conformsToAssetCode = code => assetPattern.test(clean(code))

export const nextAssetCode = (rows = [], { type, series, parentCode = '' } = {}) => {
  const typeCode = clean(type)
  if (!typeCode) return ''
  const seriesCode = pad(clean(series) || structure.asset.defaultSeries, structure.asset.seriesLength)
  const parent = clean(parentCode)
  const prefix = parent ? `${parent}-${typeCode}-${seriesCode}` : `${typeCode}-${seriesCode}`
  const highest = rows.reduce((max, row) => {
    const value = clean(row?.assetnum)
    if (!value.startsWith(`${prefix}-`)) return max
    const tail = value.slice(prefix.length + 1)
    // Only the immediate segment counts; a grandchild must not bump the parent series.
    if (tail.includes('-')) return max
    return Math.max(max, Number(tail) || 0)
  }, 0)
  return `${prefix}-${pad(highest + 1, structure.asset.sequenceLength)}`
}

export const conformsToLocationCode = code => locationPattern.test(clean(code))

// Also checks the code agrees with the record's own site and building fields - the exact
// mismatch in RC-1031-RD-01-00-ES01, whose building field says RD-001.
export const validateLocationCode = (code, { rows = [], site = '', building = '', ignore = '' } = {}) => {
  const value = clean(code)
  if (!value) return { valid: false, reason: 'Location code is required.' }
  if (!locationPattern.test(value)) {
    return { valid: false, reason: `Location must follow ${structure.location.pattern} (for example RC-1031-RD-001-00-054).` }
  }
  const parts = value.split('-')
  if (clean(site) && parts[1] !== clean(site)) {
    return { valid: false, reason: `Code says site ${parts[1]} but the record's site is ${clean(site)}.` }
  }
  const buildingCode = clean(building)
  if (buildingCode && `${parts[2]}-${parts[3]}` !== buildingCode) {
    return { valid: false, reason: `Code says building ${parts[2]}-${parts[3]} but the record's building is ${buildingCode}.` }
  }
  if (isDuplicateCode(rows, 'location', value, ignore)) {
    return { valid: false, reason: `Location ${value} already exists.` }
  }
  return { valid: true, reason: '' }
}

export const nextLocationCode = ({ site = '', building = '', floor = '', room = '' } = {}) => {
  const siteCode = clean(site)
  const buildingCode = clean(building)
  if (!siteCode || !buildingCode) return ''
  const base = `${structure.project}-${pad(siteCode, structure.location.siteLength)}-${buildingCode}`
  if (!String(floor).trim()) return base
  const floorCode = pad(clean(floor), structure.location.floorLength)
  if (!String(room).trim()) return `${base}-${floorCode}`
  return `${base}-${floorCode}-${pad(clean(room), structure.location.roomLength)}`
}

export const countNonConforming = (rows = [], key, test) => rows.filter(row => row?.[key] && !test(row[key])).length

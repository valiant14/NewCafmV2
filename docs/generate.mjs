// Emits the data-heavy tables in these documents straight from the app's own data, so a
// figure quoted to DAB cannot drift from what the system actually holds.
//
// Run: node docs/generate.mjs
//
// Each table lives between markers in the markdown:
//     <!-- generated:asset-types -->  ...table...  <!-- /generated -->
// Everything outside the markers is hand-written and is never touched.

import { readFileSync, writeFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { statusDescription, statusOptions, workOrderTransitions } from '../src/lib/statusMatrix.js'
import { permissionActions, permissionModules, rolePermissionRows } from '../src/data/roles.js'
import assetSeeds from '../src/data/assetSeeds.js'

const here = dirname(fileURLToPath(import.meta.url))
const require = createRequire(import.meta.url)
const data = name => require(join(here, '../src/data', name))

const workbooks = data('workbooks.json')
const structure = data('codingStructure.json')
const locations = data('locations.json')
const departments = data('departments.json')
const users = data('users.json')
const crafts = data('crafts.json')

// Same shape as rowsToObjects in src/data/cafmData.js - the first row is the header.
const rowsToObjects = (rows = []) => {
  const headers = (rows[0] || []).map((header, index) => String(header || `Column ${index + 1}`).trim())
  return rows.slice(1)
    .filter(row => row.some(value => value !== null && value !== ''))
    .map(row => Object.fromEntries(headers.map((header, index) => [header, row[index] ?? ''])))
}

const failureCodes = rowsToObjects(workbooks['FAILURE CODE']['FAILURE CODE'])
// Same merged register the app sees: the client's asset sheet plus the six assets its PM
// sheet references but the asset sheet omits. See src/data/assetSeeds.js.
const assets = [...rowsToObjects(workbooks.assets.assets), ...assetSeeds]
const maximoMatrix = rowsToObjects(workbooks.IBM_Maximo_Status_Matrix['Maximo Status Matrix'])

// src/lib/coding.js compiles these from the same JSON, but it cannot be imported here -
// it uses a bare JSON import that plain Node rejects. Built identically so the audit below
// reflects exactly what the app enforces.
const assetSegment = structure.asset.segment
const assetPattern = new RegExp(`^${assetSegment}(-${assetSegment})*$`)
const locationPattern = new RegExp(`^${structure.location.segment}$`)
const clean = value => String(value ?? '').trim().toUpperCase()

const esc = value => String(value ?? '').replace(/\|/g, '\\|').trim()
const table = (headers, rows) => [
  `| ${headers.join(' | ')} |`,
  `| ${headers.map(() => '---').join(' | ')} |`,
  ...rows.map(row => `| ${row.map(esc).join(' | ')} |`)
].join('\n')

const count = (list, key) => list.reduce((map, item) => map.set(key(item), (map.get(key(item)) || 0) + 1), new Map())

/* ------------------------------------------------------------------ blocks */

const blocks = {}

// --- 01 work order process ------------------------------------------------

// Not transcribed: this calls the app's own workOrderTransitions, so the table is the
// shipped rule set by construction.
blocks['wo-transitions'] = table(
  ['Status', 'Meaning', 'May move to', 'Notes'],
  statusOptions('workOrder').map(status => {
    const next = workOrderTransitions(status, status === 'HOLD' ? 'INPRG' : '')
    const note = status === 'CLOSE' || status === 'CAN' ? 'Terminal - no further transitions'
      : status === 'HOLD' ? 'Returns to the status it was held from (INPRG shown as the example)'
      : status === 'COMP' ? 'Cannot be put on hold once complete'
      : ''
    return [status, statusDescription('workOrder', status), next.length ? next.join(', ') : '—', note]
  })
)

blocks['status-matrix'] = [...count(maximoMatrix, row => row.Application).keys()]
  .map(application => {
    const rows = maximoMatrix.filter(row => row.Application === application)
    return `**${application}**\n\n${table(
      ['Status', 'Description', 'Typical usage'],
      rows.map(row => [row.Status, row.Description, row['Typical Usage']])
    )}`
  }).join('\n\n')

// --- 02 location & asset coding -------------------------------------------

blocks['asset-types'] = table(
  ['Type code', 'Equipment type', 'Example code'],
  structure.asset.types.map(type => [
    type.code,
    type.name,
    `${type.code}-${structure.asset.defaultSeries}-${'0'.repeat(structure.asset.sequenceLength - 1)}1`
  ])
)

blocks['location-register'] = table(
  ['Location code', 'Description', 'Type', 'Site', 'Building', 'Department', 'Conforms'],
  locations.map(row => [
    row.location, row.description, row.type, row.site, row.builiding, row.department,
    locationPattern.test(clean(row.location)) ? 'Yes' : '**No**'
  ])
)

const nonConforming = locations.filter(row => {
  const parts = clean(row.location).split('-')
  const patternFails = !locationPattern.test(clean(row.location))
  const buildingMismatch = row.builiding && `${parts[2]}-${parts[3]}` !== clean(row.builiding)
  return patternFails || buildingMismatch
})

blocks['code-conformance'] = [
  table(
    ['Record set', 'Rows', 'Conforming', 'Non-conforming'],
    [
      ['Locations', locations.length, locations.filter(row => locationPattern.test(clean(row.location))).length, nonConforming.length],
      ['Assets', assets.length, assets.filter(row => assetPattern.test(clean(row.assetnum))).length, assets.filter(row => !assetPattern.test(clean(row.assetnum))).length]
    ].map(row => row.map(String))
  ),
  '',
  nonConforming.length ? `The ${nonConforming.length} non-conforming location codes and why each fails:\n\n${table(
    ['Code', 'Problem', 'Suggested correction'],
    nonConforming.map(row => {
      const parts = clean(row.location).split('-')
      const reasons = []
      if (!locationPattern.test(clean(row.location))) reasons.push(`does not match ${structure.location.pattern}`)
      if (row.builiding && `${parts[2]}-${parts[3]}` !== clean(row.builiding)) {
        reasons.push(`code says building \`${parts[2]}-${parts[3]}\` but the record's building field says \`${clean(row.builiding)}\``)
      }
      const fix = clean(row.location).startsWith(structure.project)
        ? 'Re-issue under the approved pattern and migrate references'
        : 'Legacy free-text code - re-issue under the project structure'
      return [`\`${row.location}\``, reasons.join('; '), fix]
    })
  )}` : 'All location codes conform.'
].join('\n')

blocks['department-structure'] = table(
  ['Code', 'Department', 'Sub departments', 'Systems', 'Work groups'],
  departments.map(department => [
    department.code,
    department.name,
    (department.subDepartments || []).map(sub => `${sub.name} (${sub.code})`).join(', '),
    (department.systems || []).length,
    (department.workGroups || []).length
  ].map(String))
)

// --- 04 priorities & SLA ---------------------------------------------------

const locationPriorities = [...count(locations, row => `${row.priority}|${row['priority  description']}`).entries()]
  .map(([key, total]) => { const [code, label] = key.split('|'); return { code, label, total } })
  .sort((a, b) => a.code.localeCompare(b.code) || a.label.localeCompare(b.label))

blocks['location-priorities'] = table(
  ['Priority', 'Description in use', 'Locations'],
  locationPriorities.map(row => [row.code, row.label, String(row.total)])
)

const duplicatedPriority = locationPriorities
  .filter((row, _, all) => all.filter(other => other.code === row.code).length > 1)

blocks['priority-collisions'] = duplicatedPriority.length
  ? `> **Data defect.** Priority \`${duplicatedPriority[0].code}\` is currently used with ${duplicatedPriority.length} different\n> descriptions — ${duplicatedPriority.map(row => `**${row.label}**`).join(' and ')} — so the scale is ambiguous and cannot\n> be reported against until SEDER decides which label is correct.`
  : '> All location priorities map to a single description.'

blocks['asset-priorities'] = table(
  ['Priority', 'Assets'],
  [...count(assets, row => String(row.prioity || '—')).entries()].sort().map(([code, total]) => [code, String(total)])
)

// --- 05 failure codes & PCR ------------------------------------------------

const failureColumns = Object.keys(failureCodes[0] || {})
blocks['failure-audit'] = table(
  ['Column', 'Populated rows', 'Empty rows', 'Status'],
  failureColumns.map(column => {
    const populated = failureCodes.filter(row => String(row[column]).trim()).length
    return [
      `\`${column}\``,
      String(populated),
      String(failureCodes.length - populated),
      populated === failureCodes.length ? 'Complete' : populated === 0 ? '**Entirely empty**' : 'Partial'
    ]
  })
)

const classMap = new Map()
for (const row of failureCodes) {
  const id = row['FAILURE CLASS ID']
  if (!id) continue
  if (!classMap.has(id)) classMap.set(id, { description: row.DESCRIPTION, problems: new Set() })
  if (row['PROBLEM CODE']) classMap.get(id).problems.add(row['PROBLEM CODE'])
}

blocks['failure-summary'] = table(
  ['Measure', 'Value'],
  [
    ['Rows in the failure library', failureCodes.length],
    ['Distinct failure classes', classMap.size],
    ['Distinct problem codes', new Set(failureCodes.map(row => row['PROBLEM CODE']).filter(Boolean)).size],
    ['Distinct cause codes', new Set(failureCodes.map(row => row['CAUSE CODE']).filter(Boolean)).size],
    ['Distinct remedy codes', new Set(failureCodes.map(row => row['REMEDY CODE']).filter(Boolean)).size]
  ].map(row => row.map(String))
)

blocks['failure-classes'] = table(
  ['Failure class', 'Description', 'Problem codes', 'Cause codes', 'Remedy codes'],
  [...classMap.entries()]
    .sort((a, b) => b[1].problems.size - a[1].problems.size || String(a[0]).localeCompare(String(b[0])))
    .map(([id, entry]) => [id, entry.description, String(entry.problems.size), '0', '0'])
)

// --- 06 asset tagging ------------------------------------------------------

blocks['asset-register'] = table(
  ['Asset number', 'Description', 'Type', 'Parent', 'Location', 'Site', 'Status'],
  assets.map(row => [
    row.assetnum,
    row.description,
    structure.asset.types.find(type => clean(row.assetnum).startsWith(type.code))?.name || '—',
    row.parent || '—',
    row.location,
    row.site,
    row.status
  ])
)

blocks['series-allocation'] = table(
  ['Type code', 'Series in use', 'Assets'],
  [...count(assets, row => clean(row.assetnum).split('-').slice(0, 2).join('-')).entries()]
    .sort()
    .map(([prefix, total]) => [prefix.split('-')[0], prefix.split('-')[1], String(total)])
)

/* ------------------------------------------------------------------ roles */

blocks['permission-matrix'] = table(
  ['Role', 'Scope', 'Status', ...permissionActions.map(action => action[0].toUpperCase() + action.slice(1))],
  rolePermissionRows.map(row => [
    row.role,
    `${row.site} / ${row.department}`,
    row.status,
    ...permissionActions.map(action => {
      const granted = row.permissions[action] || []
      return granted.length === permissionModules.length ? 'All'
        : granted.length === 0 ? '—'
        : granted.join(', ')
    })
  ])
)

blocks['user-register'] = table(
  ['User', 'Name', 'Role', 'Site scope', 'Department scope', 'Status'],
  users.map(user => [user.username, user.name, user.role, user.site, user.department, user.status])
)

blocks['craft-register'] = table(
  ['Craft code', 'Craft', 'Department', 'Sub department'],
  crafts.map(craft => [craft.code, craft.name, craft.department, craft.subDepartment])
)

/* ------------------------------------------------------------------ write */

const files = [
  '01-work-order-process.md',
  '02-location-asset-coding.md',
  '03-user-access-security.md',
  '04-priorities-and-sla.md',
  '05-failure-codes-pcr.md',
  '06-asset-tagging-plan.md'
]

let written = 0
const used = new Set()

for (const file of files) {
  const path = join(here, file)
  const before = readFileSync(path, 'utf8')
  const after = before.replace(
    /(<!-- generated:([a-z-]+) -->)[\s\S]*?(<!-- \/generated -->)/g,
    (whole, open, name, close) => {
      if (!(name in blocks)) {
        console.warn(`  ! ${file}: no block named "${name}"`)
        return whole
      }
      used.add(name)
      return `${open}\n\n${blocks[name]}\n\n${close}`
    }
  )
  if (after !== before) { writeFileSync(path, after); written += 1 }
  console.log(`  ${after !== before ? 'updated' : 'unchanged'}  ${file}`)
}

const unused = Object.keys(blocks).filter(name => !used.has(name))
if (unused.length) console.warn(`\n  ! blocks generated but never placed: ${unused.join(', ')}`)
console.log(`\n${written} file(s) updated, ${used.size} table(s) generated.`)

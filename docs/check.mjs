// Verifies the committed documents against the data they describe.
//
// Run: node docs/check.mjs
//
// Every figure quoted to DAB is re-derived here from source, independently of
// generate.mjs, and asserted to appear in the markdown. A document that has drifted from
// the system - or a generator bug - fails loudly rather than shipping a wrong number.

import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { statusOptions, workOrderTransitions } from '../src/lib/statusMatrix.js'
import { permissionActions, permissionModules, rolePermissionRows } from '../src/data/roles.js'
import assetSeeds from '../src/data/assetSeeds.js'

const here = dirname(fileURLToPath(import.meta.url))
const require = createRequire(import.meta.url)
const data = name => require(join(here, '../src/data', name))
const doc = name => readFileSync(join(here, name), 'utf8')

const workbooks = data('workbooks.json')
const structure = data('codingStructure.json')
const locations = data('locations.json')
const users = data('users.json')
const crafts = data('crafts.json')

const rowsToObjects = (rows = []) => {
  const headers = (rows[0] || []).map((h, i) => String(h || `Column ${i + 1}`).trim())
  return rows.slice(1).filter(r => r.some(v => v !== null && v !== ''))
    .map(r => Object.fromEntries(headers.map((h, i) => [h, r[i] ?? ''])))
}

const failureCodes = rowsToObjects(workbooks['FAILURE CODE']['FAILURE CODE'])
// Same merged register the app sees: the client's asset sheet plus the six assets its PM
// sheet references but the asset sheet omits. See src/data/assetSeeds.js.
const assets = [...rowsToObjects(workbooks.assets.assets), ...assetSeeds]
const clean = v => String(v ?? '').trim().toUpperCase()
const locationPattern = new RegExp(`^${structure.location.segment}$`)
const assetPattern = new RegExp(`^${structure.asset.segment}(-${structure.asset.segment})*$`)

let failures = 0
let checks = 0

const check = (label, condition, detail = '') => {
  checks += 1
  if (condition) { console.log(`  ok    ${label}`); return }
  failures += 1
  console.log(`  FAIL  ${label}${detail ? `\n          ${detail}` : ''}`)
}
const contains = (file, needle, label) =>
  check(label, doc(file).includes(needle), `expected to find: ${needle}`)

const section = title => console.log(`\n${title}`)

/* -------------------------------------------------- 01 work order process */

section('01 work order process')
const d1 = doc('01-work-order-process.md')

for (const status of statusOptions('workOrder')) {
  const next = workOrderTransitions(status, status === 'HOLD' ? 'INPRG' : '')
  const expected = `| ${status} |`
  const row = d1.split('\n').find(line => line.startsWith(expected))
  check(`transition row present for ${status}`, Boolean(row))
  if (row) {
    const cell = row.split('|')[3].trim()
    const documented = cell === '—' ? [] : cell.split(',').map(s => s.trim())
    check(
      `${status} transitions match the app (${next.join(', ') || 'none'})`,
      documented.length === next.length && next.every(s => documented.includes(s)),
      `document says: ${cell}`
    )
  }
}

// The mermaid diagram must not claim a transition the engine forbids.
const mermaid = d1.slice(d1.indexOf('stateDiagram-v2'), d1.indexOf('```', d1.indexOf('stateDiagram-v2')))
const drawn = [...mermaid.matchAll(/^\s*(\w+) --> (\w+)$/gm)]
  .map(m => [m[1], m[2]])
  .filter(([from, to]) => from !== '[*]' && to !== '[*]')
const bogus = drawn.filter(([from, to]) => !workOrderTransitions(from, from === 'HOLD' ? 'INPRG' : '').includes(to))
check('every edge in the diagram is a transition the app allows', bogus.length === 0,
  bogus.map(([f, t]) => `${f} --> ${t}`).join(', '))

const missingEdges = statusOptions('workOrder').flatMap(status =>
  workOrderTransitions(status, status === 'HOLD' ? 'INPRG' : '')
    .filter(to => !drawn.some(([f, t]) => f === status && t === to))
    .map(to => `${status} --> ${to}`))
check('every allowed transition appears in the diagram', missingEdges.length === 0, missingEdges.join(', '))

const maximo = rowsToObjects(workbooks.IBM_Maximo_Status_Matrix['Maximo Status Matrix'])
check(`status matrix reference carries all ${maximo.length} rows`,
  maximo.every(row => d1.includes(`| ${row.Status} | ${row.Description} |`)) )

/* ------------------------------------------------- 02 location & asset coding */

section('02 location & asset coding')
const conformingLocations = locations.filter(r => locationPattern.test(clean(r.location))).length
const nonConforming = locations.length - conformingLocations
contains('02-location-asset-coding.md', `| Locations | ${locations.length} | ${conformingLocations} |`,
  `location conformance ${conformingLocations}/${locations.length}`)
contains('02-location-asset-coding.md', `| Assets | ${assets.length} | ${assets.filter(r => assetPattern.test(clean(r.assetnum))).length} |`,
  `asset conformance out of ${assets.length}`)
check('every non-conforming location code is named in the document',
  locations.filter(r => !locationPattern.test(clean(r.location)))
    .every(r => doc('02-location-asset-coding.md').includes(r.location)),
  `${nonConforming} expected`)
check(`all ${structure.asset.types.length} asset type codes documented`,
  structure.asset.types.every(t => doc('02-location-asset-coding.md').includes(`| ${t.code} | ${t.name} |`)))
contains('02-location-asset-coding.md', structure.location.pattern, 'location pattern quoted correctly')
contains('02-location-asset-coding.md', structure.asset.pattern, 'asset pattern quoted correctly')
contains('02-location-asset-coding.md', `| Project prefix | \`${structure.project}\` |`, 'project prefix quoted correctly')

/* -------------------------------------------------- 03 user access & security */

section('03 user access & security')
const d3 = doc('03-user-access-security.md')
check(`all ${rolePermissionRows.length} roles in the matrix`,
  rolePermissionRows.every(r => d3.includes(`| ${r.role} |`)))
check(`all ${users.length} users in the register`, users.every(u => d3.includes(`| ${u.username} |`)))
check(`all ${crafts.length} crafts listed`, crafts.every(c => d3.includes(`| ${c.code} |`)))
check(`all ${permissionModules.length} modules named`, permissionModules.every(m => d3.includes(m)))
check(`all ${permissionActions.length} actions defined`, permissionActions.every(a => d3.includes(`\`${a}\``)))
// The enforcement caveat is the most important sentence in the document.
check('states that access control is UI-only, not a security boundary',
  /interface only/i.test(d3) && /not a security boundary/i.test(d3))

/* -------------------------------------------------- 04 priorities & SLA */

section('04 priorities & SLA')
const d4 = doc('04-priorities-and-sla.md')
const priorityLabels = new Map()
for (const row of locations) {
  const key = String(row.priority)
  if (!priorityLabels.has(key)) priorityLabels.set(key, new Set())
  priorityLabels.get(key).add(row['priority  description'])
}
const collisions = [...priorityLabels.entries()].filter(([, labels]) => labels.size > 1)
check('every location priority/description pair is listed',
  [...priorityLabels.entries()].every(([code, labels]) => [...labels].every(l => d4.includes(`| ${code} | ${l} |`))))
check(`the priority collision is flagged (${collisions.map(([c]) => c).join(', ') || 'none found'})`,
  collisions.length === 0 || /data defect/i.test(d4))
// Nothing invented may be presented as contractual fact.
check('proposed SLA values are explicitly marked as a proposal, not contract terms',
  /a proposal, not a record of contractual terms/i.test(d4) &&
  /Proposed values — to be confirmed against the contractual SLA schedule/i.test(d4))
check('states plainly that no response-time data exists in the system',
  /No response-time or resolution-time values exist anywhere/i.test(d4))

/* -------------------------------------------------- 05 failure codes & PCR */

section('05 failure codes & PCR')
const d5 = doc('05-failure-codes-pcr.md')
const classes = new Set(failureCodes.map(r => r['FAILURE CLASS ID']).filter(Boolean))
const problems = new Set(failureCodes.map(r => r['PROBLEM CODE']).filter(Boolean))
const causes = new Set(failureCodes.map(r => r['CAUSE CODE']).filter(Boolean))
const remedies = new Set(failureCodes.map(r => r['REMEDY CODE']).filter(Boolean))

contains('05-failure-codes-pcr.md', `| Rows in the failure library | ${failureCodes.length} |`, `row count ${failureCodes.length}`)
contains('05-failure-codes-pcr.md', `| Distinct failure classes | ${classes.size} |`, `class count ${classes.size}`)
contains('05-failure-codes-pcr.md', `| Distinct problem codes | ${problems.size} |`, `problem count ${problems.size}`)
check('cause codes really are zero, and the document says zero',
  causes.size === 0 && d5.includes('| Distinct cause codes | 0 |'))
check('remedy codes really are zero, and the document says zero',
  remedies.size === 0 && d5.includes('| Distinct remedy codes | 0 |'))
check(`all ${classes.size} failure classes listed in the reference table`,
  [...classes].every(id => d5.includes(`| ${id} |`)))
check('worked PCR examples are marked as not SEDER-approved',
  /not\*\* SEDER-approved codes/i.test(d5))
// Guard against the failure mode that matters: invented codes presented as real data.
const inventedInAudit = /\| `CAUSE CODE` \| (?!0 \|)/.test(d5)
check('no invented cause/remedy data is presented as existing library content', !inventedInAudit)

/* -------------------------------------------------- 06 asset tagging */

section('06 asset tagging')
const d6 = doc('06-asset-tagging-plan.md')
check(`all ${assets.length} assets in the register`, assets.every(a => d6.includes(`| ${a.assetnum} |`)))
check('the parent/child tagging rule uses a real composite code',
  assets.some(a => a.parent && d6.includes(a.assetnum)))
check('marked as a proposal', /This document is a proposal/i.test(d6))

/* -------------------------------------------------- cross-document */

section('cross-document')
const all = ['01-work-order-process.md', '02-location-asset-coding.md', '03-user-access-security.md',
  '04-priorities-and-sla.md', '05-failure-codes-pcr.md', '06-asset-tagging-plan.md']
check('no unfilled generated blocks remain',
  all.every(f => !/<!-- generated:[a-z-]+ -->\s*<!-- \/generated -->/.test(doc(f))))
check('every document names its DAB section', all.every(f => /DAB review Section A\.\d/.test(doc(f))))

/* -------------------------------------------------- result */

console.log(`\n${checks - failures}/${checks} checks passed.`)
if (failures) { console.error(`${failures} FAILED`); process.exit(1) }

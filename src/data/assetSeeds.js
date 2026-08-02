// Assets referenced by the client's PM sheet that are missing from the client's asset
// sheet. Both sheets come from the same workbook, and they use different coding schemes -
// the asset sheet uses TYPE-SERIES-SEQUENCE (SSU-100-0001) while the PM sheet uses a
// site/discipline prefix (ALS-HV-00001, MS-MEC-FCU-001).
//
// The codes below are the client's own, kept verbatim. Renaming them to fit the documented
// structure would connect the data at the cost of hiding a real finding - see
// docs/02-location-asset-coding.md §2.4, which reports them as non-conforming.
//
// Held here rather than appended to workbooks.json so the imported client data stays
// exactly as delivered, and so the two schemes remain visibly distinct.

const asset = (assetnum, description, location, extra = {}) => ({
  assetnum,
  description,
  location,
  parent: null,
  department: 'Mechanics',
  'sub department': 'HVAC',
  prioity: 2,
  site: 1031,
  status: 'OPERATING',
  'asset short name': null,
  modelnum: null,
  serialnum: null,
  installdate: '2023-01-01',
  quantity: 1,
  ...extra
})

const assetSeeds = [
  asset('ALS-HV-00001', 'SPLIT A/C UNIT', 'RC-1031-RD-001-00-055'),
  asset('ALS-HV-00002', 'SPLIT A/C UNIT', 'RC-1031-RD-001-00-055'),
  asset('ALS-HV-00003', 'PACKAGE A/C UNIT', 'RC-1031-RD-01-00-ES01'),
  asset('MS-MEC-FCU-001', 'FAN COIL UNIT', 'RC-1034-AS-008-04-190', { site: 1034 }),
  asset('MS-MEC-SAU-001', 'SPLIT A/C UNIT', 'RC-1031-RD-01-00-ES01'),
  // The PM schedule routes fire dampers to Plumbing; kept consistent with it.
  asset('MS-MEC-FDA-001', 'FIRE DAMPER', 'RC-1031-RD-001-00-055', { 'sub department': 'Plumbing', prioity: 1 })
]

// FCU-100-0001 is on the client's asset sheet with an empty location, which breaks the
// asset -> location cascade. Corrected here rather than by editing the imported workbook.
// Its child FCU-100-0001-RGS-500-0009 already sits in this room.
export const assetOverrides = {
  'FCU-100-0001': { location: 'RC-1034-AS-008-04-190' }
}

export default assetSeeds

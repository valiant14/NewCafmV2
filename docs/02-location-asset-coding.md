# 2. Proposed Location & Asset Structure Coding

**SEDER CAFM · Document 2 of 6 · prepared in response to DAB review Section A.2**

Scope: the coding structure for locations and assets, how it is applied per project, and an audit of how far
the data currently in the system conforms to it.

---

## 2.1 How the structure is held per project

DAB asked for a structure "for each project". The system holds one coding definition per project in a single
data file (`src/data/codingStructure.json`) containing the project prefix, the two patterns and their segment
lengths. The application compiles those patterns at runtime, so **adopting a different structure for another
project is a data change, not a software change** — no rebuild, no developer.

The structure documented here is the one currently in force:

| Setting | Value |
|---|---|
| Project prefix | `RC` |
| Location pattern | `{PROJECT}-{SITE}-{BUILDING}-{FLOOR}-{ROOM}` |
| Asset pattern | `{TYPE}-{SERIES}-{SEQUENCE}` |
| Child asset pattern | `{PARENT}-{TYPE}-{SERIES}-{SEQUENCE}` |

---

## 2.2 Location coding

```
RC  -  1031  -  RD-001  -  00  -  054
│      │        │          │      │
│      │        │          │      └─ Room       3 digits
│      │        │          └──────── Floor      2 digits, 00 = ground
│      │        └─────────────────── Building   2–3 letter code + 3 digits
│      └──────────────────────────── Site       4 digits
└─────────────────────────────────── Project    2 letters
```

**The hierarchy is expressed by truncation**, which is what makes roll-up reporting work without a separate
parent field:

| Level | Code | Meaning |
|---|---|---|
| Building | `RC-1031-RD-001` | Riyadh District Main Building |
| Floor | `RC-1031-RD-001-00` | Ground floor of that building |
| Room | `RC-1031-RD-001-00-054` | Meeting Room 054 on that floor |

A location is therefore a child of any location whose code is a prefix of its own. Work orders raised against
a room roll up to the floor and the building automatically.

**Rules**

1. Every segment is zero-padded to its fixed width. `RD-1` is not a valid building; `RD-001` is.
2. Floor `00` is ground. Basements use `B1`, `B2` in the floor segment.
3. The code must agree with the record's own `site` and `building` fields. The system rejects a code whose
   site segment contradicts the site on the record — see the audit below for why this matters.
4. Codes are unique. The system rejects duplicates on entry.

### Location register

<!-- generated:location-register -->

| Location code | Description | Type | Site | Building | Department | Conforms |
| --- | --- | --- | --- | --- | --- | --- |
| RC-1031-RD-001 | Riyadh District Main Building | Building | 1031 | RD-001 | Facilities | Yes |
| RC-1031-RD-001-00 | Ground Floor - Main Building | Floor | 1031 | RD-001 | Facilities | Yes |
| RC-1031-RD-001-00-054 | Meeting Room 054 | Room | 1031 | RD-001 | Civil | Yes |
| RC-1031-RD-001-00-055 | Mechanical Service Room 055 | Room | 1031 | RD-001 | Mechanics | Yes |
| RC-1031-RD-001-00-056 | Electrical Panel Room 056 | Room | 1031 | RD-001 | Electrical | Yes |
| RC-1031-RD-01-00-ES01 | East Service Zone 01 | Zone | 1031 | RD-001 | Mechanics | **No** |
| RC-1034-AS-008 | Al Safa Building 008 | Building | 1034 | AS-008 | Facilities | Yes |
| RC-1034-AS-008-04-190 | Fourth Floor Office 190 | Room | 1034 | AS-008 | Mechanics | Yes |
| KG-L00-19 | King Gate Hallway 19 | Zone | 1031 | KG | Housekeeping | **No** |
| RC-1031-OLD-PLANT | Old External Plant Area | External | 1031 | OLD | Facilities | **No** |
| RC-1031-RD-001-00-090 | Diwan Main Store | Store | 1031 | RD-001 | Facilities | Yes |
| RC-1031-RD-001-00-091 | HVAC Store | Store | 1031 | RD-001 | Mechanics | Yes |
| RC-1031-RD-001-00-092 | Electrical Store | Store | 1031 | RD-001 | Electrical | Yes |
| RC-1031-RD-001-00-093 | Civil Store | Store | 1031 | RD-001 | Civil | Yes |

<!-- /generated -->

---

## 2.3 Asset coding

```
FCU  -  100  -  0001
│       │       │
│       │       └── Sequence   4 digits, per type + series
│       └────────── Series     3 digits, equipment family / capacity band
└────────────────── Type       2–4 letters
```

**Child assets carry their parent's whole code and add one segment.** A grille belonging to a fan coil unit
is:

```
FCU-100-0001-RGS-500-0009
└──────────┘ └──────────┘
   parent      child
```

This makes the component hierarchy self-describing: an asset is a child of any asset whose code is a prefix of
its own, exactly as with locations. Sequence numbering restarts within each parent, so the grille above is the
ninth `RGS-500` under that specific fan coil unit, not the ninth in the project.

### Approved type codes

<!-- generated:asset-types -->

| Type code | Equipment type | Example code |
| --- | --- | --- |
| SSU | Split Unit | SSU-100-0001 |
| WWU | Window / Wall Unit | WWU-100-0001 |
| FCU | Fan Coil Unit | FCU-100-0001 |
| RGS | Register / Grille | RGS-100-0001 |
| AHU | Air Handling Unit | AHU-100-0001 |
| PKU | Package Unit | PKU-100-0001 |
| FDA | Fire Damper | FDA-100-0001 |
| PMP | Pump | PMP-100-0001 |
| DBD | Distribution Board | DBD-100-0001 |
| LGT | Lighting Fixture | LGT-100-0001 |

<!-- /generated -->

New type codes are added to the coding definition rather than invented in the field. A code must be 2–4
letters and must not collide with an existing type.

### Asset register

<!-- generated:asset-register -->

| Asset number | Description | Type | Parent | Location | Site | Status |
| --- | --- | --- | --- | --- | --- | --- |
| SSU-100-0001 | SPLIT UNIT | Split Unit | — | RC-1031-RD-001-00-054 | 1031 | OPERATING |
| WWU-100-0001 | WINDOW UNIT | Window / Wall Unit | — | RC-1031-RD-001-00-055 | 1031 | OPERATING |
| SSU-200-0001 | SPLIT UNIT | Split Unit | — | RC-1031-RD-001-00-056 | 1031 | OPERATING |
| FCU-100-0001 | FAN COIL UNIT | Fan Coil Unit | — |  | 1034 | OPERATING |
| FCU-100-0001-RGS-500-0009 | FAN COIL UNIT | Fan Coil Unit | FCU-100-0001 | RC-1034-AS-008-04-190 | 1034 | OPERATING |

<!-- /generated -->

---

## 2.4 Conformance audit

The system validates codes on entry, but records that pre-date the structure — imported or migrated — are
not retrospectively corrected. This is the current state:

<!-- generated:code-conformance -->

| Record set | Rows | Conforming | Non-conforming |
| --- | --- | --- | --- |
| Locations | 14 | 11 | 3 |
| Assets | 5 | 5 | 0 |

The 3 non-conforming location codes and why each fails:

| Code | Problem | Suggested correction |
| --- | --- | --- |
| `RC-1031-RD-01-00-ES01` | does not match {PROJECT}-{SITE}-{BUILDING}-{FLOOR}-{ROOM}; code says building `RD-01` but the record's building field says `RD-001` | Re-issue under the approved pattern and migrate references |
| `KG-L00-19` | does not match {PROJECT}-{SITE}-{BUILDING}-{FLOOR}-{ROOM}; code says building `19-undefined` but the record's building field says `KG` | Legacy free-text code - re-issue under the project structure |
| `RC-1031-OLD-PLANT` | does not match {PROJECT}-{SITE}-{BUILDING}-{FLOOR}-{ROOM}; code says building `OLD-PLANT` but the record's building field says `OLD` | Re-issue under the approved pattern and migrate references |

<!-- /generated -->

**Recommendation.** The non-conforming codes should be re-issued before go-live rather than after. Once work
orders, PM schedules and meter readings accumulate against a code, changing it means migrating every
reference; the cost of the correction rises with every month it is deferred. None of these codes were
auto-corrected by the system, because silently renaming a location that a technician knows by its label is
more dangerous than reporting it.

---

## 2.5 Departmental structure

Locations and assets both carry a department, which drives work order routing and the systems available on an
asset record.

<!-- generated:department-structure -->

| Code | Department | Sub departments | Systems | Work groups |
| --- | --- | --- | --- | --- |
| MECH | Mechanics | HVAC (4-1-1), Plumbing (4-1-2), Mechanical Systems (4-1-3) | 6 | 3 |
| ELEC | Electrical | Low Voltage (4-2-1), Power Distribution (4-2-2), Lighting (4-2-3) | 5 | 3 |
| CIVIL | Civil | Building Fabric (4-3-1), Carpentry (4-3-2), Painting (4-3-3) | 4 | 3 |
| LAND | Landscape | Irrigation (4-4-1), Softscape (4-4-2) | 3 | 2 |
| CLEAN | Cleaning | Internal Cleaning (4-5-1), External Cleaning (4-5-2) | 3 | 1 |

<!-- /generated -->

---

## 2.6 Adopting this structure on another project

1. Copy the coding definition and change the project prefix.
2. Confirm the segment widths suit the new estate — site, building, floor and room widths are all
   configurable, and a project with more than 999 rooms per floor needs a wider room segment.
3. Agree the type code list with the maintenance team **before** any asset survey begins. Re-tagging is the
   expensive part of getting this wrong; see Document 6.
4. Load locations top-down — buildings, then floors, then rooms — so each level exists before its children
   reference it.

---

*Generated tables in this document come from `docs/generate.mjs`. Regenerate with `node docs/generate.mjs`.*

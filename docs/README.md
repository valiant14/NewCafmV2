# SEDER CAFM — DAB Section A documentation

The six documents DAB requested in Section A of their review. They are written for the client and their
consultant, not for developers.

| # | Document | DAB item |
|---|---|---|
| 1 | [Work Order Process](01-work-order-process.md) | A.1 — WO process for all WO types |
| 2 | [Location & Asset Structure Coding](02-location-asset-coding.md) | A.2 — proposed coding per project |
| 3 | [User Access Levels & Security Access](03-user-access-security.md) | A.3 — access levels per project |
| 4 | [Priorities and Response Times](04-priorities-and-sla.md) | A.4 — priorities and contractual SLA |
| 5 | [Failure Codes and PCR](05-failure-codes-pcr.md) | A.5 — failure codes with PCR framework |
| 6 | [Asset Tagging Plan](06-asset-tagging-plan.md) | A.6 — proposed tagging plan |

## Two documents need input SEDER has not yet supplied

Read these before issuing anything to DAB:

- **Document 4** — no response-time or resolution-time values exist anywhere in the system. Section 4.5 is a
  drafted proposal and is labelled as one. **Every value in it must be replaced with the figures from the
  signed contract** before it is issued or configured.
- **Document 5** — the failure library holds 2,549 rows with a class and a problem code, and **zero** cause
  and remedy codes. The document delivers the framework and worked examples; the library content itself has
  to be authored by SEDER's maintenance engineering team.

Nothing in either document presents invented content as existing SEDER data, and `check.mjs` enforces that.

## Working on these files

### Regenerating the data tables

Tables that come from application data live between markers:

```md
<!-- generated:asset-types -->
...emitted by generate.mjs — do not edit by hand...
<!-- /generated -->
```

Everything outside the markers is hand-written and is never touched by the generator.

```bash
node docs/generate.mjs      # refresh every generated table
```

Run it after changing anything in `src/data/`, or after the failure library, asset register or coding
structure is updated. The generator reads the app's own modules where it can — the work order transition
table is produced by calling `workOrderTransitions` from `src/lib/statusMatrix.js`, so it cannot disagree with
the shipped rules.

### Checking the documents are still true

```bash
node docs/check.mjs         # 51 checks; exits non-zero on drift
```

`check.mjs` re-derives every quoted figure from source **independently of the generator** and asserts it
appears in the markdown. It also verifies things the generator cannot:

- every edge in the work order state diagram is a transition the engine actually permits, **and** every
  permitted transition appears in the diagram;
- the enforcement caveat in Document 3 is present;
- the proposal markers in Documents 4 and 5 are present, and no invented cause/remedy value is presented as
  library content.

Run it before issuing the documents. A failure means a number has drifted from the system.

### Converting for the client

The files are CommonMark with GitHub-flavoured tables and two Mermaid diagrams. To produce Word or PDF:

```bash
pandoc 01-work-order-process.md -o 01-work-order-process.docx
```

Mermaid blocks need a renderer (`mermaid-filter`, or paste into a Mermaid live editor and insert the image)
— they are in Documents 1 and 6.

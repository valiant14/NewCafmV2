# 4. Priorities and Response Times

**SEDER CAFM · Document 4 of 6 · prepared in response to DAB review Section A.4**

Scope: the priority scales in use, how service levels are measured today, and a **proposed** response and
resolution matrix for SEDER to confirm against the contract.

---

## 4.1 Status of this document

> **The response and resolution times in section 4.5 are a proposal, not a record of contractual terms.**
>
> No response-time or resolution-time values exist anywhere in the CAFM system or its data. They could not
> be extracted, because they are not there. Section 4.5 is drafted from common facilities-management practice
> so that DAB and SEDER have a concrete matrix to react to, and **every value in it must be replaced with the
> figures in the signed contract before it is issued or configured.**
>
> Sections 4.2 to 4.4 are different — they describe what the system actually holds and do not contain
> proposed values.

---

## 4.2 Work order priority

Four priorities are available when a work order or job request is raised:

| Priority | Label |
|---|---|
| 1 | Emergency |
| 2 | High |
| 3 | Medium |
| 4 | Low |

This is the priority a requester or planner sets on the job itself. It currently **drives no automatic
behaviour** — it is recorded and reported, but does not set target dates or trigger escalation. Changing that
is the central recommendation of this document.

---

## 4.3 Location criticality

Locations carry their own priority, describing how critical the space is irrespective of any particular job.
A lighting fault in a Royal area is not the same job as the identical fault in a plant room.

<!-- generated:location-priorities -->

| Priority | Description in use | Locations |
| --- | --- | --- |
| 1 | Royal | 2 |
| 2 | Critical Services | 6 |
| 2 | VIP | 3 |
| 3 | Standard | 3 |

<!-- /generated -->

<!-- generated:priority-collisions -->

> **Data defect.** Priority `2` is currently used with 2 different
> descriptions — **Critical Services** and **VIP** — so the scale is ambiguous and cannot
> be reported against until SEDER decides which label is correct.

<!-- /generated -->

**Recommendation.** Decide whether priority 2 means *VIP* or *Critical Services* and split the other onto its
own level. A four-level location scale — Royal, VIP, Critical Services, Standard — would map cleanly onto the
four work order priorities and remove the ambiguity.

---

## 4.4 Asset priority, and how SLA is measured today

Assets carry a priority of their own, used to break ties when several jobs compete for the same technician:

<!-- generated:asset-priorities -->

| Priority | Assets |
| --- | --- |
| 1 | 2 |
| 3 | 3 |

<!-- /generated -->

### How service level is actually calculated

A work order is counted as an **SLA violation** when its Target Finish date has passed and the work order is
not yet Completed, Closed or Cancelled. Site-level and overall SLA compliance on the dashboard are the
proportion of work orders not in that state.

**The limitation this creates.** Target Start and Target Finish are typed in by hand. They are mandatory —
a work order cannot be approved without them — but nothing checks that the date entered reflects the job's
priority. A P1 Emergency given a target finish three weeks out will report as compliant for three weeks.

So the measurement is sound, and the input to it is not governed. That is the gap this document exists to
close.

---

## 4.5 Proposed response and resolution matrix

> **Proposed values — to be confirmed against the contractual SLA schedule before use.**

**Response** is the time from the job being raised to a technician attending and assessing.
**Resolution** is the time from the job being raised to the work being complete or a permanent workaround
being in place. Both are measured in elapsed time, not working hours, for P1 and P2.

| Priority | Definition | Response | Resolution | Coverage |
|---|---|---|---|---|
| **P1 — Emergency** | Risk to life, safety or security; total loss of an essential service; any fault in a Royal area | 30 minutes | 4 hours | 24 / 7 |
| **P2 — High** | Major loss of function affecting many occupants; failure of a critical service with no redundancy; any fault in a VIP area | 2 hours | 24 hours | 24 / 7 |
| **P3 — Medium** | Partial loss of function with a workaround available; single-occupant impact | 8 working hours | 3 working days | Working hours |
| **P4 — Low** | Cosmetic, minor, or deferrable without operational impact | 2 working days | 10 working days | Working hours |

### Proposed escalation by location criticality

The location's criticality raises the job's priority rather than replacing it, so a Standard-priority fault in
a Royal area is still treated urgently:

| Location criticality | Effect on work order priority |
|---|---|
| Royal | Raise to P1 |
| VIP | Raise by one level, minimum P2 |
| Critical Services | Raise by one level |
| Standard | No change |

### Proposed PM compliance targets

PM is measured differently — a PM job is compliant when it is completed within its scheduled window rather
than against a response clock:

| Measure | Proposed target |
|---|---|
| PM completed within the scheduled window | 95% |
| PM completed within the window + 7 days | 100% |
| Statutory / safety-critical PM completed in window | 100%, no tolerance |

---

## 4.6 Recommendations

1. **Confirm the contractual figures** and replace section 4.5 in full. Nothing else in this document should
   be actioned before that.
2. **Derive target dates from priority.** Once the figures are agreed, Target Start and Target Finish should
   be calculated when a work order is raised, from priority plus location criticality, and only overridable
   with a reason. This converts SLA reporting from a measure of data entry into a measure of performance.
3. **Resolve the priority 2 collision** described in 4.3 before configuring any escalation rule that depends
   on it.
4. **Report response separately from resolution.** The system currently measures resolution only; response
   time needs the first-attendance timestamp to be captured, which is a small addition to the actuals tab.
5. **Agree the working-hours calendar** — a resolution target in working days is not calculable without the
   site's working week, public holidays and shift pattern.

---

*Generated tables in this document come from `docs/generate.mjs`. Regenerate with `node docs/generate.mjs`.
Section 4.5 is hand-written and is not generated from system data — no such data exists.*

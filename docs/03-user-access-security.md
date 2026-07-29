# 3. User Access Levels & Security Access

**SEDER CAFM · Document 3 of 6 · prepared in response to DAB review Section A.3**

Scope: the role model, the permission matrix, how access is scoped by project/site and department, and an
honest statement of what the current implementation does and does not enforce.

---

## 3.1 Important — the current enforcement boundary

> **Access control in SEDER CAFM is presently applied in the user interface only.**
>
> The application runs entirely in the browser with no server component. Role and scope determine what a user
> is *shown* — which navigation items appear, which buttons are enabled, and how list filters are defaulted —
> but there is no server to reject a request that bypasses the interface.
>
> **This is adequate for controlling day-to-day use and preventing mistakes. It is not a security boundary
> against a determined user.** Enforcing these rules properly requires the permission model below to be
> re-checked server-side when the application is given a backend.

This is stated first because a security document that overstates its guarantees is more dangerous than no
document at all. The model that follows is correct and complete; the enforcement point is what is
outstanding.

---

## 3.2 The access model

Access is decided by three independent dimensions. A user must pass all three:

| Dimension | Question it answers | Held on |
|---|---|---|
| **Role** | What may this person do? | The user's assigned role |
| **Site scope** | Which project/site may they do it on? | The user record |
| **Department scope** | Whose work may they see? | The user record |

**Role** grants an action on a module. **Site scope** restricts every module to one project or site, or to
`All Sites` for corporate roles. **Department scope** restricts to a single department, or `All Departments`.

Site scope is what DAB's "different projects" requirement maps onto: each project is a site, and a user
attached to one site sees that project's work by default across every list in the system.

---

## 3.3 Modules and actions

Permissions are expressed as **action × module**. The modules under control:

Job Requests · Work Orders · PM · Assets · Inventory · Incidents · Reports

The actions:

| Action | Meaning |
|---|---|
| `view` | See records in the module |
| `create` | Raise a new record |
| `edit` | Change an existing record |
| `approve` | Move a record through an approval status |
| `close` | Close a record — terminal, cannot be undone |
| `import` | Bulk-load records from a spreadsheet |

`approve` and `close` are separated deliberately. Approving releases work; closing finalises the cost and
failure history against the asset. In most FM organisations these are different people, and the model must
allow that.

---

## 3.4 Permission matrix

<!-- generated:permission-matrix -->

| Role | Scope | Status | View | Create | Edit | Approve | Close | Import |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Facility Manager | All Sites / All Departments | Active | All | All | All | All | All | All |
| HVAC Supervisor | Riyadh / 1031 / HVAC | Active | Work Orders, PM, Assets, Inventory, Reports | Work Orders, PM | Work Orders, PM | Work Orders | Work Orders | PM |
| Civil Technician | Riyadh / 1031 / Civil | Draft | Work Orders, Assets | — | Work Orders | — | — | — |

<!-- /generated -->

Reading the matrix: **All** means every module listed in 3.3; **—** means the role holds that action on no
module; otherwise the specific modules are named.

### The three roles in words

**Facility Manager** — full access across every module and every site. Holds `approve`, `close` and `import`
on everything. This is the only role that can close work orders across departments, and it should be held by
as few people as the operation allows.

**HVAC Supervisor** — a departmental role, scoped to one site and one department. Can create, edit, approve
and close work orders and manage PM schedules for their department. Can view assets, inventory and reports
but cannot change them. Can import PM schedules only — bulk-loading work orders is reserved to the manager.

**Civil Technician** — a delivery role. Can view work orders and assets, and edit work orders to enter
actuals. Holds no `create`, `approve`, `close` or `import` rights at all. A technician records what happened;
they do not decide that it is finished.

> **Note the two status columns.** The Civil Technician *role* is still `Draft` in the permission matrix,
> while the *user* holding it is `Inactive` in the register below. These are separate states: a draft role has
> not been ratified for use, and an inactive account cannot sign in. Both should be confirmed before go-live —
> a draft role means the technician permission set has not yet been formally agreed.

---

## 3.5 User register

<!-- generated:user-register -->

| User | Name | Role | Site scope | Department scope | Status |
| --- | --- | --- | --- | --- | --- |
| demo | Ahmed Faisal | Facility Manager | All Sites | All Departments | Active |
| omar.harbi | Omar Al Harbi | HVAC Supervisor | Riyadh / 1031 | HVAC | Active |
| fahad.qahtani | Fahad Al Qahtani | HVAC Supervisor | Riyadh / 1031 | HVAC | Active |
| saad.shammari | Saad Al Shammari | Civil Technician | Riyadh / 1031 | Civil | Inactive |

<!-- /generated -->

`Inactive` users retain their record and history but cannot sign in. Accounts are deactivated rather than
deleted so that work orders continue to name the person who performed them.

---

## 3.6 Craft assignment

Labour is assigned to work orders by craft, and crafts are owned by departments. This is a second, softer
control: a supervisor planning a job sees the crafts belonging to their department.

<!-- generated:craft-register -->

| Craft code | Craft | Department | Sub department |
| --- | --- | --- | --- |
| HVAC-TECH | HVAC Technician | Mechanics | HVAC |
| HVAC-SR | Senior HVAC Technician | Mechanics | HVAC |
| PLMB-TECH | Plumbing Technician | Mechanics | Plumbing |
| MECH-TECH | Mechanical Technician | Mechanics | Mechanical Systems |
| ELEC-TECH | Electrical Technician | Electrical | Power Distribution |
| ELV-TECH | Low Voltage Technician | Electrical | Low Voltage |
| CIVIL-TECH | Civil Technician | Civil | Building Fabric |
| PAINT-TECH | Painter | Civil | Painting |
| CARP-TECH | Carpenter | Civil | Carpentry |
| IRRIG-TECH | Irrigation Technician | Landscape | Irrigation |
| LAND-OP | Landscape Operative | Landscape | Softscape |
| CLEAN-OP | Cleaning Operative | Cleaning | Internal Cleaning |

<!-- /generated -->

---

## 3.7 Recommended additions

In priority order, for SEDER to consider alongside DAB:

1. **Server-side enforcement of this matrix**, as set out in 3.1. Everything else is secondary to it.
2. **An audit trail of status changes** — who moved a work order to CLOSE and when. The lifecycle is
   controlled but not currently attributed.
3. **Segregation of `approve` from `create` on high-value purchase requisitions**, so the person raising a
   requisition cannot approve it.
4. **Periodic access review** — a scheduled re-confirmation that each active account still needs its role,
   which is normally a contractual requirement for facilities operating in secure environments.

---

*Generated tables in this document come from `docs/generate.mjs`. Regenerate with `node docs/generate.mjs`.*

# backendCafm

Node/Express API scaffold for the CAFM frontend, backed by Microsoft SQL Server.

## Setup

```bash
cd backendCafm
npm install
copy .env.example .env
npm run db:check
npm run db:setup
npm run dev
```

`db:setup` applies the base schema, core permissions, every idempotent production
migration, performance indexes, and the administrator account. Sample and test-data
scripts remain opt-in and are never run by setup.

For an existing database, apply all production migrations with:

```bash
npm run db:migrate
```

API base URL:

```text
http://localhost:4000/api
```

## MSSQL

Run the schema and seed files against your SQL Server database:

```bash
sqlcmd -S localhost -d CafmV3 -U sa -P "yourStrong(!)Password" -i sql/001_schema.sql
sqlcmd -S localhost -d CafmV3 -U sa -P "yourStrong(!)Password" -i sql/002_seed_core.sql
```

Then create the first login:

```bash
npm run db:create-admin
```

Apply the idempotent high-volume indexes after the schema migrations:

```bash
npm run db:optimize
```

Apply and verify transaction ownership and user data isolation on an existing database:

```bash
npm run db:secure-scope
npm run db:check-scopes
npm run api:check-scopes
```

Apply the global work-order workflow controls on an existing database:

```bash
npm run db:workflow-controls
npm run db:workflow-designer
npm run api:check-workflow
npm run api:check-transitions
npm run api:check-numbers
```

`api:check-numbers` verifies concurrent MSSQL-issued PR references plus PO,
allocation, and incident references, then removes its temporary records.
`api:check-transitions` verifies work-order routing-field persistence and that edit access alone cannot close a Work Order;
its temporary role, user, and Work Order are removed after every run.

Default development login:

```text
username: admin
password: admin123
```

Change it with `ADMIN_USERNAME` and `ADMIN_PASSWORD` environment variables before running the script.

## Included Modules

- Sites
- Departments / sub-departments
- Users, roles, role permissions, multi-site access, multi-department access
- Assets, locations, labor
- Service requests
- Work orders
- Database-backed dynamic work-order stages, transitions, automation, and gate controls
- Work order resource requests
- Materials, stores, stock
- Purchase requisitions
- Purchase orders
- Inventory reservations
- PM schedules, job plans, job plan tasks
- Incidents and meter readings
- Audit log

## Backend Access Contract

The frontend already exposes an `accessContextForUser()` shape. Backend enforcement should use the JWT user plus:

- allowed modules/actions from `role_permissions`
- allowed sites from `user_site_access`
- allowed departments/sub-departments from `user_department_access`

Frontend route hiding is not security. The API enforces the same scope on lists, direct `/:id` reads, creates, edits, and deletes.

Each user has a data-view override with four operational modes:

- `ROLE`: use the role default
- `DEPARTMENT`: own transactions plus assigned departments, inside assigned sites
- `OWN`: only transactions owned by the user inside the assigned sites and departments
- `GLOBAL`: explicit per-user administrator access

Scoped users with no site or department assignment are denied scoped data. Transaction owners are assigned by the API and inherited through linked service request, work order, PR, PO, reservation, and meter records; clients cannot spoof the owner field.

When a new user is linked to an active labor master, missing scope values default from that labor record. Supply-chain manager accounts without assignments are limited to sites containing active warehouses and active department masters.

Migration `041_scope_and_legacy_ownership_cleanup.sql` repairs malformed legacy scope rows and propagates ownership through reporters, source requests, PM records, linked labor, work orders, requisitions, purchase orders, and reservations. Records whose human creator cannot be reconstructed are assigned to the inactive `USR-LEGACY` audit custodian; this does not bypass normal site or department filtering.

## Performance Operations

High-volume list endpoints support server pagination while preserving the existing array response:

```text
GET /api/work-orders?limit=100&offset=0&includeTotal=true
GET /api/work-orders?limit=100&page=2&status=INPRG&site_code=SITE-CODE
GET /api/work-orders?limit=100&updatedAfter=2026-08-01T00:00:00Z
```

Pagination metadata is returned through `X-Page-Size`, `X-Page-Offset`, and `X-Total-Count` headers. `LIST_MAX_PAGE_SIZE` caps individual response memory without changing legacy unpaged calls.

Health and runtime metrics:

```text
GET /api/health
GET /api/health?deep=1
```

The health response reports bounded permission-cache size, MSSQL pool use, connected Socket.IO clients, scheduler state, memory use, request latency, and event-loop delay. Use `deep=1` for readiness checks that must confirm a live MSSQL query.

Recommended production settings are documented in `.env.example`. Size `MSSQL_POOL_MAX` below the SQL Server connection limit across all API instances, and keep `PM_SCHEDULER_CONCURRENCY` lower than the pool maximum.

## Transaction Commands

Purchase requisitions, purchase orders, reservations, receipts, stock posting, and
work-order cancellation are written through `/api/supply-chain/*`. Their generic
resource routes are read-only so a client cannot partially update one table and
leave the linked supply-chain records inconsistent. Each command uses a serializable
MSSQL transaction and returns the committed rows needed to update the UI directly.

## Attachments

Run `npm run db:migrate` to create `dbo.attachments` and migrate legacy work-order
data URLs out of MSSQL. File bytes are stored outside the database and are available
only through authenticated upload/download endpoints; MSSQL retains metadata and
entity links.

Configure the storage volume with:

```text
ATTACHMENT_STORAGE_PATH=storage/attachments
ATTACHMENT_MAX_BYTES=26214400
```

For a multi-instance deployment, point `ATTACHMENT_STORAGE_PATH` at a durable shared
volume. Back up that volume together with MSSQL so attachment metadata and file bytes
remain synchronized.

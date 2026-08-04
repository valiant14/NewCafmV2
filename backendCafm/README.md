# backendCafm

Node/Express API scaffold for the CAFM frontend, backed by Microsoft SQL Server.

## Setup

```bash
cd backendCafm
npm install
copy .env.example .env
npm run db:check
npm run db:create-admin
npm run dev
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

Frontend route hiding is not security. SQL/API queries must apply the same scope before returning rows.

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

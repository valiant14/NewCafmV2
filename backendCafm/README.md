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

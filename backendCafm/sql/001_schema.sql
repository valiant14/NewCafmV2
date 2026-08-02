/*
  CAFM V3 MSSQL schema
  Run inside the target database, for example:
    sqlcmd -S localhost -d CafmV3 -U sa -P "yourStrong(!)Password" -i backendCafm/sql/001_schema.sql
*/

set ansi_nulls on;
set quoted_identifier on;
go

if schema_id('dbo') is null exec('create schema dbo');
go

create table dbo.sites (
  site_code nvarchar(30) not null primary key,
  site_name nvarchar(160) not null,
  region nvarchar(120) null,
  city nvarchar(120) null,
  status nvarchar(30) not null constraint df_sites_status default 'Active',
  created_at datetime2 not null constraint df_sites_created default sysutcdatetime(),
  updated_at datetime2 not null constraint df_sites_updated default sysutcdatetime()
);
go

create table dbo.departments (
  sub_department_code nvarchar(50) not null primary key,
  department_name nvarchar(160) not null,
  description nvarchar(300) not null,
  normalized_department as lower(replace(replace(replace(department_name, ' ', ''), '-', ''), '_', '')) persisted,
  status nvarchar(30) not null constraint df_departments_status default 'Active',
  created_at datetime2 not null constraint df_departments_created default sysutcdatetime(),
  updated_at datetime2 not null constraint df_departments_updated default sysutcdatetime()
);
go

create index ix_departments_department on dbo.departments(department_name);
go

create table dbo.roles (
  role_id int identity(1,1) not null primary key,
  role_code nvarchar(80) not null unique,
  role_name nvarchar(160) not null unique,
  scope_description nvarchar(300) null,
  status nvarchar(30) not null constraint df_roles_status default 'Active',
  created_at datetime2 not null constraint df_roles_created default sysutcdatetime(),
  updated_at datetime2 not null constraint df_roles_updated default sysutcdatetime()
);
go

create table dbo.permission_modules (
  module_name nvarchar(120) not null primary key
);
go

create table dbo.permission_actions (
  action_name nvarchar(40) not null primary key
);
go

create table dbo.role_permissions (
  role_id int not null,
  module_name nvarchar(120) not null,
  action_name nvarchar(40) not null,
  allowed bit not null constraint df_role_permissions_allowed default 0,
  constraint pk_role_permissions primary key (role_id, module_name, action_name),
  constraint fk_role_permissions_role foreign key (role_id) references dbo.roles(role_id) on delete cascade,
  constraint fk_role_permissions_module foreign key (module_name) references dbo.permission_modules(module_name),
  constraint fk_role_permissions_action foreign key (action_name) references dbo.permission_actions(action_name)
);
go

create table dbo.labor (
  labor_id nvarchar(50) not null primary key,
  display_name nvarchar(180) not null,
  craft_code nvarchar(80) null,
  craft_name nvarchar(160) null,
  department_name nvarchar(160) null,
  sub_department_code nvarchar(50) null,
  site_code nvarchar(30) null,
  availability nvarchar(40) null,
  status nvarchar(30) not null constraint df_labor_status default 'Active',
  created_at datetime2 not null constraint df_labor_created default sysutcdatetime(),
  updated_at datetime2 not null constraint df_labor_updated default sysutcdatetime(),
  constraint fk_labor_site foreign key (site_code) references dbo.sites(site_code)
);
go

create table dbo.users (
  user_id nvarchar(50) not null primary key,
  username nvarchar(80) not null unique,
  password_hash nvarchar(255) not null,
  display_name nvarchar(180) not null,
  email nvarchar(180) null,
  role_id int not null,
  labor_id nvarchar(50) null,
  status nvarchar(30) not null constraint df_users_status default 'Active',
  last_login_at datetime2 null,
  created_at datetime2 not null constraint df_users_created default sysutcdatetime(),
  updated_at datetime2 not null constraint df_users_updated default sysutcdatetime(),
  constraint fk_users_role foreign key (role_id) references dbo.roles(role_id),
  constraint fk_users_labor foreign key (labor_id) references dbo.labor(labor_id)
);
go

create table dbo.user_site_access (
  user_id nvarchar(50) not null,
  site_code nvarchar(30) not null,
  constraint pk_user_site_access primary key (user_id, site_code),
  constraint fk_user_site_access_user foreign key (user_id) references dbo.users(user_id) on delete cascade,
  constraint fk_user_site_access_site foreign key (site_code) references dbo.sites(site_code)
);
go

create table dbo.user_department_access (
  access_id bigint identity(1,1) not null primary key,
  user_id nvarchar(50) not null,
  department_name nvarchar(160) not null,
  sub_department_code nvarchar(50) null,
  constraint uq_user_department_access unique (user_id, department_name, sub_department_code),
  constraint fk_user_department_access_user foreign key (user_id) references dbo.users(user_id) on delete cascade,
  constraint fk_user_department_access_sub foreign key (sub_department_code) references dbo.departments(sub_department_code)
);
go

create table dbo.locations (
  location_code nvarchar(80) not null primary key,
  description nvarchar(300) null,
  location_type nvarchar(80) null,
  status nvarchar(40) null,
  priority int null,
  priority_description nvarchar(160) null,
  site_code nvarchar(30) not null,
  building nvarchar(120) null,
  building_category nvarchar(120) null,
  department_name nvarchar(160) null,
  created_at datetime2 not null constraint df_locations_created default sysutcdatetime(),
  updated_at datetime2 not null constraint df_locations_updated default sysutcdatetime(),
  constraint fk_locations_site foreign key (site_code) references dbo.sites(site_code)
);
go

create table dbo.assets (
  asset_num nvarchar(80) not null primary key,
  description nvarchar(300) null,
  location_code nvarchar(80) null,
  parent_asset_num nvarchar(80) null,
  department_name nvarchar(160) null,
  sub_department_code nvarchar(50) null,
  priority int null,
  site_code nvarchar(30) not null,
  status nvarchar(40) not null constraint df_assets_status default 'OPERATING',
  model_num nvarchar(120) null,
  serial_num nvarchar(120) null,
  install_date date null,
  quantity decimal(18,4) not null constraint df_assets_quantity default 1,
  created_at datetime2 not null constraint df_assets_created default sysutcdatetime(),
  updated_at datetime2 not null constraint df_assets_updated default sysutcdatetime(),
  constraint fk_assets_site foreign key (site_code) references dbo.sites(site_code),
  constraint fk_assets_location foreign key (location_code) references dbo.locations(location_code),
  constraint fk_assets_parent foreign key (parent_asset_num) references dbo.assets(asset_num),
  constraint fk_assets_sub_department foreign key (sub_department_code) references dbo.departments(sub_department_code)
);
go

create table dbo.materials (
  item_code nvarchar(80) not null primary key,
  description nvarchar(300) not null,
  category nvarchar(120) null,
  unit_of_measure nvarchar(40) null,
  status nvarchar(40) not null constraint df_materials_status default 'Active',
  created_at datetime2 not null constraint df_materials_created default sysutcdatetime(),
  updated_at datetime2 not null constraint df_materials_updated default sysutcdatetime()
);
go

create table dbo.tools_equipment (
  tool_code nvarchar(80) not null primary key,
  description nvarchar(300) not null,
  category nvarchar(120) null,
  status nvarchar(40) not null constraint df_tools_status default 'Available',
  created_at datetime2 not null constraint df_tools_created default sysutcdatetime(),
  updated_at datetime2 not null constraint df_tools_updated default sysutcdatetime()
);
go

create table dbo.failure_library (
  failure_library_id bigint identity(1,1) not null primary key,
  failure_class_id nvarchar(80) not null,
  description nvarchar(500) not null,
  problem_code nvarchar(80) null,
  problem_description nvarchar(500) null,
  cause_code nvarchar(80) null,
  cause_description nvarchar(500) null,
  remedy_code nvarchar(80) null,
  remedy_description nvarchar(500) null,
  created_at datetime2 not null constraint df_failure_library_created default sysutcdatetime(),
  updated_at datetime2 not null constraint df_failure_library_updated default sysutcdatetime(),
  constraint uq_failure_library_codes unique (failure_class_id, problem_code, cause_code, remedy_code)
);
go

create table dbo.storerooms (
  store_code nvarchar(80) not null primary key,
  store_name nvarchar(180) not null,
  site_code nvarchar(30) not null,
  status nvarchar(40) not null constraint df_stores_status default 'Active',
  created_at datetime2 not null constraint df_stores_created default sysutcdatetime(),
  updated_at datetime2 not null constraint df_stores_updated default sysutcdatetime(),
  constraint fk_storerooms_site foreign key (site_code) references dbo.sites(site_code)
);
go

create table dbo.inventory_stock (
  store_code nvarchar(80) not null,
  item_code nvarchar(80) not null,
  balance decimal(18,4) not null constraint df_inventory_stock_balance default 0,
  reserved_quantity decimal(18,4) not null constraint df_inventory_stock_reserved default 0,
  reorder_point decimal(18,4) null,
  updated_at datetime2 not null constraint df_inventory_stock_updated default sysutcdatetime(),
  constraint pk_inventory_stock primary key (store_code, item_code),
  constraint fk_inventory_stock_store foreign key (store_code) references dbo.storerooms(store_code),
  constraint fk_inventory_stock_material foreign key (item_code) references dbo.materials(item_code)
);
go

create table dbo.service_requests (
  sr_num nvarchar(80) not null primary key,
  description nvarchar(300) not null,
  long_description nvarchar(max) null,
  site_code nvarchar(30) not null,
  location_code nvarchar(80) null,
  asset_num nvarchar(80) null,
  department_name nvarchar(160) null,
  sub_department_code nvarchar(50) null,
  assigned_department_name nvarchar(160) null,
  reported_by nvarchar(160) null,
  reported_at datetime2 not null constraint df_sr_reported default sysutcdatetime(),
  priority nvarchar(40) null,
  request_type nvarchar(80) null,
  failure_code nvarchar(80) null,
  status nvarchar(40) not null constraint df_sr_status default 'NEW',
  converted_work_order_num nvarchar(80) null,
  created_at datetime2 not null constraint df_sr_created default sysutcdatetime(),
  updated_at datetime2 not null constraint df_sr_updated default sysutcdatetime(),
  constraint fk_sr_site foreign key (site_code) references dbo.sites(site_code),
  constraint fk_sr_location foreign key (location_code) references dbo.locations(location_code),
  constraint fk_sr_asset foreign key (asset_num) references dbo.assets(asset_num),
  constraint fk_sr_sub_department foreign key (sub_department_code) references dbo.departments(sub_department_code)
);
go

create table dbo.work_orders (
  work_order_num nvarchar(80) not null primary key,
  description nvarchar(300) not null,
  long_description nvarchar(max) null,
  location_code nvarchar(80) null,
  asset_num nvarchar(80) null,
  status nvarchar(40) not null constraint df_wo_status default 'WAPPR',
  work_type nvarchar(40) not null constraint df_wo_work_type default 'CM',
  priority int null,
  site_code nvarchar(30) not null,
  department_name nvarchar(160) null,
  sub_department_code nvarchar(50) null,
  assigned_department_name nvarchar(160) null,
  target_start_at datetime2 null,
  target_finish_at datetime2 null,
  actual_start_at datetime2 null,
  actual_finish_at datetime2 null,
  reported_at datetime2 not null constraint df_wo_reported default sysutcdatetime(),
  source_sr_num nvarchar(80) null,
  failure_code nvarchar(80) null,
  problem_code nvarchar(80) null,
  cause_code nvarchar(80) null,
  remedy_code nvarchar(80) null,
  created_at datetime2 not null constraint df_wo_created default sysutcdatetime(),
  updated_at datetime2 not null constraint df_wo_updated default sysutcdatetime(),
  constraint fk_wo_site foreign key (site_code) references dbo.sites(site_code),
  constraint fk_wo_location foreign key (location_code) references dbo.locations(location_code),
  constraint fk_wo_asset foreign key (asset_num) references dbo.assets(asset_num),
  constraint fk_wo_source_sr foreign key (source_sr_num) references dbo.service_requests(sr_num),
  constraint fk_wo_sub_department foreign key (sub_department_code) references dbo.departments(sub_department_code)
);
go

alter table dbo.service_requests add constraint fk_sr_converted_wo foreign key (converted_work_order_num) references dbo.work_orders(work_order_num);
go

create table dbo.work_order_resource_requests (
  resource_request_id bigint identity(1,1) not null primary key,
  work_order_num nvarchar(80) not null,
  resource_type nvarchar(40) not null,
  item_code nvarchar(80) null,
  item_description nvarchar(300) not null,
  requested_quantity decimal(18,4) not null,
  available_quantity decimal(18,4) not null constraint df_worr_available default 0,
  store_code nvarchar(80) null,
  site_code nvarchar(30) not null,
  department_name nvarchar(160) null,
  source_type nvarchar(80) null,
  availability_status nvarchar(80) null,
  request_status nvarchar(80) null,
  transaction_ref nvarchar(80) null,
  supply_chain_status nvarchar(160) null,
  created_at datetime2 not null constraint df_worr_created default sysutcdatetime(),
  updated_at datetime2 not null constraint df_worr_updated default sysutcdatetime(),
  constraint fk_worr_work_order foreign key (work_order_num) references dbo.work_orders(work_order_num) on delete cascade,
  constraint fk_worr_material foreign key (item_code) references dbo.materials(item_code),
  constraint fk_worr_store foreign key (store_code) references dbo.storerooms(store_code),
  constraint fk_worr_site foreign key (site_code) references dbo.sites(site_code)
);
go

create table dbo.purchase_requisitions (
  pr_num nvarchar(80) not null primary key,
  work_order_num nvarchar(80) null,
  resource_request_id bigint null,
  request_type nvarchar(40) not null,
  item_code nvarchar(80) null,
  item_description nvarchar(300) not null,
  requested_quantity decimal(18,4) not null,
  planned_quantity decimal(18,4) null,
  available_quantity decimal(18,4) null,
  store_code nvarchar(80) null,
  site_code nvarchar(30) not null,
  department_name nvarchar(160) null,
  status nvarchar(40) not null constraint df_pr_status default 'WAPPR',
  po_num nvarchar(80) null,
  created_at datetime2 not null constraint df_pr_created default sysutcdatetime(),
  approved_at datetime2 null,
  closed_at datetime2 null,
  cancelled_at datetime2 null,
  updated_at datetime2 not null constraint df_pr_updated default sysutcdatetime(),
  constraint fk_pr_wo foreign key (work_order_num) references dbo.work_orders(work_order_num),
  constraint fk_pr_resource foreign key (resource_request_id) references dbo.work_order_resource_requests(resource_request_id),
  constraint fk_pr_site foreign key (site_code) references dbo.sites(site_code),
  constraint fk_pr_store foreign key (store_code) references dbo.storerooms(store_code)
);
go

create table dbo.purchase_orders (
  po_num nvarchar(80) not null primary key,
  pr_num nvarchar(80) not null,
  work_order_num nvarchar(80) null,
  request_type nvarchar(40) not null,
  item_code nvarchar(80) null,
  item_description nvarchar(300) not null,
  ordered_quantity decimal(18,4) not null,
  store_code nvarchar(80) null,
  site_code nvarchar(30) not null,
  department_name nvarchar(160) null,
  status nvarchar(40) not null constraint df_po_status default 'WAPPR',
  created_at datetime2 not null constraint df_po_created default sysutcdatetime(),
  approved_at datetime2 null,
  received_at datetime2 null,
  closed_at datetime2 null,
  cancelled_at datetime2 null,
  updated_at datetime2 not null constraint df_po_updated default sysutcdatetime(),
  constraint fk_po_pr foreign key (pr_num) references dbo.purchase_requisitions(pr_num),
  constraint fk_po_wo foreign key (work_order_num) references dbo.work_orders(work_order_num),
  constraint fk_po_site foreign key (site_code) references dbo.sites(site_code),
  constraint fk_po_store foreign key (store_code) references dbo.storerooms(store_code)
);
go

alter table dbo.purchase_requisitions add constraint fk_pr_po foreign key (po_num) references dbo.purchase_orders(po_num);
go

create table dbo.inventory_reservations (
  reservation_num nvarchar(80) not null primary key,
  work_order_num nvarchar(80) not null,
  pr_num nvarchar(80) null,
  po_num nvarchar(80) null,
  item_code nvarchar(80) null,
  item_description nvarchar(300) not null,
  reserved_quantity decimal(18,4) not null,
  arranged_quantity decimal(18,4) not null constraint df_res_arranged default 0,
  released_quantity decimal(18,4) not null constraint df_res_released default 0,
  delivered_quantity decimal(18,4) not null constraint df_res_delivered default 0,
  store_code nvarchar(80) null,
  site_code nvarchar(30) not null,
  department_name nvarchar(160) null,
  status nvarchar(40) not null constraint df_res_status default 'ENTERED',
  created_at datetime2 not null constraint df_res_created default sysutcdatetime(),
  updated_at datetime2 not null constraint df_res_updated default sysutcdatetime(),
  constraint fk_res_wo foreign key (work_order_num) references dbo.work_orders(work_order_num),
  constraint fk_res_pr foreign key (pr_num) references dbo.purchase_requisitions(pr_num),
  constraint fk_res_po foreign key (po_num) references dbo.purchase_orders(po_num),
  constraint fk_res_site foreign key (site_code) references dbo.sites(site_code),
  constraint fk_res_store foreign key (store_code) references dbo.storerooms(store_code)
);
go

create table dbo.job_plans (
  job_plan_num nvarchar(80) not null primary key,
  description nvarchar(300) not null,
  status nvarchar(40) not null constraint df_jp_status default 'ACTIVE',
  created_at datetime2 not null constraint df_jp_created default sysutcdatetime(),
  updated_at datetime2 not null constraint df_jp_updated default sysutcdatetime()
);
go

create table dbo.job_plan_tasks (
  job_plan_task_id bigint identity(1,1) not null primary key,
  job_plan_num nvarchar(80) not null,
  task_sequence int not null,
  task_description nvarchar(600) not null,
  duration_hours decimal(18,6) null,
  constraint fk_jpt_job_plan foreign key (job_plan_num) references dbo.job_plans(job_plan_num) on delete cascade
);
go

create table dbo.preventive_maintenance (
  pm_num nvarchar(80) not null primary key,
  description nvarchar(300) not null,
  asset_num nvarchar(80) null,
  route_code nvarchar(80) null,
  location_code nvarchar(80) null,
  job_plan_num nvarchar(80) not null,
  next_date date not null,
  lead_time_days int not null constraint df_pm_lead default 0,
  frequency int not null,
  frequency_unit nvarchar(40) not null,
  pm_counter int not null constraint df_pm_counter default 0,
  work_type nvarchar(40) not null constraint df_pm_work_type default 'PM',
  wo_status nvarchar(40) not null constraint df_pm_wo_status default 'WSCH',
  store_code nvarchar(80) null,
  supervisor nvarchar(160) null,
  lead_person nvarchar(160) null,
  person_group nvarchar(120) null,
  site_code nvarchar(30) not null,
  department_name nvarchar(160) null,
  sub_department_code nvarchar(50) null,
  pm_status nvarchar(40) not null constraint df_pm_status default 'ACTIVE',
  last_generated_cycle nvarchar(120) null,
  created_at datetime2 not null constraint df_pm_created default sysutcdatetime(),
  updated_at datetime2 not null constraint df_pm_updated default sysutcdatetime(),
  constraint fk_pm_asset foreign key (asset_num) references dbo.assets(asset_num),
  constraint fk_pm_location foreign key (location_code) references dbo.locations(location_code),
  constraint fk_pm_job_plan foreign key (job_plan_num) references dbo.job_plans(job_plan_num),
  constraint fk_pm_site foreign key (site_code) references dbo.sites(site_code),
  constraint fk_pm_sub_department foreign key (sub_department_code) references dbo.departments(sub_department_code)
);
go

create table dbo.incidents (
  incident_num nvarchar(80) not null primary key,
  description nvarchar(300) not null,
  site_code nvarchar(30) not null,
  location_code nvarchar(80) null,
  asset_num nvarchar(80) null,
  department_name nvarchar(160) null,
  status nvarchar(40) not null constraint df_incidents_status default 'NEW',
  reported_at datetime2 not null constraint df_incidents_reported default sysutcdatetime(),
  created_at datetime2 not null constraint df_incidents_created default sysutcdatetime(),
  updated_at datetime2 not null constraint df_incidents_updated default sysutcdatetime(),
  constraint fk_incidents_site foreign key (site_code) references dbo.sites(site_code)
);
go

create table dbo.meter_readings (
  meter_reading_id bigint identity(1,1) not null primary key,
  meter_id nvarchar(80) not null,
  asset_num nvarchar(80) null,
  work_order_num nvarchar(80) null,
  site_code nvarchar(30) not null,
  department_name nvarchar(160) null,
  reading_value decimal(18,4) not null,
  reading_unit nvarchar(40) null,
  reading_at datetime2 not null,
  created_at datetime2 not null constraint df_meter_created default sysutcdatetime(),
  constraint fk_meter_asset foreign key (asset_num) references dbo.assets(asset_num),
  constraint fk_meter_work_order foreign key (work_order_num) references dbo.work_orders(work_order_num),
  constraint fk_meter_site foreign key (site_code) references dbo.sites(site_code)
);
go

create table dbo.audit_log (
  audit_id bigint identity(1,1) not null primary key,
  entity_name nvarchar(120) not null,
  entity_id nvarchar(120) not null,
  action_name nvarchar(40) not null,
  user_id nvarchar(50) null,
  before_json nvarchar(max) null,
  after_json nvarchar(max) null,
  created_at datetime2 not null constraint df_audit_created default sysutcdatetime(),
  constraint fk_audit_user foreign key (user_id) references dbo.users(user_id)
);
go

create view dbo.v_user_access as
select
  u.user_id,
  u.username,
  r.role_name,
  sites.site_codes,
  departments.department_scope
from dbo.users u
join dbo.roles r on r.role_id = u.role_id
outer apply (
  select string_agg(site_code, ',') within group (order by site_code) as site_codes
  from (
    select distinct site_code
    from dbo.user_site_access
    where user_id = u.user_id
  ) scoped_sites
) sites
outer apply (
  select string_agg(scope_value, ',') within group (order by scope_value) as department_scope
  from (
    select distinct coalesce(sub_department_code, department_name) as scope_value
    from dbo.user_department_access
    where user_id = u.user_id
  ) scoped_departments
) departments;
go

set nocount on;
go

merge dbo.sites as target
using (values ('1031', 'Riyadh', 'Central', 'Riyadh', 'Active')) as source(site_code, site_name, region, city, status)
on target.site_code = source.site_code
when matched then update set site_name = source.site_name, region = source.region, city = source.city, status = source.status, updated_at = sysutcdatetime()
when not matched then insert(site_code, site_name, region, city, status)
  values(source.site_code, source.site_name, source.region, source.city, source.status);
go

merge dbo.departments as target
using (values ('4-1-1', 'Mechanical', 'Mechanical-HVAC', 'Active')) as source(sub_department_code, department_name, description, status)
on target.sub_department_code = source.sub_department_code
when matched then update set department_name = source.department_name, description = source.description, status = source.status, updated_at = sysutcdatetime()
when not matched then insert(sub_department_code, department_name, description, status)
  values(source.sub_department_code, source.department_name, source.description, source.status);
go

merge dbo.locations as target
using (values
  ('RC-1031-RD-001-00-001', 'Main reception', 'Room', 'OPERATING', 2, 'High', '1031', 'RD-001', 'Administration', 'Mechanical')
) as source(location_code, description, location_type, status, priority, priority_description, site_code, building, building_category, department_name)
on target.location_code = source.location_code
when matched then update set
  description = source.description,
  location_type = source.location_type,
  status = source.status,
  priority = source.priority,
  priority_description = source.priority_description,
  site_code = source.site_code,
  building = source.building,
  building_category = source.building_category,
  department_name = source.department_name,
  updated_at = sysutcdatetime()
when not matched then insert(location_code, description, location_type, status, priority, priority_description, site_code, building, building_category, department_name)
  values(source.location_code, source.description, source.location_type, source.status, source.priority, source.priority_description, source.site_code, source.building, source.building_category, source.department_name);
go

merge dbo.assets as target
using (values
  ('FCU-100-0001', 'Fan coil unit - reception', 'RC-1031-RD-001-00-001', null, 'Mechanical', '4-1-1', 2, '1031', 'OPERATING', 'FCU-A1', 'SN-FCU-0001', cast('2026-01-15' as date), 1)
) as source(asset_num, description, location_code, parent_asset_num, department_name, sub_department_code, priority, site_code, status, model_num, serial_num, install_date, quantity)
on target.asset_num = source.asset_num
when matched then update set
  description = source.description,
  location_code = source.location_code,
  parent_asset_num = source.parent_asset_num,
  department_name = source.department_name,
  sub_department_code = source.sub_department_code,
  priority = source.priority,
  site_code = source.site_code,
  status = source.status,
  model_num = source.model_num,
  serial_num = source.serial_num,
  install_date = source.install_date,
  quantity = source.quantity,
  updated_at = sysutcdatetime()
when not matched then insert(asset_num, description, location_code, parent_asset_num, department_name, sub_department_code, priority, site_code, status, model_num, serial_num, install_date, quantity)
  values(source.asset_num, source.description, source.location_code, source.parent_asset_num, source.department_name, source.sub_department_code, source.priority, source.site_code, source.status, source.model_num, source.serial_num, source.install_date, source.quantity);
go

merge dbo.labor as target
using (values
  ('LAB-0001', 'Ahmed Mechanical Technician', 'HVAC-TECH', 'HVAC Technician', 'Mechanical', '4-1-1', '1031', 'Available', 'Active')
) as source(labor_id, display_name, craft_code, craft_name, department_name, sub_department_code, site_code, availability, status)
on target.labor_id = source.labor_id
when matched then update set
  display_name = source.display_name,
  craft_code = source.craft_code,
  craft_name = source.craft_name,
  department_name = source.department_name,
  sub_department_code = source.sub_department_code,
  site_code = source.site_code,
  availability = source.availability,
  status = source.status,
  updated_at = sysutcdatetime()
when not matched then insert(labor_id, display_name, craft_code, craft_name, department_name, sub_department_code, site_code, availability, status)
  values(source.labor_id, source.display_name, source.craft_code, source.craft_name, source.department_name, source.sub_department_code, source.site_code, source.availability, source.status);
go

merge dbo.materials as target
using (values
  ('MAT-0001', 'Air filter 500 x 500 mm', 'HVAC Consumable', 'EA', 'Active')
) as source(item_code, description, category, unit_of_measure, status)
on target.item_code = source.item_code
when matched then update set description = source.description, category = source.category, unit_of_measure = source.unit_of_measure, status = source.status, updated_at = sysutcdatetime()
when not matched then insert(item_code, description, category, unit_of_measure, status)
  values(source.item_code, source.description, source.category, source.unit_of_measure, source.status);
go

merge dbo.tools_equipment as target
using (values
  ('TOOL-0001', 'Digital multimeter', 'Electrical Tool', 'Available')
) as source(tool_code, description, category, status)
on target.tool_code = source.tool_code
when matched then update set description = source.description, category = source.category, status = source.status, updated_at = sysutcdatetime()
when not matched then insert(tool_code, description, category, status)
  values(source.tool_code, source.description, source.category, source.status);
go

merge dbo.storerooms as target
using (values
  ('DIWAN-MAIN', 'Diwan Main Store', '1031', 'Active')
) as source(store_code, store_name, site_code, status)
on target.store_code = source.store_code
when matched then update set store_name = source.store_name, site_code = source.site_code, status = source.status, updated_at = sysutcdatetime()
when not matched then insert(store_code, store_name, site_code, status)
  values(source.store_code, source.store_name, source.site_code, source.status);
go

merge dbo.inventory_stock as target
using (values
  ('DIWAN-MAIN', 'MAT-0001', 20, 0, 5)
) as source(store_code, item_code, balance, reserved_quantity, reorder_point)
on target.store_code = source.store_code and target.item_code = source.item_code
when matched then update set balance = source.balance, reserved_quantity = source.reserved_quantity, reorder_point = source.reorder_point, updated_at = sysutcdatetime()
when not matched then insert(store_code, item_code, balance, reserved_quantity, reorder_point)
  values(source.store_code, source.item_code, source.balance, source.reserved_quantity, source.reorder_point);
go

merge dbo.job_plans as target
using (values
  ('JP-HVAC-001', 'HVAC filter inspection and replacement', 'ACTIVE')
) as source(job_plan_num, description, status)
on target.job_plan_num = source.job_plan_num
when matched then update set description = source.description, status = source.status, updated_at = sysutcdatetime()
when not matched then insert(job_plan_num, description, status)
  values(source.job_plan_num, source.description, source.status);
go

if not exists (
  select 1 from dbo.job_plan_tasks
  where job_plan_num = 'JP-HVAC-001' and task_sequence = 10
)
insert into dbo.job_plan_tasks(job_plan_num, task_sequence, task_description, duration_hours)
values('JP-HVAC-001', 10, 'Inspect filter condition and replace if required', 0.5);
go

if not exists (
  select 1 from dbo.meter_readings
  where meter_id = 'MTR-0001' and asset_num = 'FCU-100-0001' and reading_at = cast('2026-08-02T08:00:00' as datetime2)
)
insert into dbo.meter_readings(meter_id, asset_num, work_order_num, site_code, department_name, reading_value, reading_unit, reading_at)
values('MTR-0001', 'FCU-100-0001', null, '1031', 'Mechanical', 1250, 'hours', cast('2026-08-02T08:00:00' as datetime2));
go

merge dbo.users as target
using (
  select
    'USR-SAMPLE' as user_id,
    'sample.user' as username,
    '$2a$10$g06iT6fzUqel.Z1pckd72uavRe7mttzMwgjJci.zjLAenGSlTF5TO' as password_hash,
    'Sample CAFM User' as display_name,
    'sample.user@example.com' as email,
    role_id,
    'LAB-0001' as labor_id,
    'Active' as status
  from dbo.roles
  where role_code = 'FACILITY_MANAGER'
) as source(user_id, username, password_hash, display_name, email, role_id, labor_id, status)
on target.user_id = source.user_id
when matched then update set
  username = source.username,
  password_hash = source.password_hash,
  display_name = source.display_name,
  email = source.email,
  role_id = source.role_id,
  labor_id = source.labor_id,
  status = source.status,
  updated_at = sysutcdatetime()
when not matched then insert(user_id, username, password_hash, display_name, email, role_id, labor_id, status)
  values(source.user_id, source.username, source.password_hash, source.display_name, source.email, source.role_id, source.labor_id, source.status);
go

if not exists (select 1 from dbo.user_site_access where user_id = 'USR-SAMPLE' and site_code = '1031')
insert into dbo.user_site_access(user_id, site_code)
values('USR-SAMPLE', '1031');
go

if not exists (select 1 from dbo.user_department_access where user_id = 'USR-SAMPLE' and department_name = 'Mechanical' and sub_department_code = '4-1-1')
insert into dbo.user_department_access(user_id, department_name, sub_department_code)
values('USR-SAMPLE', 'Mechanical', '4-1-1');
go

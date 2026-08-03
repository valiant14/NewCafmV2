set nocount on;
go

merge dbo.locations as target
using (values
  ('RC-1031-CV-001-00-001', 'Civil maintenance zone - reception', 'Room', 'OPERATING', 3, 'Standard', '1031', 'CV-001', 'Operations', 'Civil')
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
  ('CIV-100-0001', 'Civil fabric asset - reception', 'RC-1031-CV-001-00-001', null, 'Civil', '1-1-1', 3, '1031', 'OPERATING', 'CIV-FABRIC', 'CIV-001', cast('2026-01-01' as date), 1)
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

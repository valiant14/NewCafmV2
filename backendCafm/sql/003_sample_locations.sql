set nocount on;
go

merge dbo.locations as target
using (values
  ('RC-1031-RD-001-00-001', 'Main reception', 'Room', 'OPERATING', 2, 'High', '1031', 'RD-001', 'Administration', 'Civil')
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

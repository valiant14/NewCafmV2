set nocount on;

if exists (select 1 from dbo.assets where asset_num = N'CIV-100-0001')
begin
  update dbo.meter_readings
  set asset_num = N'CIV-100-0001',
      department_name = N'Civil',
      site_code = N'1031',
      reading_unit = N'kWh'
  where meter_id = N'MTR-0001';
end;

set nocount on;

update dbo.meter_readings
set reading_unit = N'kWh'
where meter_id = N'MTR-0001';

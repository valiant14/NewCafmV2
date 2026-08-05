if object_id('dbo.incidents', 'U') is not null
begin
  if col_length('dbo.incidents', 'severity') is null
    alter table dbo.incidents add severity nvarchar(40) null;

  if col_length('dbo.incidents', 'reported_by') is null
    alter table dbo.incidents add reported_by nvarchar(160) null;
end;
go

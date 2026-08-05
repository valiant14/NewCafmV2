if object_id('dbo.attachments', 'U') is null
begin
  create table dbo.attachments (
    attachment_id uniqueidentifier not null constraint df_attachments_id default newid(),
    entity_type nvarchar(40) not null,
    entity_id nvarchar(80) not null,
    category nvarchar(80) not null constraint df_attachments_category default 'General',
    original_name nvarchar(260) not null,
    stored_name nvarchar(260) not null,
    mime_type nvarchar(160) not null,
    size_bytes bigint not null,
    storage_provider nvarchar(40) not null constraint df_attachments_provider default 'filesystem',
    storage_path nvarchar(500) not null,
    uploaded_by_user_id nvarchar(50) null,
    created_at datetime2 not null constraint df_attachments_created default sysutcdatetime(),
    constraint pk_attachments primary key (attachment_id),
    constraint uq_attachments_stored_name unique (stored_name),
    constraint ck_attachments_entity_type check (entity_type in ('work-order', 'incident', 'service-request')),
    constraint ck_attachments_size check (size_bytes > 0)
  );
end;
go

if not exists (select 1 from sys.indexes where object_id = object_id('dbo.attachments') and name = 'ix_attachments_entity')
begin
  create index ix_attachments_entity on dbo.attachments(entity_type, entity_id, created_at);
end;
go

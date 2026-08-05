set nocount on;
set xact_abort on;
go

if exists (
  select 1
  from sys.check_constraints
  where parent_object_id = object_id('dbo.work_order_workflow_settings')
    and name = 'ck_wo_workflow_initial_status'
)
  alter table dbo.work_order_workflow_settings drop constraint ck_wo_workflow_initial_status;
go

if object_id('dbo.work_order_workflow_steps', 'U') is null
begin
  create table dbo.work_order_workflow_steps (
    workflow_key nvarchar(40) not null,
    step_id nvarchar(80) not null,
    status_code nvarchar(40) not null,
    step_name nvarchar(160) not null,
    sequence_no int not null,
    is_automatic bit not null constraint df_wo_workflow_step_automatic default 0,
    requirements_json nvarchar(max) not null constraint df_wo_workflow_step_requirements default '[]',
    badge_tone nvarchar(20) not null constraint df_wo_workflow_step_tone default 'neutral',
    created_at datetime2 not null constraint df_wo_workflow_step_created default sysutcdatetime(),
    updated_at datetime2 not null constraint df_wo_workflow_step_updated default sysutcdatetime(),
    constraint pk_work_order_workflow_steps primary key (workflow_key, step_id),
    constraint uq_work_order_workflow_step_status unique (workflow_key, status_code),
    constraint uq_work_order_workflow_step_sequence unique (workflow_key, sequence_no),
    constraint fk_work_order_workflow_step_workflow foreign key (workflow_key)
      references dbo.work_order_workflow_settings(workflow_key) on delete cascade,
    constraint ck_work_order_workflow_step_requirements check (isjson(requirements_json) = 1),
    constraint ck_work_order_workflow_step_tone check (badge_tone in ('neutral', 'green', 'blue', 'purple', 'orange', 'red'))
  );
end;
go

if not exists (
  select 1 from dbo.work_order_workflow_steps where workflow_key = 'DEFAULT'
)
begin
  insert into dbo.work_order_workflow_steps (
    workflow_key, step_id, status_code, step_name, sequence_no,
    is_automatic, requirements_json, badge_tone
  )
  select
    'DEFAULT', source.step_id, source.status_code, source.step_name, source.sequence_no,
    source.is_automatic, source.requirements_json, source.badge_tone
  from (values
    ('STEP-WAPPR', 'WAPPR', 'Waiting Approval', 10, 0, N'[]', 'orange'),
    ('STEP-APPR', 'APPR', 'Approved', 20, 1, N'["overview"]', 'green'),
    ('STEP-WSCH', 'WSCH', 'Waiting Schedule', 30, 1, N'["overview","planned_labor","planned_materials_cm","planned_tools_cm"]', 'purple'),
    ('STEP-SCHED', 'SCHED', 'Scheduled', 40, 1, N'["overview","planned_labor","planned_materials_cm","planned_tools_cm"]', 'blue'),
    ('STEP-INPRG', 'INPRG', 'In Progress', 50, 1, N'["overview","planned_labor","planned_materials_cm","planned_tools_cm","ptw","store_issue"]', 'blue'),
    ('STEP-COMP', 'COMP', 'Completed', 60, 1, N'["store_issue","failure","actual_labor","execution_notes","actual_resources"]', 'green'),
    ('STEP-CLOSE', 'CLOSE', 'Closed', 70, 0, N'["store_issue","failure","actual_labor","execution_notes","actual_resources","returns"]', 'green')
  ) source(step_id, status_code, step_name, sequence_no, is_automatic, requirements_json, badge_tone);

  update step
  set is_automatic = case step.status_code
      when 'APPR' then settings.auto_approve
      when 'WSCH' then settings.auto_schedule
      when 'SCHED' then settings.auto_schedule
      when 'INPRG' then settings.auto_start
      when 'COMP' then settings.auto_complete
      when 'CLOSE' then settings.auto_close
      else step.is_automatic
    end
  from dbo.work_order_workflow_steps step
  join dbo.work_order_workflow_settings settings on settings.workflow_key = step.workflow_key
  where step.workflow_key = 'DEFAULT';
end;
go

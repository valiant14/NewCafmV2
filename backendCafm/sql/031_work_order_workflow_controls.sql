set nocount on;
set xact_abort on;
go

if object_id('dbo.work_order_workflow_settings', 'U') is null
begin
  create table dbo.work_order_workflow_settings (
    workflow_key nvarchar(40) not null constraint pk_work_order_workflow_settings primary key,
    workflow_name nvarchar(160) not null,
    initial_status nvarchar(40) not null constraint df_wo_workflow_initial_status default 'WAPPR',
    ptw_required_default bit not null constraint df_wo_workflow_ptw_default default 1,
    allow_ptw_override bit not null constraint df_wo_workflow_ptw_override default 1,
    allow_manual_status_change bit not null constraint df_wo_workflow_manual_status default 1,
    allow_backward_transition bit not null constraint df_wo_workflow_backward default 1,
    allow_hold bit not null constraint df_wo_workflow_hold default 1,
    allow_cancel_before_start bit not null constraint df_wo_workflow_cancel default 1,
    auto_approve bit not null constraint df_wo_workflow_auto_approve default 1,
    auto_schedule bit not null constraint df_wo_workflow_auto_schedule default 1,
    auto_start bit not null constraint df_wo_workflow_auto_start default 1,
    auto_complete bit not null constraint df_wo_workflow_auto_complete default 1,
    auto_close bit not null constraint df_wo_workflow_auto_close default 0,
    require_overview_for_approval bit not null constraint df_wo_workflow_req_overview default 1,
    require_planned_labor_for_schedule bit not null constraint df_wo_workflow_req_labor default 1,
    require_materials_for_cm bit not null constraint df_wo_workflow_req_materials default 1,
    require_tools_for_cm bit not null constraint df_wo_workflow_req_tools default 1,
    require_ptw_for_start bit not null constraint df_wo_workflow_req_ptw default 1,
    require_store_issue_for_start bit not null constraint df_wo_workflow_req_store default 1,
    require_failure_for_complete bit not null constraint df_wo_workflow_req_failure default 1,
    require_actual_labor_for_complete bit not null constraint df_wo_workflow_req_actual_labor default 1,
    require_execution_notes_for_complete bit not null constraint df_wo_workflow_req_notes default 1,
    require_actual_resources_for_complete bit not null constraint df_wo_workflow_req_actual_resources default 1,
    require_returns_for_close bit not null constraint df_wo_workflow_req_returns default 1,
    updated_by_user_id nvarchar(50) null,
    created_at datetime2 not null constraint df_wo_workflow_created default sysutcdatetime(),
    updated_at datetime2 not null constraint df_wo_workflow_updated default sysutcdatetime(),
    constraint ck_wo_workflow_initial_status check (initial_status in ('WAPPR', 'APPR', 'WSCH', 'SCHED'))
  );
end;
go

if col_length('dbo.work_orders', 'held_from_status') is null
  alter table dbo.work_orders add held_from_status nvarchar(40) null;
go

if col_length('dbo.work_orders', 'hold_periods_json') is null
  alter table dbo.work_orders add hold_periods_json nvarchar(max) null;
go

merge dbo.work_order_workflow_settings as target
using (values (
  'DEFAULT', 'Standard Work Order Lifecycle', 'WAPPR',
  1, 1, 1, 1, 1, 1,
  1, 1, 1, 1, 0,
  1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1
)) as source (
  workflow_key, workflow_name, initial_status,
  ptw_required_default, allow_ptw_override, allow_manual_status_change,
  allow_backward_transition, allow_hold, allow_cancel_before_start,
  auto_approve, auto_schedule, auto_start, auto_complete, auto_close,
  require_overview_for_approval, require_planned_labor_for_schedule,
  require_materials_for_cm, require_tools_for_cm, require_ptw_for_start,
  require_store_issue_for_start, require_failure_for_complete,
  require_actual_labor_for_complete, require_execution_notes_for_complete,
  require_actual_resources_for_complete, require_returns_for_close
)
on target.workflow_key = source.workflow_key
when not matched then insert (
  workflow_key, workflow_name, initial_status,
  ptw_required_default, allow_ptw_override, allow_manual_status_change,
  allow_backward_transition, allow_hold, allow_cancel_before_start,
  auto_approve, auto_schedule, auto_start, auto_complete, auto_close,
  require_overview_for_approval, require_planned_labor_for_schedule,
  require_materials_for_cm, require_tools_for_cm, require_ptw_for_start,
  require_store_issue_for_start, require_failure_for_complete,
  require_actual_labor_for_complete, require_execution_notes_for_complete,
  require_actual_resources_for_complete, require_returns_for_close
) values (
  source.workflow_key, source.workflow_name, source.initial_status,
  source.ptw_required_default, source.allow_ptw_override, source.allow_manual_status_change,
  source.allow_backward_transition, source.allow_hold, source.allow_cancel_before_start,
  source.auto_approve, source.auto_schedule, source.auto_start, source.auto_complete, source.auto_close,
  source.require_overview_for_approval, source.require_planned_labor_for_schedule,
  source.require_materials_for_cm, source.require_tools_for_cm, source.require_ptw_for_start,
  source.require_store_issue_for_start, source.require_failure_for_complete,
  source.require_actual_labor_for_complete, source.require_execution_notes_for_complete,
  source.require_actual_resources_for_complete, source.require_returns_for_close
);
go

merge dbo.permission_modules as target
using (values ('Work Order Workflow')) as source(module_name)
on target.module_name = source.module_name
when not matched then insert (module_name) values (source.module_name);
go

insert into dbo.role_permissions(role_id, module_name, action_name, allowed)
select r.role_id, 'Work Order Workflow', a.action_name, 1
from dbo.roles r
join dbo.permission_actions a on a.action_name in ('view', 'edit')
where r.role_code = 'FACILITY_MANAGER'
  and not exists (
    select 1
    from dbo.role_permissions existing
    where existing.role_id = r.role_id
      and existing.module_name = 'Work Order Workflow'
      and existing.action_name = a.action_name
  );
go

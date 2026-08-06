set nocount on;
set xact_abort on;

begin transaction;

if object_id('dbo.application_workflows', 'U') is null
begin
  create table dbo.application_workflows (
    workflow_key nvarchar(40) not null constraint pk_application_workflows primary key,
    module_name nvarchar(80) not null,
    workflow_name nvarchar(160) not null,
    initial_status nvarchar(40) not null,
    allow_manual_status_change bit not null constraint df_application_workflow_manual default 1,
    allow_backward_transition bit not null constraint df_application_workflow_backward default 0,
    allow_cancel bit not null constraint df_application_workflow_cancel default 1,
    is_active bit not null constraint df_application_workflow_active default 1,
    updated_by_user_id nvarchar(50) null,
    created_at datetime2 not null constraint df_application_workflow_created default sysutcdatetime(),
    updated_at datetime2 not null constraint df_application_workflow_updated default sysutcdatetime()
  );
end;

if object_id('dbo.application_workflow_steps', 'U') is null
begin
  create table dbo.application_workflow_steps (
    workflow_key nvarchar(40) not null,
    step_id nvarchar(80) not null,
    status_code nvarchar(40) not null,
    step_name nvarchar(160) not null,
    sequence_no int not null,
    is_automatic bit not null constraint df_application_workflow_step_automatic default 0,
    requirements_json nvarchar(max) not null constraint df_application_workflow_step_requirements default '[]',
    badge_tone nvarchar(20) not null constraint df_application_workflow_step_tone default 'neutral',
    created_at datetime2 not null constraint df_application_workflow_step_created default sysutcdatetime(),
    updated_at datetime2 not null constraint df_application_workflow_step_updated default sysutcdatetime(),
    constraint pk_application_workflow_steps primary key (workflow_key, step_id),
    constraint uq_application_workflow_step_status unique (workflow_key, status_code),
    constraint uq_application_workflow_step_sequence unique (workflow_key, sequence_no),
    constraint fk_application_workflow_step_workflow foreign key (workflow_key)
      references dbo.application_workflows(workflow_key) on delete cascade,
    constraint ck_application_workflow_step_requirements check (isjson(requirements_json) = 1),
    constraint ck_application_workflow_step_tone check (badge_tone in ('neutral', 'green', 'blue', 'purple', 'orange', 'red'))
  );
end;

merge dbo.application_workflows as target
using (values
  ('JOB_REQUEST', 'Job Requests', 'Job Request Lifecycle', 'WAPPR', cast(1 as bit), cast(0 as bit), cast(1 as bit), cast(1 as bit)),
  ('SUPPLY_CHAIN', 'Supply Chain', 'Supply Chain Fulfilment', 'REQUESTED', cast(0 as bit), cast(0 as bit), cast(1 as bit), cast(1 as bit))
) as source(workflow_key, module_name, workflow_name, initial_status, allow_manual_status_change, allow_backward_transition, allow_cancel, is_active)
on target.workflow_key = source.workflow_key
when not matched then insert(
  workflow_key, module_name, workflow_name, initial_status,
  allow_manual_status_change, allow_backward_transition, allow_cancel, is_active
) values(
  source.workflow_key, source.module_name, source.workflow_name, source.initial_status,
  source.allow_manual_status_change, source.allow_backward_transition, source.allow_cancel, source.is_active
);

if not exists (select 1 from dbo.application_workflow_steps where workflow_key = 'JOB_REQUEST')
begin
  insert into dbo.application_workflow_steps(
    workflow_key, step_id, status_code, step_name, sequence_no,
    is_automatic, requirements_json, badge_tone
  ) values
    ('JOB_REQUEST', 'STEP-WAPPR', 'WAPPR', 'Waiting for Review', 10, 0, '[]', 'orange'),
    ('JOB_REQUEST', 'STEP-CONVERTED', 'CONVERTED', 'Converted to Work Order', 20, 0, '["request_details","site_location","department_routing","failure_classification","linked_work_order"]', 'blue'),
    ('JOB_REQUEST', 'STEP-RESOLVED', 'RESOLVED', 'Resolved', 30, 1, '["linked_work_order_closed"]', 'green');
end;

if not exists (select 1 from dbo.application_workflow_steps where workflow_key = 'SUPPLY_CHAIN')
begin
  insert into dbo.application_workflow_steps(
    workflow_key, step_id, status_code, step_name, sequence_no,
    is_automatic, requirements_json, badge_tone
  ) values
    ('SUPPLY_CHAIN', 'STEP-REQUESTED', 'REQUESTED', 'Requisition Requested', 10, 0, '["requested_quantity","source_store"]', 'orange'),
    ('SUPPLY_CHAIN', 'STEP-PR-APPROVED', 'PR_APPROVED', 'Requisition Approved', 20, 0, '["requisition_approval"]', 'green'),
    ('SUPPLY_CHAIN', 'STEP-ORDERED', 'ORDERED', 'Purchase Order Created', 30, 1, '["linked_purchase_order"]', 'purple'),
    ('SUPPLY_CHAIN', 'STEP-PO-APPROVED', 'PO_APPROVED', 'Purchase Order Approved', 40, 0, '["purchase_order_approval"]', 'blue'),
    ('SUPPLY_CHAIN', 'STEP-RECEIVED', 'RECEIVED', 'Goods Received', 50, 0, '["goods_receipt","stock_posting"]', 'blue'),
    ('SUPPLY_CHAIN', 'STEP-STAGED', 'STAGED', 'Store Staged', 60, 1, '["reservation"]', 'purple'),
    ('SUPPLY_CHAIN', 'STEP-DELIVERED', 'DELIVERED', 'Delivered to Work Order', 70, 0, '["delivery"]', 'green');
end;

commit transaction;

set nocount on;
set xact_abort on;
go

if col_length('dbo.service_requests', 'problem_code') is null
  alter table dbo.service_requests add problem_code nvarchar(80) null;

if col_length('dbo.work_orders', 'completed_at') is null
  alter table dbo.work_orders add completed_at datetime2 null;

if col_length('dbo.work_orders', 'closed_at') is null
  alter table dbo.work_orders add closed_at datetime2 null;

if col_length('dbo.work_orders', 'closed_by_user_id') is null
  alter table dbo.work_orders add closed_by_user_id nvarchar(50) null;

if col_length('dbo.work_orders', 'closed_by_name') is null
  alter table dbo.work_orders add closed_by_name nvarchar(160) null;
go

set nocount on;
set xact_abort on;

begin transaction;

update request
set problem_code = matching.problem_code,
    updated_at = sysutcdatetime()
from dbo.service_requests request
cross apply (
  select top 1 problem_code
  from dbo.failure_library
  where failure_class_id = request.failure_code and nullif(ltrim(rtrim(problem_code)), '') is not null
  order by problem_code
) matching
where nullif(ltrim(rtrim(request.failure_code)), '') is not null
  and nullif(ltrim(rtrim(request.problem_code)), '') is null;

update request
set status = case
      when upper(ltrim(rtrim(request.status))) in ('CAN', 'CANCELLED', 'CANCELED') then 'CAN'
      when request.converted_work_order_num is not null and upper(ltrim(rtrim(work_order.status))) = 'CLOSE' then 'CLOSED'
      when request.converted_work_order_num is not null then 'INPRG'
      when upper(ltrim(rtrim(request.status))) = 'NEW' then 'NEW'
      else 'WAPPR'
    end,
    updated_at = sysutcdatetime()
from dbo.service_requests request
left join dbo.work_orders work_order on work_order.work_order_num = request.converted_work_order_num
where upper(ltrim(rtrim(request.status))) not in ('NEW', 'WAPPR', 'INPRG', 'CLOSED', 'CAN')
   or (upper(ltrim(rtrim(request.status))) = 'CLOSED' and isnull(upper(ltrim(rtrim(work_order.status))), '') <> 'CLOSE');

update dbo.work_orders
set completed_at = coalesce(completed_at, actual_finish_at, updated_at)
where upper(ltrim(rtrim(status))) in ('COMP', 'CLOSE') and completed_at is null;

update dbo.work_orders
set closed_at = coalesce(closed_at, actual_finish_at, updated_at)
where upper(ltrim(rtrim(status))) = 'CLOSE' and closed_at is null;

update dbo.application_workflows
set workflow_name = 'Job Request Lifecycle',
    initial_status = 'NEW',
    allow_manual_status_change = 1,
    allow_backward_transition = 0,
    allow_cancel = 1,
    is_active = 1,
    updated_at = sysutcdatetime()
where workflow_key = 'JOB_REQUEST';

delete from dbo.application_workflow_steps where workflow_key = 'JOB_REQUEST';

insert into dbo.application_workflow_steps(
  workflow_key, step_id, status_code, step_name, sequence_no,
  is_automatic, requirements_json, badge_tone
) values
  ('JOB_REQUEST', 'STEP-NEW', 'NEW', 'New', 10, 0, '["request_details","site_location","responsible_department"]', 'purple'),
  ('JOB_REQUEST', 'STEP-WAPPR', 'WAPPR', 'Department Review / Waiting Approval', 20, 0, '["request_details","site_location","responsible_department"]', 'orange'),
  ('JOB_REQUEST', 'STEP-INPRG', 'INPRG', 'CM Work Order In Progress', 30, 0, '["department_routing","asset","failure_classification","linked_work_order"]', 'blue'),
  ('JOB_REQUEST', 'STEP-CLOSED', 'CLOSED', 'Closed', 40, 1, '["linked_work_order_closed"]', 'green');

commit transaction;
go

create or alter trigger dbo.trg_work_orders_close_job_request
on dbo.work_orders
after update
as
begin
  set nocount on;
  if not update(status) return;

  update request
  set status = 'CLOSED',
      updated_at = sysutcdatetime()
  from dbo.service_requests request
  join inserted current_order on current_order.source_sr_num = request.sr_num
  join deleted previous_order on previous_order.work_order_num = current_order.work_order_num
  where upper(ltrim(rtrim(current_order.status))) = 'CLOSE'
    and upper(ltrim(rtrim(previous_order.status))) <> 'CLOSE'
    and upper(ltrim(rtrim(request.status))) not in ('CLOSED', 'CAN');
end;
go

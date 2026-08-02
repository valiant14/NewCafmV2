set nocount on;
go

merge dbo.failure_library as target
using (values
  (
    '1-1-1-01',
    N'SIGNAGE OTHERS - اخري لافتات الأسماء والأرقام',
    '1-1-1-01-01',
    N'DAMAGED SIGNAGE- NEEDS REPLACEMENT/REPAIR - استبدال / إصلاح لافتة متضررة',
    null,
    null,
    null,
    null
  ),
  (
    '1-1-1-01',
    N'SIGNAGE OTHERS - اخري لافتات الأسماء والأرقام',
    '1-1-1-01-02',
    N'REPLACE MISSING SIGNAGE - استبدال بدل لافتة مفقودة',
    null,
    null,
    null,
    null
  )
) as source(failure_class_id, description, problem_code, problem_description, cause_code, cause_description, remedy_code, remedy_description)
on target.failure_class_id = source.failure_class_id
  and isnull(target.problem_code, '') = isnull(source.problem_code, '')
  and isnull(target.cause_code, '') = isnull(source.cause_code, '')
  and isnull(target.remedy_code, '') = isnull(source.remedy_code, '')
when matched then update set
  description = source.description,
  problem_description = source.problem_description,
  cause_description = source.cause_description,
  remedy_description = source.remedy_description,
  updated_at = sysutcdatetime()
when not matched then insert(failure_class_id, description, problem_code, problem_description, cause_code, cause_description, remedy_code, remedy_description)
  values(source.failure_class_id, source.description, source.problem_code, source.problem_description, source.cause_code, source.cause_description, source.remedy_code, source.remedy_description);
go

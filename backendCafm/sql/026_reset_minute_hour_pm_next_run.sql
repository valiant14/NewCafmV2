set nocount on;

update pm
set
  next_date = dateadd(minute, -1, sysutcdatetime()),
  last_generated_cycle = null,
  updated_at = sysutcdatetime()
from dbo.preventive_maintenance pm
left join dbo.pm_schedule_rules pm_rule
  on pm_rule.rule_name = pm.schedule_rule_name
  and pm_rule.status = 'Active'
where pm.pm_status = 'ACTIVE'
  and coalesce(pm_rule.frequency_unit, pm.frequency_unit) in ('MINUTES', 'HOURS')
  and pm.next_date > sysutcdatetime();

select @@rowcount as reset_pm_count;

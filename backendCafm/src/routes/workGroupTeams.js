import { Router } from 'express'
import sql from 'mssql'
import { getPool } from '../db/pool.js'
import { requirePermission } from '../middleware/auth.js'
import { addScopeWhere } from '../middleware/scope.js'
import { asyncHandler } from '../utils/asyncHandler.js'
import { bindParams } from '../utils/sqlParams.js'

const router = Router()
const groupScope = {
  siteColumn: 'site_code',
  departmentColumn: 'department_name',
  subDepartmentColumn: 'sub_department_code'
}
const text = value => String(value || '').trim()
const same = (left, right) => text(left).toLowerCase() === text(right).toLowerCase()
const memberIdsFrom = value => [
  ...new Map((Array.isArray(value) ? value : [])
    .map(text)
    .filter(Boolean)
    .map(id => [id.toLowerCase(), id])).values()
]

const httpError = (status, code, message) => {
  const error = new Error(message)
  error.status = status
  error.code = code
  return error
}

router.put(
  '/:id/members',
  requirePermission('Routing Masters', 'edit'),
  requirePermission('Labor', 'edit'),
  asyncHandler(async (req, res) => {
    const memberIds = memberIdsFrom(req.body?.member_labor_ids)
    if (memberIds.length > 500) {
      throw httpError(400, 'InvalidWorkGroupMembers', 'A Work Group cannot contain more than 500 Labor records.')
    }

    const pool = await getPool()
    const transaction = new sql.Transaction(pool)
    await transaction.begin(sql.ISOLATION_LEVEL.SERIALIZABLE)

    try {
      const scoped = addScopeWhere({ user: req.user, ...groupScope })
      const groupRequest = bindParams(new sql.Request(transaction), scoped.params)
      const groupResult = await groupRequest
        .input('workGroupCode', req.params.id)
        .query(`
          select work_group_code, site_code, department_name, sub_department_code,
            default_supervisor_labor_id, status
          from dbo.work_groups with (updlock, holdlock)
          where work_group_code = @workGroupCode${scoped.where}
        `)
      const group = groupResult.recordset[0]
      if (!group) throw httpError(404, 'NotFound', 'Work Group not found or outside your data scope.')

      let requestedLabor = []
      if (memberIds.length) {
        const laborResult = await new sql.Request(transaction)
          .input('memberIdsJson', sql.NVarChar(sql.MAX), JSON.stringify(memberIds))
          .query(`
            select labor_id, display_name, craft_code, craft_name, site_code, department_name,
              sub_department_code, work_group_code, availability, status
            from dbo.labor with (updlock, holdlock)
            where labor_id in (
              select member_id
              from openjson(@memberIdsJson)
              with (member_id nvarchar(80) '$')
            )
          `)
        requestedLabor = laborResult.recordset
      }

      const laborById = new Map(requestedLabor.map(row => [text(row.labor_id).toLowerCase(), row]))
      const missing = memberIds.filter(id => !laborById.has(id.toLowerCase()))
      if (missing.length) {
        throw httpError(400, 'InvalidWorkGroupMembers', `Labor record not found: ${missing.join(', ')}`)
      }

      const invalid = requestedLabor.find(person => {
        const inactive = text(person.status || 'Active').toUpperCase() === 'INACTIVE'
        const wrongSite = !same(person.site_code, group.site_code)
        const wrongDepartment = !same(person.department_name, group.department_name)
        const wrongSubDepartment = text(group.sub_department_code)
          && !same(person.sub_department_code, group.sub_department_code)
        return inactive || wrongSite || wrongDepartment || wrongSubDepartment
      })
      if (invalid) {
        throw httpError(
          400,
          'InvalidWorkGroupMembers',
          `${invalid.display_name || invalid.labor_id} must be active and belong to the same site, department, and sub-department as the Work Group.`
        )
      }

      const updateResult = await new sql.Request(transaction)
        .input('workGroupCode', group.work_group_code)
        .input('memberIdsJson', sql.NVarChar(sql.MAX), JSON.stringify(memberIds))
        .query(`
          update dbo.labor
          set work_group_code = null, updated_at = sysutcdatetime()
          where work_group_code = @workGroupCode
            and labor_id not in (
              select member_id
              from openjson(@memberIdsJson)
              with (member_id nvarchar(80) '$')
            );

          update labor
          set work_group_code = @workGroupCode, updated_at = sysutcdatetime()
          from dbo.labor labor
          inner join openjson(@memberIdsJson)
            with (member_id nvarchar(80) '$') selected
            on selected.member_id = labor.labor_id
          where isnull(labor.work_group_code, '') <> @workGroupCode;

          select labor_id, display_name, craft_code, craft_name, site_code, department_name,
            sub_department_code, work_group_code, availability, status, created_at, updated_at
          from dbo.labor
          where work_group_code = @workGroupCode
          order by display_name, labor_id;
        `)

      await transaction.commit()
      req.app.locals.broadcastWorkspaceChange?.({
        actor: req.user?.userId || req.user?.username || '',
        moduleName: 'Labor',
        relatedModules: ['Routing Masters', 'Work Orders'],
        table: 'dbo.labor',
        action: 'team-members-updated',
        key: 'work_group_code',
        id: group.work_group_code,
        siteCode: group.site_code,
        department: group.department_name
      })
      res.json({
        work_group_code: group.work_group_code,
        member_labor_ids: updateResult.recordset.map(row => row.labor_id),
        members: updateResult.recordset
      })
    } catch (error) {
      await transaction.rollback().catch(() => {})
      throw error
    }
  })
)

export default router

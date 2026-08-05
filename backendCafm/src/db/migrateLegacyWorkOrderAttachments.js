import { deleteAttachmentFile, saveAttachmentFile } from '../services/attachmentStorage.js'

const parseRows = value => {
  if (!value) return []
  try {
    const parsed = JSON.parse(value)
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

const decodeDataUrl = value => {
  const match = String(value || '').match(/^data:([^;,]+)?;base64,([\s\S]+)$/i)
  if (!match) return null
  try {
    const bytes = Buffer.from(match[2], 'base64')
    return bytes.length ? { bytes, mimeType: match[1] || 'application/octet-stream' } : null
  } catch {
    return null
  }
}

export const migrateLegacyWorkOrderAttachments = async pool => {
  const columns = await pool.request().query(`
    select
      col_length('dbo.work_orders', 'ptw_files_json') as ptw_column,
      col_length('dbo.work_orders', 'general_files_json') as general_column,
      object_id('dbo.attachments', 'U') as attachments_table
  `)
  const state = columns.recordset[0] || {}
  if (!state.attachments_table || (state.ptw_column === null && state.general_column === null)) return 0

  const selectColumns = [
    'work_order_num',
    state.ptw_column === null ? 'cast(null as nvarchar(max)) as ptw_files_json' : 'ptw_files_json',
    state.general_column === null ? 'cast(null as nvarchar(max)) as general_files_json' : 'general_files_json'
  ]
  const result = await pool.request().query(`
    select ${selectColumns.join(', ')}
    from dbo.work_orders
    where ${state.ptw_column === null ? '1 = 0' : 'ptw_files_json is not null'}
       or ${state.general_column === null ? '1 = 0' : 'general_files_json is not null'}
  `)

  let migrated = 0
  for (const row of result.recordset) {
    const groups = [
      ['PTW', parseRows(row.ptw_files_json)],
      ['General', parseRows(row.general_files_json)]
    ]
    for (const [category, files] of groups) {
      for (const file of files) {
        const decoded = decodeDataUrl(file?.dataUrl)
        if (!decoded) continue
        const originalName = String(file?.name || 'attachment').slice(0, 260)
        const duplicate = await pool.request()
          .input('entityId', row.work_order_num)
          .input('category', category)
          .input('originalName', originalName)
          .input('sizeBytes', decoded.bytes.length)
          .query(`
            select top 1 attachment_id
            from dbo.attachments
            where entity_type = 'work-order' and entity_id = @entityId and category = @category
              and original_name = @originalName and size_bytes = @sizeBytes
          `)
        if (duplicate.recordset[0]) continue
        const stored = await saveAttachmentFile({ bytes: decoded.bytes, originalName })
        try {
          await pool.request()
            .input('entityId', row.work_order_num)
            .input('category', category)
            .input('originalName', stored.originalName)
            .input('storedName', stored.storedName)
            .input('mimeType', String(file?.type || decoded.mimeType).slice(0, 160))
            .input('sizeBytes', decoded.bytes.length)
            .input('storagePath', stored.storagePath)
            .query(`
              insert into dbo.attachments(entity_type, entity_id, category, original_name, stored_name, mime_type, size_bytes, storage_provider, storage_path)
              values('work-order', @entityId, @category, @originalName, @storedName, @mimeType, @sizeBytes, 'filesystem', @storagePath)
            `)
          migrated += 1
        } catch (error) {
          await deleteAttachmentFile(stored.storagePath)
          throw error
        }
      }
    }
    const assignments = [
      state.ptw_column === null ? null : 'ptw_files_json = null',
      state.general_column === null ? null : 'general_files_json = null'
    ].filter(Boolean)
    await pool.request()
      .input('workOrderNum', row.work_order_num)
      .query(`update dbo.work_orders set ${assignments.join(', ')} where work_order_num = @workOrderNum`)
  }
  const legacyColumns = [
    state.ptw_column === null ? null : 'ptw_files_json',
    state.general_column === null ? null : 'general_files_json'
  ].filter(Boolean)
  if (legacyColumns.length) {
    const constraints = await pool.request().query(`
      select default_constraint.name
      from sys.default_constraints default_constraint
      join sys.columns column_definition
        on column_definition.object_id = default_constraint.parent_object_id
       and column_definition.column_id = default_constraint.parent_column_id
      where default_constraint.parent_object_id = object_id('dbo.work_orders')
        and column_definition.name in (${legacyColumns.map(column => `'${column}'`).join(', ')})
    `)
    for (const constraint of constraints.recordset) {
      const constraintName = String(constraint.name).replaceAll(']', ']]')
      await pool.request().query(`alter table dbo.work_orders drop constraint [${constraintName}]`)
    }
    await pool.request().query(`alter table dbo.work_orders drop column ${legacyColumns.join(', ')}`)
  }
  return migrated
}

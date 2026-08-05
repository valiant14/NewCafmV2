import express, { Router } from 'express'
import { getPool, sql } from '../db/pool.js'
import { assertPermission } from '../middleware/auth.js'
import { addScopeWhere } from '../middleware/scope.js'
import { bindParams } from '../utils/sqlParams.js'
import { asyncHandler } from '../utils/asyncHandler.js'
import { deleteAttachmentFile, readAttachmentFile, saveAttachmentFile } from '../services/attachmentStorage.js'
import { env } from '../config/env.js'

const router = Router()
const entityTypes = {
  'work-order': {
    moduleName: 'Work Orders',
    table: 'dbo.work_orders',
    key: 'work_order_num',
    scope: { siteColumn: 'site_code', departmentColumn: 'department_name', departmentColumns: ['assigned_department_name'], subDepartmentColumn: 'sub_department_code', ownerColumn: 'created_by_user_id' }
  },
  incident: {
    moduleName: 'Incidents',
    table: 'dbo.incidents',
    key: 'incident_num',
    scope: { siteColumn: 'site_code', departmentColumn: 'department_name', ownerColumn: 'created_by_user_id' }
  },
  'service-request': {
    moduleName: 'Job Requests',
    table: 'dbo.service_requests',
    key: 'sr_num',
    scope: { siteColumn: 'site_code', departmentColumn: 'department_name', departmentColumns: ['assigned_department_name'], subDepartmentColumn: 'sub_department_code', ownerColumn: 'created_by_user_id' }
  }
}

const badRequest = message => {
  const error = new Error(message)
  error.status = 400
  return error
}

const notFound = () => {
  const error = new Error('Attachment or parent record not found.')
  error.status = 404
  return error
}

const entityConfig = entityType => entityTypes[String(entityType || '').toLowerCase()] || null
const decodedFileName = value => {
  try {
    return decodeURIComponent(String(value || 'attachment'))
  } catch {
    throw badRequest('X-File-Name must be URI encoded.')
  }
}

const assertEntityAccess = async ({ pool, user, entityType, entityId, action }) => {
  const config = entityConfig(entityType)
  if (!config) throw badRequest('Unsupported attachment entity type.')
  await assertPermission(user, config.moduleName, action)
  const scoped = addScopeWhere({ user, ...config.scope })
  const result = await bindParams(pool.request(), scoped.params)
    .input('entityId', entityId)
    .query(`select top 1 [${config.key}] from ${config.table} where [${config.key}] = @entityId${scoped.where}`)
  if (!result.recordset[0]) throw notFound()
  return config
}

const attachmentById = async (pool, attachmentId) => {
  const result = await pool.request()
    .input('attachmentId', sql.UniqueIdentifier, attachmentId)
    .query('select * from dbo.attachments where attachment_id = @attachmentId')
  return result.recordset[0] || null
}

const emitChange = (req, config, attachment, action) => req.app.locals.broadcastWorkspaceChange?.({
  actor: req.user?.userId || req.user?.username || '',
  moduleName: config.moduleName,
  relatedModules: ['Attachments'],
  table: 'dbo.attachments',
  action,
  key: 'attachment_id',
  id: attachment.attachment_id,
  entityType: attachment.entity_type,
  entityId: attachment.entity_id
})

router.get('/', asyncHandler(async (req, res) => {
  const entityType = String(req.query.entity_type || '').toLowerCase()
  const entityId = String(req.query.entity_id || '').trim()
  if (!entityType || !entityId) throw badRequest('entity_type and entity_id are required.')
  const pool = await getPool()
  await assertEntityAccess({ pool, user: req.user, entityType, entityId, action: 'view' })
  const result = await pool.request()
    .input('entityType', entityType)
    .input('entityId', entityId)
    .query(`
      select attachment_id, entity_type, entity_id, category, original_name, mime_type, size_bytes,
        storage_provider, uploaded_by_user_id, created_at
      from dbo.attachments
      where entity_type = @entityType and entity_id = @entityId
      order by created_at, attachment_id
    `)
  res.json(result.recordset)
}))

router.post('/:entityType/:entityId', express.raw({ type: () => true, limit: env.attachmentMaxBytes }), asyncHandler(async (req, res) => {
  const entityType = String(req.params.entityType || '').toLowerCase()
  const entityId = String(req.params.entityId || '').trim()
  const originalName = decodedFileName(req.headers['x-file-name'])
  const category = String(req.query.category || 'General').trim().slice(0, 80) || 'General'
  if (!Buffer.isBuffer(req.body) || !req.body.length) throw badRequest('Attachment content is required.')
  const pool = await getPool()
  const config = await assertEntityAccess({ pool, user: req.user, entityType, entityId, action: 'edit' })
  const stored = await saveAttachmentFile({ bytes: req.body, originalName })
  try {
    const result = await pool.request()
      .input('entityType', entityType)
      .input('entityId', entityId)
      .input('category', category)
      .input('originalName', stored.originalName)
      .input('storedName', stored.storedName)
      .input('mimeType', String(req.headers['content-type'] || 'application/octet-stream').slice(0, 160))
      .input('sizeBytes', sql.BigInt, req.body.length)
      .input('storagePath', stored.storagePath)
      .input('uploadedBy', req.user?.userId || null)
      .query(`
        insert into dbo.attachments(entity_type, entity_id, category, original_name, stored_name, mime_type, size_bytes, storage_provider, storage_path, uploaded_by_user_id)
        output inserted.*
        values(@entityType, @entityId, @category, @originalName, @storedName, @mimeType, @sizeBytes, 'filesystem', @storagePath, @uploadedBy)
      `)
    emitChange(req, config, result.recordset[0], 'create')
    res.status(201).json(result.recordset[0])
  } catch (error) {
    await deleteAttachmentFile(stored.storagePath)
    throw error
  }
}))

router.get('/:attachmentId/download', asyncHandler(async (req, res) => {
  const pool = await getPool()
  const attachment = await attachmentById(pool, req.params.attachmentId)
  if (!attachment) throw notFound()
  await assertEntityAccess({ pool, user: req.user, entityType: attachment.entity_type, entityId: attachment.entity_id, action: 'view' })
  const bytes = await readAttachmentFile(attachment.storage_path)
  const encodedName = encodeURIComponent(attachment.original_name)
  res.set('Content-Type', attachment.mime_type || 'application/octet-stream')
  res.set('Content-Length', String(bytes.length))
  res.set('Content-Disposition', `attachment; filename*=UTF-8''${encodedName}`)
  res.send(bytes)
}))

router.delete('/:attachmentId', asyncHandler(async (req, res) => {
  const pool = await getPool()
  const attachment = await attachmentById(pool, req.params.attachmentId)
  if (!attachment) throw notFound()
  const config = await assertEntityAccess({ pool, user: req.user, entityType: attachment.entity_type, entityId: attachment.entity_id, action: 'edit' })
  await pool.request()
    .input('attachmentId', sql.UniqueIdentifier, attachment.attachment_id)
    .query('delete from dbo.attachments where attachment_id = @attachmentId')
  await deleteAttachmentFile(attachment.storage_path).catch(error => {
    console.warn(`Attachment file cleanup pending for ${attachment.attachment_id}: ${error.message}`)
  })
  emitChange(req, config, attachment, 'delete')
  res.json({ deleted: attachment.attachment_id })
}))

export default router

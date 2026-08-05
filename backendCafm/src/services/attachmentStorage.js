import { randomUUID } from 'node:crypto'
import path from 'node:path'
import { mkdir, readFile, unlink, writeFile } from 'node:fs/promises'
import { env } from '../config/env.js'

const safeName = value => path.basename(String(value || 'attachment'))
  .replace(/[\u0000-\u001f<>:"/\\|?*]+/g, '_')
  .slice(0, 240) || 'attachment'

const extensionFor = name => {
  const extension = path.extname(name).replace(/[^a-z0-9.]/gi, '').slice(0, 16)
  return extension.startsWith('.') ? extension : ''
}

export const saveAttachmentFile = async ({ bytes, originalName }) => {
  await mkdir(env.attachmentStoragePath, { recursive: true })
  const cleanOriginalName = safeName(originalName)
  const storedName = `${randomUUID()}${extensionFor(cleanOriginalName)}`
  const absolutePath = path.join(env.attachmentStoragePath, storedName)
  await writeFile(absolutePath, bytes, { flag: 'wx' })
  return { originalName: cleanOriginalName, storedName, storagePath: storedName }
}

const absoluteStoragePath = storagePath => {
  const resolved = path.resolve(env.attachmentStoragePath, String(storagePath || ''))
  const root = `${path.resolve(env.attachmentStoragePath)}${path.sep}`
  if (!resolved.startsWith(root)) throw new Error('Invalid attachment storage path.')
  return resolved
}

export const readAttachmentFile = storagePath => readFile(absoluteStoragePath(storagePath))

export const deleteAttachmentFile = storagePath => unlink(absoluteStoragePath(storagePath)).catch(error => {
  if (error.code !== 'ENOENT') throw error
})

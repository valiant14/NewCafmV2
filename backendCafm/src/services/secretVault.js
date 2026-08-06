import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto'
import { env } from '../config/env.js'

const prefix = 'enc:v1'
const encryptionKey = () => env.connectorSecretKey
  ? createHash('sha256').update(env.connectorSecretKey, 'utf8').digest()
  : null

export const isEncryptedSecret = value => String(value || '').startsWith(`${prefix}:`)

export const encryptSecret = value => {
  const plaintext = String(value || '')
  if (!plaintext || isEncryptedSecret(plaintext)) return plaintext
  const key = encryptionKey()
  if (!key) return plaintext
  const iv = randomBytes(12)
  const cipher = createCipheriv('aes-256-gcm', key, iv)
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()])
  const tag = cipher.getAuthTag()
  return [prefix, iv.toString('base64'), tag.toString('base64'), encrypted.toString('base64')].join(':')
}

export const decryptSecret = value => {
  const stored = String(value || '')
  if (!stored || !isEncryptedSecret(stored)) return stored
  const key = encryptionKey()
  if (!key) throw new Error('CONNECTOR_SECRET_KEY is required to decrypt connector credentials.')
  const [, , ivValue, tagValue, encryptedValue] = stored.split(':')
  if (!ivValue || !tagValue || !encryptedValue) throw new Error('The stored connector credential is invalid.')
  try {
    const decipher = createDecipheriv('aes-256-gcm', key, Buffer.from(ivValue, 'base64'))
    decipher.setAuthTag(Buffer.from(tagValue, 'base64'))
    return Buffer.concat([
      decipher.update(Buffer.from(encryptedValue, 'base64')),
      decipher.final()
    ]).toString('utf8')
  } catch {
    throw new Error('Unable to decrypt the connector credential. Verify CONNECTOR_SECRET_KEY.')
  }
}

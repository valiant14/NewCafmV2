import sql from 'mssql'
import { env } from '../config/env.js'

let poolPromise
let activePool

const createPool = () => {
  const pool = new sql.ConnectionPool(env.db)

  pool.on('error', error => {
    console.error('MSSQL pool error:', error.message)
    if (activePool === pool) {
      activePool = undefined
      poolPromise = undefined
    }
  })

  poolPromise = pool.connect()
    .then(connected => {
      activePool = connected
      return connected
    })
    .catch(async error => {
      poolPromise = undefined
      activePool = undefined
      await pool.close().catch(() => {})
      throw error
    })

  return poolPromise
}

export const getPool = async () => {
  if (activePool?.connected && activePool.healthy) return activePool
  if (activePool) {
    const stale = activePool
    activePool = undefined
    poolPromise = undefined
    await stale.close().catch(() => {})
  }
  if (!poolPromise) return createPool()
  return poolPromise
}

export const getPoolStats = () => ({
  connected: Boolean(activePool?.connected),
  healthy: Boolean(activePool?.healthy),
  size: activePool?.size || 0,
  available: activePool?.available || 0,
  borrowed: activePool?.borrowed || 0,
  pending: activePool?.pending || 0,
  max: env.db.pool.max
})

export const closePool = async () => {
  const pool = activePool
  activePool = undefined
  poolPromise = undefined
  if (pool) await pool.close()
}

export { sql }

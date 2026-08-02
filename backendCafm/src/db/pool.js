import sql from 'mssql'
import { env } from '../config/env.js'

let poolPromise

export const getPool = async () => {
  if (!poolPromise) {
    poolPromise = sql.connect(env.db)
  }
  return poolPromise
}

export { sql }

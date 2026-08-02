import { sql } from '../db/pool.js'

const typeFor = value => {
  if (typeof value === 'number') return Number.isInteger(value) ? sql.Int : sql.Decimal(18, 4)
  if (typeof value === 'boolean') return sql.Bit
  if (value instanceof Date) return sql.DateTime2
  return sql.NVarChar(sql.MAX)
}

export const bindParams = (request, values = {}) => {
  Object.entries(values).forEach(([key, value]) => {
    request.input(key, typeFor(value), value)
  })
  return request
}

import { api } from './api'

export const upsertImportRows = async ({ rows = [], endpoint, key, mapRow }) => {
  const saved = []
  for (const row of rows) {
    const payload = mapRow(row)
    const id = payload?.[key]
    if (!id) continue
    try {
      saved.push(await api.put(`${endpoint}/${encodeURIComponent(id)}`, payload))
    } catch (error) {
      if (error.status !== 404) throw error
      saved.push(await api.post(endpoint, payload))
    }
  }
  return saved
}

export const pick = (row, keys, fallback = '') => {
  for (const key of keys) {
    const value = row?.[key]
    if (value !== undefined && value !== null && String(value).trim() !== '') return value
  }
  return fallback
}

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { loadRelatedWorkOrders } from '../services/api'

const filterKey = filters => JSON.stringify(filters || {})

export default function useRelatedWorkOrders(filters, { enabled = true, limit = 100 } = {}) {
  const key = useMemo(() => filterKey(filters), [filters])
  const stableFilters = useMemo(() => JSON.parse(key), [key])
  const [state, setState] = useState({ rows: [], total: 0, loading: false, error: '' })
  const requestRef = useRef(0)

  const refresh = useCallback(async () => {
    const requestId = ++requestRef.current
    if (!enabled || !Object.keys(stableFilters).length) {
      setState({ rows: [], total: 0, loading: false, error: '' })
      return
    }
    setState(current => ({ ...current, loading: true, error: '' }))
    try {
      const result = await loadRelatedWorkOrders(stableFilters, { limit })
      if (requestRef.current !== requestId) return
      setState({ ...result, loading: false, error: '' })
    } catch (error) {
      if (requestRef.current !== requestId) return
      setState(current => ({ ...current, loading: false, error: error.message || 'Unable to load related work orders.' }))
    }
  }, [enabled, limit, stableFilters])

  useEffect(() => {
    refresh()
  }, [refresh])

  useEffect(() => {
    if (!enabled) return undefined
    const onChange = event => {
      if (String(event.detail?.table || '').toLowerCase() === 'dbo.work_orders') refresh()
    }
    window.addEventListener('cafm:workspace-change', onChange)
    return () => window.removeEventListener('cafm:workspace-change', onChange)
  }, [enabled, refresh])

  return { ...state, refresh }
}

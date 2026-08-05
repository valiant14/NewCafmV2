import { useCallback, useEffect, useState } from 'react'
import { attachmentApi } from '../services/api'

export default function useEntityAttachments(entityType, entityId, { enabled = true, onError } = {}) {
  const [attachments, setAttachments] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const refresh = useCallback(async () => {
    if (!enabled || !entityId || entityId === 'AUTO') {
      setAttachments([])
      return []
    }
    setLoading(true)
    setError('')
    try {
      const rows = await attachmentApi.list(entityType, String(entityId))
      setAttachments(rows)
      return rows
    } catch (error) {
      setError(error.message || 'Unable to load attachments.')
      onError?.(error)
      return []
    } finally {
      setLoading(false)
    }
  }, [enabled, entityId, entityType, onError])

  useEffect(() => { refresh() }, [refresh])
  useEffect(() => {
    const onWorkspaceChange = event => {
      const change = event.detail || {}
      if (change.table !== 'dbo.attachments') return
      if (String(change.entityType || '') !== String(entityType) || String(change.entityId || '') !== String(entityId)) return
      refresh()
    }
    window.addEventListener('cafm:workspace-change', onWorkspaceChange)
    return () => window.removeEventListener('cafm:workspace-change', onWorkspaceChange)
  }, [entityId, entityType, refresh])

  const uploadFiles = useCallback(async (files, category = 'General') => {
    setError('')
    try {
      const uploaded = []
      for (const file of files) uploaded.push(await attachmentApi.upload(entityType, String(entityId), file, category))
      setAttachments(current => [...current, ...uploaded.filter(row => !current.some(existing => existing.attachmentId === row.attachmentId))])
      return uploaded
    } catch (uploadError) {
      setError(uploadError.message || 'Unable to upload attachment.')
      throw uploadError
    }
  }, [entityId, entityType])

  const removeAttachment = useCallback(async attachment => {
    setError('')
    try {
      await attachmentApi.remove(attachment.attachmentId)
      setAttachments(current => current.filter(row => row.attachmentId !== attachment.attachmentId))
    } catch (removeError) {
      setError(removeError.message || 'Unable to remove attachment.')
      throw removeError
    }
  }, [])

  const downloadAttachment = useCallback(attachment => attachmentApi.download(attachment), [])

  return { attachments, loading, error, refresh, uploadFiles, removeAttachment, downloadAttachment }
}

import { useCallback, useEffect, useState } from 'react'
import { attachmentApi } from '../services/api'
import { useToast } from '../providers/ToastProvider'

export default function useEntityAttachments(entityType, entityId, { enabled = true, onError } = {}) {
  const { error: notifyError, success: notifySuccess } = useToast()
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
      const message = error.message || 'Unable to load attachments.'
      setError(message)
      notifyError(message)
      onError?.(error)
      return []
    } finally {
      setLoading(false)
    }
  }, [enabled, entityId, entityType, notifyError, onError])

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
      notifySuccess(`${uploaded.length} attachment${uploaded.length === 1 ? '' : 's'} uploaded.`)
      return uploaded
    } catch (uploadError) {
      const message = uploadError.message || 'Unable to upload attachment.'
      setError(message)
      notifyError(message)
      throw uploadError
    }
  }, [entityId, entityType, notifyError, notifySuccess])

  const removeAttachment = useCallback(async attachment => {
    setError('')
    try {
      await attachmentApi.remove(attachment.attachmentId)
      setAttachments(current => current.filter(row => row.attachmentId !== attachment.attachmentId))
      notifySuccess('Attachment removed.')
    } catch (removeError) {
      const message = removeError.message || 'Unable to remove attachment.'
      setError(message)
      notifyError(message)
      throw removeError
    }
  }, [notifyError, notifySuccess])

  const downloadAttachment = useCallback(async attachment => {
    try {
      await attachmentApi.download(attachment)
      notifySuccess(`${attachment.fileName || 'Attachment'} downloaded.`)
    } catch (downloadError) {
      notifyError(downloadError.message || 'Unable to download attachment.')
      throw downloadError
    }
  }, [notifyError, notifySuccess])

  return { attachments, loading, error, refresh, uploadFiles, removeAttachment, downloadAttachment }
}

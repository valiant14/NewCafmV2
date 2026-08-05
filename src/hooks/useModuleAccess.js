import { useMemo } from 'react'
import { canUseAction } from '../lib/accessControl'
import { useAuth } from '../providers/AuthProvider'

const actions = ['view', 'create', 'edit', 'approve', 'close', 'import']

export default function useModuleAccess(moduleName) {
  const { user } = useAuth()
  return useMemo(() => Object.fromEntries(
    actions.map(action => [action, canUseAction(user, moduleName, action)])
  ), [moduleName, user])
}

import { Navigate, Outlet } from 'react-router-dom'
import { useGroup } from '@/contexts/GroupContext'
import { Spinner } from './ui/Spinner'

// Pages that need an active group send people to the group chooser first.
export function RequireGroup() {
  const { activeGroup, loading } = useGroup()
  if (loading) {
    return <div className="center-screen"><Spinner size={32} /></div>
  }
  if (!activeGroup) return <Navigate to="/groups" replace />
  return <Outlet />
}

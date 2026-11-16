import { Navigate, Outlet } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'
import { Spinner } from './ui/Spinner'

export function ProtectedRoute() {
  const { user, loading } = useAuth()
  if (loading) {
    return <div className="center-screen"><Spinner size={32} /></div>
  }
  if (!user) return <Navigate to="/login" replace />
  return <Outlet />
}

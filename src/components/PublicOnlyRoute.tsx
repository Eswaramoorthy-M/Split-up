import { Navigate, Outlet } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'
import { Spinner } from './ui/Spinner'

// Login, register and forgot-password are only for logged-out visitors.
// Someone with a saved login is sent straight to the app.
export function PublicOnlyRoute() {
  const { user, loading } = useAuth()
  if (loading) return <div className="center-screen"><Spinner size={32} /></div>
  if (user) return <Navigate to="/dashboard" replace />
  return <Outlet />
}

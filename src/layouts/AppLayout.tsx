import { Outlet } from 'react-router-dom'
import { BottomNav } from '@/components/BottomNav'
import { FAB } from '@/components/FAB'
import { ConfirmDialogHost } from '@/components/ui/ConfirmDialog'

export function AppLayout() {
  return (
    <div className="app-shell">
      <main className="app-main">
        <Outlet />
      </main>
      <FAB />
      <BottomNav />
      <ConfirmDialogHost />
    </div>
  )
}

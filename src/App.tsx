import { Suspense, lazy } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import { ProtectedRoute } from '@/components/ProtectedRoute'
import { PublicOnlyRoute } from '@/components/PublicOnlyRoute'
import { RequireGroup } from '@/components/RequireGroup'
import { AppLayout } from '@/layouts/AppLayout'
import { Spinner } from '@/components/ui/Spinner'

// Auth pages are on the critical first-load path, so they stay eager.
import Login from '@/features/auth/pages/Login'
import Register from '@/features/auth/pages/Register'
import ForgotPassword from '@/features/auth/pages/ForgotPassword'
import ResetPassword from '@/features/auth/pages/ResetPassword'

// Everything else lazy-loads: keeps the initial bundle small on mobile
// networks, per the app's performance requirements.
const CreateGroup = lazy(() => import('@/features/groups/pages/CreateGroup'))
const JoinGroup = lazy(() => import('@/features/groups/pages/JoinGroup'))
const GroupSelect = lazy(() => import('@/features/groups/pages/GroupSelect'))
const Members = lazy(() => import('@/features/groups/pages/Members'))
const MemberDetails = lazy(() => import('@/features/groups/pages/MemberDetails'))
const Categories = lazy(() => import('@/features/groups/pages/Categories'))
const GroupSettings = lazy(() => import('@/features/groups/pages/GroupSettings'))

const Dashboard = lazy(() => import('@/features/dashboard/pages/Dashboard'))
const More = lazy(() => import('@/features/dashboard/pages/More'))

const AddExpense = lazy(() => import('@/features/expenses/pages/AddExpense'))
const EditExpense = lazy(() => import('@/features/expenses/pages/EditExpense'))
const ExpenseDetails = lazy(() => import('@/features/expenses/pages/ExpenseDetails'))
const ExpenseHistory = lazy(() => import('@/features/expenses/pages/ExpenseHistory'))

const SettleUp = lazy(() => import('@/features/settlements/pages/SettleUp'))
const SettlementDetails = lazy(() => import('@/features/settlements/pages/SettlementDetails'))
const PayWithUpi = lazy(() => import('@/features/settlements/pages/PayWithUpi'))
const UpiTransactions = lazy(() => import('@/features/settlements/pages/UpiTransactions'))

// Monthly Report pulls in recharts, the single heaviest dependency, so it
// gets its own chunk that only loads when the person opens Reports.
const MonthlyReport = lazy(() => import('@/features/reports/pages/MonthlyReport'))
const ManageExpenses = lazy(() => import('@/features/manage/pages/ManageExpenses'))
const Notifications = lazy(() => import('@/features/notifications/pages/Notifications'))
const Profile = lazy(() => import('@/features/profile/pages/Profile'))

function PageFallback() {
  return (
    <div className="center-spinner">
      <Spinner size={24} />
    </div>
  )
}

export default function App() {
  return (
    <Suspense fallback={<PageFallback />}>
    <Routes>
      <Route element={<PublicOnlyRoute />}>
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="/forgot-password" element={<ForgotPassword />} />
      </Route>
      <Route path="/reset-password" element={<ResetPassword />} />

      <Route element={<ProtectedRoute />}>
        <Route path="/groups" element={<GroupSelect />} />
        <Route path="/groups/create" element={<CreateGroup />} />
        <Route path="/groups/join" element={<JoinGroup />} />

        <Route element={<RequireGroup />}>
          <Route element={<AppLayout />}>
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/expenses" element={<ExpenseHistory />} />
            <Route path="/expenses/new" element={<AddExpense />} />
            <Route path="/expenses/:id" element={<ExpenseDetails />} />
            <Route path="/expenses/:id/edit" element={<EditExpense />} />
            <Route path="/manage" element={<ManageExpenses />} />
            <Route path="/settle" element={<SettleUp />} />
            <Route path="/upi/pay" element={<PayWithUpi />} />
            <Route path="/upi/transactions" element={<UpiTransactions />} />
            <Route path="/settlements/:id" element={<SettlementDetails />} />
            <Route path="/reports" element={<MonthlyReport />} />
            <Route path="/more" element={<More />} />
            <Route path="/members" element={<Members />} />
            <Route path="/members/:userId" element={<MemberDetails />} />
            <Route path="/categories" element={<Categories />} />
            <Route path="/group-settings" element={<GroupSettings />} />
            <Route path="/notifications" element={<Notifications />} />
            <Route path="/profile" element={<Profile />} />
          </Route>
        </Route>
      </Route>

      <Route path="/" element={<Navigate to="/dashboard" replace />} />
      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
    </Suspense>
  )
}

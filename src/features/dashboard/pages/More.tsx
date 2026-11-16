import { Link } from 'react-router-dom'
import { useGroup } from '@/contexts/GroupContext'
import { Card } from '@/components/ui/Card'
import { Icon } from '@/components/ui/Icon'
import { InstallAppCard } from '@/components/InstallAppCard'
import { FEATURES } from '@/config/features'

export default function More() {
  const { activeMembership } = useGroup()
  const isAdmin = activeMembership?.role === 'admin'

  const items = [
    { to: '/upi/pay', label: 'Pay with UPI', icon: 'wallet' },
    ...(FEATURES.settlements.adminUpiDashboard && isAdmin
      ? [{ to: '/upi/transactions', label: 'UPI transactions', icon: 'banknote' }]
      : []),
    { to: '/manage', label: 'Manage expenses', icon: 'sliders' },
    { to: '/members', label: 'Members', icon: 'users' },
    { to: '/categories', label: 'Categories', icon: 'tag' },
    { to: '/group-settings', label: 'Group settings', icon: 'settings' },
    { to: '/notifications', label: 'Notifications', icon: 'bell' },
    { to: '/profile', label: 'Profile', icon: 'user' },
    { to: '/groups', label: 'Switch group', icon: 'repeat' }
  ]

  return (
    <div>
      <h1 className="page-title">More</h1>
      <Card className="menu-group mt-lg">
        {items.map(i => (
          <Link key={i.to} to={i.to} className="menu-item">
            <span className="menu-icon" aria-hidden="true"><Icon name={i.icon} size={20} /></span>
            <span className="fw-medium">{i.label}</span>
            <Icon name="chevronRight" size={18} className="chevron-end" />
          </Link>
        ))}
      </Card>
      <div className="mt-lg"><InstallAppCard /></div>
    </div>
  )
}

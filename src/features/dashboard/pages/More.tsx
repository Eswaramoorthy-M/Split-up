import { Link } from 'react-router-dom'
import { useGroup } from '@/contexts/GroupContext'
import { useTheme } from '@/contexts/ThemeContext'
import { Card } from '@/components/ui/Card'
import { Icon } from '@/components/ui/Icon'
import { ThemeToggle } from '@/components/ui/ThemeToggle'
import { InstallAppCard } from '@/components/InstallAppCard'
import { FEATURES } from '@/config/features'

export default function More() {
  const { activeMembership } = useGroup()
  const { theme } = useTheme()
  const isAdmin = activeMembership?.role === 'admin'
  const isDark = theme === 'dark'

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
      <Card className="appearance-card mt-lg">
        <div className="appearance-row">
          <span className="appearance-icon" aria-hidden="true">
            <Icon name={isDark ? 'moon' : 'sun'} size={20} />
          </span>
          <div className="appearance-copy">
            <p className="appearance-title">Appearance</p>
            <p className="appearance-sub">{isDark ? 'Dark theme is on' : 'Light theme is on'}</p>
          </div>
          <ThemeToggle />
        </div>
      </Card>
      <div className="mt-lg"><InstallAppCard /></div>
    </div>
  )
}

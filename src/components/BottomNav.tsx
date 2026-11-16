import { NavLink } from 'react-router-dom'
import clsx from 'clsx'
import { Icon, LogoMark } from './ui/Icon'

const items = [
  { to: '/dashboard', label: 'Home', icon: 'home' },
  { to: '/expenses', label: 'Expenses', icon: 'receipt' },
  { to: '/settle', label: 'Settle', icon: 'exchange' },
  { to: '/reports', label: 'Reports', icon: 'chart' },
  { to: '/more', label: 'More', icon: 'grid' }
]

export function BottomNav() {
  return (
    <nav className="bottom-nav" aria-label="Main">
      <div className="nav-brand" aria-hidden="true">
        <LogoMark size={30} />
        <span className="brand-word">SplitUp</span>
      </div>
      <ul className="bottom-nav-list">
        {items.map(item => (
          <li key={item.to} className="bottom-nav-item">
            <NavLink to={item.to} className={({ isActive }) => clsx('bottom-nav-link', isActive && 'active')}>
              <span className="bottom-nav-icon" aria-hidden="true"><Icon name={item.icon} size={21} /></span>
              {item.label}
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  )
}

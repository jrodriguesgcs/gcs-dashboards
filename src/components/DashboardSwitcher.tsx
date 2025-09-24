import { NavLink } from 'react-router-dom'

export function DashboardSwitcher() {
  return (
    <nav className="switcher">
      {[
        { to: '/sales', label: 'Sales' },
        { to: '/sdr', label: 'SDR' },
        { to: '/marketing', label: 'Marketing UTM' },
      ].map(t => (
        <NavLink
          key={t.to}
          to={t.to}
          className={({ isActive }) => 'switch-btn' + (isActive ? ' active' : '')}
        >
          {t.label}
        </NavLink>
      ))}
    </nav>
  )
}

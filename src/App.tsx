import { Routes, Route, Navigate } from 'react-router-dom'
import { DashboardSwitcher } from './components/DashboardSwitcher'
import SalesDashboard from './pages/SalesDashboard'
import SdrDashboard from './pages/SdrDashboard'
import MarketingDashboard from './pages/MarketingDashboard'

export default function App() {
  return (
    <div className="app-wrap">
      <header className="app-header">
        <h1 className="fs-display-md fw-bold" style={{color:'var(--color-night-blue)'}}>
          Global Citizen Solutions Dashboards
        </h1>
      </header>

      <DashboardSwitcher />

      <Routes>
        <Route path="/" element={<Navigate to="/sales" replace />} />
        <Route path="/sales" element={<SalesDashboard />} />
        <Route path="/sdr" element={<SdrDashboard />} />
        <Route path="/marketing" element={<MarketingDashboard />} />
      </Routes>
    </div>
  )
}

import { useEffect, useState } from 'react'
import DataTable from '../components/DataTable'

export default function MarketingDashboard() {
  const [rows, setRows] = useState<any[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    setLoading(true)
    fetch('/.netlify/functions/marketing')
      .then(r => r.json())
      .then(d => setRows(d.rows ?? []))
      .finally(() => setLoading(false))
  }, [])

  return (
    <section className="dash-section">
      <h3>Marketing UTM Dashboard</h3>
      <DataTable loading={loading} rows={rows} />
    </section>
  )
}

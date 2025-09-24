import { useEffect, useMemo, useState } from 'react'
import DataTable from '../components/DataTable'

export default function SalesDashboard() {
  const [params, setParams] = useState<{[k:string]:string}>({})
  const [rows, setRows] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const qs = useMemo(() => new URLSearchParams(params).toString(), [params])

  useEffect(() => {
    setLoading(true)
    fetch('/.netlify/functions/sales?' + qs)
      .then(r => r.json())
      .then(d => setRows(d.rows ?? []))
      .finally(() => setLoading(false))
  }, [qs])

  return (
    <section className="dash-section">
      <div className="filters-card">
        <div className="filters-grid">
          {['createdMonth','distributedMonth','callMonth','proposalMonth','pipeline'].map(k => (
            <label key={k}>
              <span>{k.replace('Month','').replace(/^\w/, s => s.toUpperCase())}</span>
              {k === 'pipeline'
                ? <input type="text" placeholder="(optional)" onChange={e => setParams(p => ({...p, pipeline: e.target.value}))} />
                : <input type="month" onChange={e => setParams(p => ({...p, [k]: e.target.value}))} />}
            </label>
          ))}
        </div>
      </div>

      <h3>Deals (with derived time intervals)</h3>
      <DataTable
        loading={loading}
        rows={rows}
        columns={[
          { key:'title', label:'Title' },
          { key:'pipeline', label:'Pipeline' },
          { key:'stage', label:'Stage' },
          { key:'value', label:'Value' },
          { key:'time_to_distribution_min', label:'Time to Distribution (min)' },
          { key:'time_to_booking_days', label:'Time to Booking (days)' },
          { key:'time_to_connection_days', label:'Time to Connection (days)' },
          { key:'distribution_to_show_days', label:'Distribution → Show Call (days)' },
          { key:'time_to_proposal_min', label:'Time to Proposal (min)' },
          { key:'time_to_close_days', label:'Time to Close (days)' },
          { key:'created_day_of_week', label:'Created Day of Week' },
          { key:'created_hour', label:'Created Hour' }
        ]}
      />
    </section>
  )
}

// src/pages/SalesDashboard.tsx
import { useEffect, useMemo, useState } from 'react'
import { Tabs } from '../components/Tabs'
import { Kpi } from '../components/Kpi'
import MultiSelect from '../components/MultiSelect'
import GroupTable from '../components/GroupTable'
import PagedTable from '../components/PagedTable'

async function fetchJSON(url: string) {
  const r = await fetch(url)
  if (!r.ok) {
    const text = await r.text()
    throw new Error(`HTTP ${r.status}: ${text.slice(0,300)}`)
  }
  return r.json()
}

type OwnerAgg = {
  owner: string
  created: number; distributed: number; calls_scheduled: number; calls_completed: number; proposals: number; closed_won: number
  conv_created_to_distributed: number; conv_distributed_to_scheduled: number; conv_scheduled_to_completed: number; conv_completed_to_proposal: number; conv_proposal_to_won: number
}
type TimeStats = {
  owner: string
  t_dist_avg: number|null; t_dist_med: number|null; t_dist_modes: string;
  t_booking_avg: number|null; t_booking_med: number|null; t_booking_modes: string;
  t_conn_avg: number|null; t_conn_med: number|null; t_conn_modes: string;
  t_dist_show_avg: number|null; t_dist_show_med: number|null; t_dist_show_modes: string;
  t_prop_avg: number|null; t_prop_med: number|null; t_prop_modes: string;
  t_close_avg: number|null; t_close_med: number|null; t_close_modes: string;
}

export default function SalesDashboard() {
  const [owners, setOwners] = useState<string[]>([])
  const [ownersSelected, setOwnersSelected] = useState<string[]>([])
  const [months, setMonths] = useState<{[k:string]:string}>({})
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string|undefined>()

  const qs = useMemo(() => {
    const sp = new URLSearchParams()
    Object.entries(months).forEach(([k,v]) => v && sp.set(k,v))
    if (ownersSelected.length) sp.set('owners', ownersSelected.join('||'))
    return sp.toString()
  }, [months, ownersSelected])

  const [overview, setOverview] = useState<{created:number; distributed:number; calls_scheduled:number; calls_completed:number; proposals:number; closed_won:number}>()
  const [ownerTable, setOwnerTable] = useState<OwnerAgg[]>([])
  const [timeTable, setTimeTable] = useState<TimeStats[]>([])
  const [breakdown, setBreakdown] = useState<any[]>([])

  useEffect(() => {
    (async () => {
      try {
        setLoading(true); setError(undefined)
        // CHANGED: Updated API endpoint for Vercel
        const d = await fetchJSON('/api/sales/meta')
        const o = (d.owners || []) as string[]
        setOwners(o.sort((a,b)=>a.localeCompare(b)))
        setOwnersSelected(o)
      } catch (e:any) {
        setError(`Failed to load owners: ${e.message || String(e)}`)
      } finally {
        setLoading(false)
      }
    })()
  }, [])

  useEffect(() => {
    (async () => {
      try {
        setLoading(true); setError(undefined)
        // CHANGED: Updated API endpoint for Vercel
        const d = await fetchJSON('/api/sales?' + qs)
        setOverview(d.tabs?.overview)
        setOwnerTable(d.tabs?.ownerConversion || [])
        setTimeTable(d.tabs?.timeIntervals || [])
        setBreakdown(d.tabs?.breakdown || [])
      } catch (e:any) {
        setError(`Failed to load sales data: ${e.message || String(e)}`)
      } finally {
        setLoading(false)
      }
    })()
  }, [qs])

  // Rest of component remains the same...
  return (
    <section className="grid" style={{gap:12}}>
      {error && <div className="card pad" style={{border:'2px solid #f66', background:'#fff5f5'}}>
        <div className="fw-bold" style={{color:'#b00020'}}>Error</div>
        <div className="fs-text-sm">{error}</div>
      </div>}

      <div className="grid" style={{gridTemplateColumns:'2fr 1fr', gap:12}}>
        <div className="card pad">
          <div className="fs-text-lg fw-semibold" style={{marginBottom:8}}>Filters</div>
          <div className="grid auto">
            {['createdMonth','distributedMonth','callMonth','proposalMonth'].map(k => (
              <label key={k} className="fs-text-sm fw-semibold">
                {k.replace('Month','').replace(/^\w/, s=>s.toUpperCase())} Month
                <input className="btn" type="month" onChange={e => setMonths(m => ({...m, [k]: e.target.value}))} />
              </label>
            ))}
          </div>
        </div>
        <MultiSelect label="Owner Name" options={owners} value={ownersSelected} onChange={setOwnersSelected} />
      </div>

      {overview && (
        <div className="grid" style={{gridTemplateColumns:'repeat(auto-fit, minmax(160px,1fr))', gap:12}}>
          <Kpi label="Created" value={overview.created} />
          <Kpi label="Distributed" value={overview.distributed} />
          <Kpi label="Calls Scheduled" value={overview.calls_scheduled} />
          <Kpi label="Calls Completed" value={overview.calls_completed} />
          <Kpi label="Proposals Sent" value={overview.proposals} />
          <Kpi label="Closed Won" value={overview.closed_won} />
        </div>
      )}

      <Tabs
        tabs={[
          {
            key:'owner',
            label:'Owner Conversion',
            content: <PagedTable
              rows={ownerTable}
              columns={[
                {key:'owner', label:'Owner'},
                {key:'created', label:'Created'},
                {key:'distributed', label:'Distributed'},
                {key:'calls_scheduled', label:'Calls Scheduled'},
                {key:'calls_completed', label:'Calls Completed'},
                {key:'proposals', label:'Proposals Sent'},
                {key:'closed_won', label:'Closed Won'},
                {key:'conv_created_to_distributed', label:'Created→Distributed %'},
                {key:'conv_distributed_to_scheduled', label:'Distributed→Scheduled %'},
                {key:'conv_scheduled_to_completed', label:'Scheduled→Completed %'},
                {key:'conv_completed_to_proposal', label:'Completed→Proposal %'},
                {key:'conv_proposal_to_won', label:'Proposal→Won %'}
              ]}
            />
          },
          {
            key:'time',
            label:'Time Intervals (avg/med/mode)',
            content: <PagedTable
              rows={timeTable}
              columns={[
                {key:'owner', label:'Owner'},
                {key:'t_dist_avg', label:'T Dist (min) avg'},
                {key:'t_dist_med', label:'T Dist (min) med'},
                {key:'t_dist_modes', label:'T Dist modes'},
                {key:'t_booking_avg', label:'T Booking (days) avg'},
                {key:'t_booking_med', label:'T Booking (days) med'},
                {key:'t_booking_modes', label:'T Booking modes'},
                {key:'t_conn_avg', label:'T Connection (days) avg'},
                {key:'t_conn_med', label:'T Connection (days) med'},
                {key:'t_conn_modes', label:'T Connection modes'},
                {key:'t_dist_show_avg', label:'Dist→Show (days) avg'},
                {key:'t_dist_show_med', label:'Dist→Show (days) med'},
                {key:'t_dist_show_modes', label:'Dist→Show modes'},
                {key:'t_prop_avg', label:'T Proposal (min) avg'},
                {key:'t_prop_med', label:'T Proposal (min) med'},
                {key:'t_prop_modes', label:'T Proposal modes'},
                {key:'t_close_avg', label:'T Close (days) avg'},
                {key:'t_close_med', label:'T Close (days) med'},
                {key:'t_close_modes', label:'T Close modes'}
              ]}
            />
          },
          {
            key:'breakdown',
            label:'Breakdown (Country → Program)',
            content: <GroupTable
              data={breakdown}
              columns={[
                {key:'created', label:'Created'},
                {key:'distributed', label:'Distributed'},
                {key:'calls_scheduled', label:'Calls Scheduled'},
                {key:'calls_completed', label:'Calls Completed'},
                {key:'proposals', label:'Proposals Sent'},
                {key:'closed_won', label:'Closed Won'}
              ]}
            />
          }
        ]}
      />
      {loading && <div className="muted">Loading…</div>}
    </section>
  )
}
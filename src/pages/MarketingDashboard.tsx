import { useEffect, useMemo, useState } from 'react'
import { Tabs } from '../components/Tabs'
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

type GroupNode = { key:string; label:string; metrics?:Record<string,number>; children?:GroupNode[] }

export default function MarketingDashboard() {
  const [ranges, setRanges] = useState<{[k:string]:{from?:string; to?:string}}>({})
  const [contactOnly, setContactOnly] = useState(false)
  const [tabData, setTabData] = useState<{utm:GroupNode[]; firstTouch:GroupNode[]; ftSubmission:GroupNode[]; submission:GroupNode[]}>()
  const [sampleRows, setSampleRows] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string|undefined>()

  const qs = useMemo(() => {
    const sp = new URLSearchParams()
    Object.entries(ranges).forEach(([k,v]) => { if (v.from) sp.set(k+'From', v.from); if (v.to) sp.set(k+'To', v.to) })
    if (contactOnly) sp.set('contactOnly', '1')
    return sp.toString()
  }, [ranges, contactOnly])

  useEffect(() => {
    (async () => {
      try {
        setLoading(true); setError(undefined)
        const d = await fetchJSON('/.netlify/functions/marketing?' + qs)
        setTabData(d.tabs)
        setSampleRows(d.sampleRows ?? [])
      } catch (e:any) {
        setError(`Failed to load marketing data: ${e.message || String(e)}`)
      } finally {
        setLoading(false)
      }
    })()
  }, [qs])

  const filters = (
    <div className="card pad" style={{marginBottom:12}}>
      <div className="fs-text-lg fw-semibold" style={{marginBottom:8}}>Filters</div>

      {/* vertical orientation */}
      <div className="grid" style={{gridTemplateColumns:'1fr', gap:12}}>
        {[
          ['contactCreated','Contact Created'],
          ['dealCreated','Deal Created'],
          ['distributed','Distribution'],
          ['proposalSent','Proposal Sent'],
          ['proposalSigned','Proposal Signed'],
        ].map(([key,label]) => (
          <div key={key} className="grid" style={{gridTemplateColumns:'1fr', gap:6}}>
            <label className="fs-text-sm fw-semibold">{label} From</label>
            <input className="btn" type="date"
              onChange={e => setRanges(r => ({...r, [key]: {...r[key], from: e.target.value}}))}
            />
            <label className="fs-text-sm fw-semibold" style={{marginTop:6}}>{label} To</label>
            <input className="btn" type="date"
              onChange={e => setRanges(r => ({...r, [key]: {...r[key], to: e.target.value}}))}
            />
          </div>
        ))}
      </div>

      <div style={{marginTop:12}}>
        <label><input type="checkbox" checked={contactOnly} onChange={e=>setContactOnly(e.target.checked)} /> Filter only by contact created date</label>
      </div>
    </div>
  )

  return (
    <section className="grid" style={{gap:12}}>
      {error && <div className="card pad" style={{border:'2px solid #f66', background:'#fff5f5'}}>
        <div className="fw-bold" style={{color:'#b00020'}}>Error</div>
        <div className="fs-text-sm">{error}</div>
      </div>}

      {filters}
      <Tabs
        tabs={[
          {
            key:'utm',
            label:'UTM Analysis',
            content: tabData ? <GroupTable data={tabData.utm} columns={[
              {key:'contacts', label:'Contacts'},
              {key:'deals_created', label:'Deals Created'},
              {key:'distributed', label:'Distributed'},
              {key:'calls_scheduled', label:'Calls Scheduled'},
              {key:'calls_completed', label:'Calls Completed'},
              {key:'proposals', label:'Proposals Sent'},
              {key:'closed_won', label:'Closed Won'}
            ]} /> : null
          },
          {
            key:'firstTouch',
            label:'First Touch Analysis',
            content: tabData ? <GroupTable data={tabData.firstTouch} columns={[
              {key:'contacts', label:'Contacts'},
              {key:'deals_created', label:'Deals Created'},
              {key:'distributed', label:'Distributed'},
              {key:'calls_scheduled', label:'Calls Scheduled'},
              {key:'calls_completed', label:'Calls Completed'},
              {key:'proposals', label:'Proposals Sent'},
              {key:'closed_won', label:'Closed Won'}
            ]} /> : null
          },
          {
            key:'ftSubmission',
            label:'First Touch Submission Page',
            content: tabData ? <GroupTable data={tabData.ftSubmission} columns={[
              {key:'contacts', label:'Contacts'},
              {key:'deals_created', label:'Deals Created'},
              {key:'distributed', label:'Distributed'},
              {key:'calls_scheduled', label:'Calls Scheduled'},
              {key:'calls_completed', label:'Calls Completed'},
              {key:'proposals', label:'Proposals Sent'},
              {key:'closed_won', label:'Closed Won'}
            ]} /> : null
          },
          {
            key:'submission',
            label:'Submission Page',
            content: tabData ? <GroupTable data={tabData.submission} columns={[
              {key:'contacts', label:'Contacts'},
              {key:'deals_created', label:'Deals Created'},
              {key:'distributed', label:'Distributed'},
              {key:'calls_scheduled', label:'Calls Scheduled'},
              {key:'calls_completed', label:'Calls Completed'},
              {key:'proposals', label:'Proposals Sent'},
              {key:'closed_won', label:'Closed Won'}
            ]} /> : null
          }
        ]}
      />
      {false && <PagedTable rows={sampleRows} columns={[
        {key:'contact_id', label:'Contact'},
        {key:'email_masked', label:'Email'},
        {key:'utm_medium', label:'UTM Medium'},
        {key:'utm_source', label:'UTM Source'},
        {key:'utm_campaign', label:'UTM Campaign'}
      ]} pageSize={100} />}
      {loading && <div className="muted">Loading…</div>}
    </section>
  )
}

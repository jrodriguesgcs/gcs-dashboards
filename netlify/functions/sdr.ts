import { Handler } from '@netlify/functions'
import { db } from './_db'
import { diffMinutes, diffDays, monthKey } from './_time'
import { SDR_FIELD, COUNTRY_FIELD, PROGRAM_FIELD, avg, median, topModes } from './_util'

const handler: Handler = async (event) => {
  const qp = event.queryStringParameters || {}
  const metaOnly = event.path.endsWith('/meta')
  const createdMonth = qp.createdMonth || ''
  const distributedMonth = qp.distributedMonth || ''
  const callMonth = qp.callMonth || ''
  const proposalMonth = qp.proposalMonth || ''
  const agents = (qp.agents || '').split('||').filter(Boolean)

  const client = db()
  const rowsRes = await client.execute({
    sql: `
      SELECT
        d."Deal ID" AS deal_id,
        d."${SDR_FIELD}" AS sdr_agent,
        d."${COUNTRY_FIELD}" AS country,
        d."${PROGRAM_FIELD}" AS program,
        d."Deal Creation Date Time" AS created_at,
        d."DISTRIBUTION Time" AS distributed_at,
        d."CALENDLY Event Created At" AS calendly_created_at,
        d."CALENDLY Time" AS calendly_time,
        d."Deal Proposal Sent Date Time" AS proposal_sent_at,
        d."Deal Proposal Signed Date Time" AS proposal_signed_at,
        d."MQL Lost Reason" AS mql_lost_reason
      FROM deals d
      WHERE 1=1
      LIMIT 200000
    `,
    args: []
  })
  let rows = rowsRes.rows as any[]

  // month filters (independent)
  rows = rows.filter(r =>
    (!createdMonth || monthKey(r.created_at) === createdMonth) &&
    (!distributedMonth || monthKey(r.distributed_at) === distributedMonth) &&
    (!callMonth || monthKey(r.calendly_time) === callMonth) &&
    (!proposalMonth || monthKey(r.proposal_sent_at) === proposalMonth)
  )

  // agent multiselect
  if (agents.length) {
    const set = new Set(agents.map(a=>a.toLowerCase()))
    rows = rows.filter(r => setHasContains(set, r.sdr_agent))
  }
  function setHasContains(set: Set<string>, hay?: string|null) {
    const h = (hay||'').toLowerCase()
    for (const o of set) if (h.includes(o)) return true
    return false
  }

  if (metaOnly) {
    const distinct = Array.from(new Set(rows.map(r => r.sdr_agent))).filter(Boolean).sort((a,b)=>a.localeCompare(b))
    return json({ agents: distinct })
  }

  const overview = {
    created: rows.filter(r=>r.created_at).length,
    distributed: rows.filter(r=>r.distributed_at).length,
    calls_scheduled: rows.filter(r=>r.calendly_created_at).length,
    calls_completed: rows.filter(r=>r.calendly_time).length,
    proposals: rows.filter(r=>r.proposal_sent_at).length,
    closed_won: rows.filter(r=>r.proposal_signed_at).length
  }

  const byAgent = group(rows, r => r.sdr_agent || '(not set)')
  const agentConversion = Object.keys(byAgent).sort((a,b)=>a.localeCompare(b)).map(sdr_agent => {
    const list = byAgent[sdr_agent]
    return {
      sdr_agent,
      created: list.filter(r=>r.created_at).length,
      distributed: list.filter(r=>r.distributed_at).length,
      calls_scheduled: list.filter(r=>r.calendly_created_at).length,
      calls_completed: list.filter(r=>r.calendly_time).length,
      proposals: list.filter(r=>r.proposal_sent_at).length,
      closed_won: list.filter(r=>r.proposal_signed_at).length
    }
  })

  const timeIntervals = Object.keys(byAgent).sort((a,b)=>a.localeCompare(b)).map(sdr_agent => {
    const list = byAgent[sdr_agent]
    const dist = list.map(r => diffMinutes(r.created_at, r.distributed_at)).filter(n=>n!=null) as number[]
    const booking = list.map(r => diffDays(r.distributed_at, r.calendly_created_at)).filter(n=>n!=null) as number[]
    const conn = list.map(r => diffDays(r.calendly_created_at, r.calendly_time)).filter(n=>n!=null) as number[]
    const distShow = list.map(r => diffDays(r.distributed_at, r.calendly_time)).filter(n=>n!=null) as number[]
    const prop = list.map(r => diffMinutes(r.calendly_time, r.proposal_sent_at)).filter(n=>n!=null) as number[]
    const close = list.map(r => diffDays(r.proposal_sent_at, r.proposal_signed_at)).filter(n=>n!=null) as number[]
    return {
      sdr_agent,
      t_dist_avg: avg(dist), t_dist_med: median(dist), t_dist_modes: topModes(dist),
      t_booking_avg: avg(booking), t_booking_med: median(booking), t_booking_modes: topModes(booking),
      t_conn_avg: avg(conn), t_conn_med: median(conn), t_conn_modes: topModes(conn),
      t_dist_show_avg: avg(distShow), t_dist_show_med: median(distShow), t_dist_show_modes: topModes(distShow),
      t_prop_avg: avg(prop), t_prop_med: median(prop), t_prop_modes: topModes(prop),
      t_close_avg: avg(close), t_close_med: median(close), t_close_modes: topModes(close)
    }
  })

  const byCountry = group(rows, r => r[COUNTRY_FIELD] || '(not set)')
  const breakdown = Object.keys(byCountry).sort((a,b)=>a.localeCompare(b)).map(country => {
    const list = byCountry[country]
    const byProgram = group(list, r => r[PROGRAM_FIELD] || '(not set)')
    return {
      key: 'c:'+country, label: country,
      metrics: counts(list),
      children: Object.keys(byProgram).sort((a,b)=>a.localeCompare(b)).map(program => ({
        key: 'p:'+country+':'+program, label: program,
        metrics: counts(byProgram[program])
      }))
    }
  })

  const reasonCounts = Object.entries(group(rows, r => r.mql_lost_reason || '(not set)'))
    .map(([reason, list]) => ({ reason, count: list.length }))
    .sort((a,b)=> b.count - a.count)

  return json({
    tabs: {
      overview,
      agentConversion,
      timeIntervals,
      mqlLostReasons: reasonCounts,
      breakdown
    }
  })
}

function json(body:any){ return { statusCode:200, headers:{'content-type':'application/json'}, body: JSON.stringify(body)} }
function group<T>(arr:T[], key:(r:T)=>string){
  return arr.reduce((acc:Record<string,T[]>, r)=>{ const k = key(r)||''; (acc[k] ||= []).push(r); return acc },{})
}
function counts(list:any[]){
  return {
    created: list.filter(r=>r.created_at).length,
    distributed: list.filter(r=>r.distributed_at).length,
    calls_scheduled: list.filter(r=>r.calendly_created_at).length,
    calls_completed: list.filter(r=>r.calendly_time).length,
    proposals: list.filter(r=>r.proposal_sent_at).length,
    closed_won: list.filter(r=>r.proposal_signed_at).length
  }
}

export { handler }

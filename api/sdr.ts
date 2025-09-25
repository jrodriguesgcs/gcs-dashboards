import type { VercelRequest, VercelResponse } from '@vercel/node'
import { db } from '../lib/db.js'
import { diffMinutes, diffDays, monthKey } from '../lib/time.js'
import { SDR_FIELD, COUNTRY_FIELD, PROGRAM_FIELD, avg, median, topModes } from '../lib/util.js'

export default async function handler(
  req: VercelRequest,
  res: VercelResponse
) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS')
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end()
  }

  try {
    const qp = req.query as Record<string, string>
    const metaOnly = req.query.pathname === '/meta'
    const createdMonth = qp.createdMonth || ''
    const distributedMonth = qp.distributedMonth || ''
    const callMonth = qp.callMonth || ''
    const proposalMonth = qp.proposalMonth || ''
    const agents = (qp.agents || '').split('||').filter(Boolean)

    const client = db()

    if (metaOnly) {
      const meta = await client.execute({
        sql: `SELECT DISTINCT d."${SDR_FIELD}" AS sdr_agent FROM deals d WHERE d."${SDR_FIELD}" IS NOT NULL AND TRIM(d."${SDR_FIELD}") <> '' ORDER BY sdr_agent`,
        args: []
      })
      const list = (meta.rows || []).map((r:any) => (r.sdr_agent as string) || '').filter(Boolean)
      client.close()
      return res.status(200).json({ agents: list })
    }

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

    rows = rows.filter((r:any) =>
      (!createdMonth || monthKey(r.created_at) === createdMonth) &&
      (!distributedMonth || monthKey(r.distributed_at) === distributedMonth) &&
      (!callMonth || monthKey(r.calendly_time) === callMonth) &&
      (!proposalMonth || monthKey(r.proposal_sent_at) === proposalMonth)
    )

    if (agents.length) {
      const set = new Set(agents.map((a:string)=>a.toLowerCase()))
      rows = rows.filter((r:any) => {
        const h = (r.sdr_agent||'').toLowerCase()
        for (const a of set) if (h.includes(a)) return true
        return false
      })
    }

    const overview = {
      created: rows.filter((r:any)=>r.created_at).length,
      distributed: rows.filter((r:any)=>r.distributed_at).length,
      calls_scheduled: rows.filter((r:any)=>r.calendly_created_at).length,
      calls_completed: rows.filter((r:any)=>r.calendly_time).length,
      proposals: rows.filter((r:any)=>r.proposal_sent_at).length,
      closed_won: rows.filter((r:any)=>r.proposal_signed_at).length
    }

    const byAgent = group(rows, (r:any) => r.sdr_agent || '(not set)')
    const agentConversion = Object.keys(byAgent).sort((a:string,b:string)=>a.localeCompare(b)).map((sdr_agent: string) => {
      const list = byAgent[sdr_agent]
      return {
        sdr_agent,
        created: list.filter((r:any)=>r.created_at).length,
        distributed: list.filter((r:any)=>r.distributed_at).length,
        calls_scheduled: list.filter((r:any)=>r.calendly_created_at).length,
        calls_completed: list.filter((r:any)=>r.calendly_time).length,
        proposals: list.filter((r:any)=>r.proposal_sent_at).length,
        closed_won: list.filter((r:any)=>r.proposal_signed_at).length
      }
    })

    const timeIntervals = Object.keys(byAgent).sort((a:string,b:string)=>a.localeCompare(b)).map((sdr_agent: string) => {
      const list = byAgent[sdr_agent]
      const dist = list.map((r:any) => diffMinutes(r.created_at, r.distributed_at)).filter((n:any)=>n!=null) as number[]
      const booking = list.map((r:any) => diffDays(r.distributed_at, r.calendly_created_at)).filter((n:any)=>n!=null) as number[]
      const conn = list.map((r:any) => diffDays(r.calendly_created_at, r.calendly_time)).filter((n:any)=>n!=null) as number[]
      const distShow = list.map((r:any) => diffDays(r.distributed_at, r.calendly_time)).filter((n:any)=>n!=null) as number[]
      const prop = list.map((r:any) => diffMinutes(r.calendly_time, r.proposal_sent_at)).filter((n:any)=>n!=null) as number[]
      const close = list.map((r:any) => diffDays(r.proposal_sent_at, r.proposal_signed_at)).filter((n:any)=>n!=null) as number[]
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

    const byCountry = group(rows, (r:any) => r[COUNTRY_FIELD] || '(not set)')
    const breakdown = Object.keys(byCountry).sort((a:string,b:string)=>a.localeCompare(b)).map((country: string) => {
      const list = byCountry[country]
      const byProgram = group(list, (r:any) => r[PROGRAM_FIELD] || '(not set)')
      return {
        key: 'c:'+country, label: country,
        metrics: counts(list),
        children: Object.keys(byProgram).sort((a:string,b:string)=>a.localeCompare(b)).map((program: string) => ({
          key: 'p:'+country+':'+program, label: program,
          metrics: counts(byProgram[program])
        }))
      }
    })

    const reasonCounts = Object.entries(group(rows, (r:any) => r.mql_lost_reason || '(not set)'))
      .map(([reason, list]) => ({ reason, count: (list as any[]).length }))
      .sort((a:{count:number}, b:{count:number})=> b.count - a.count)

    client.close()
    return res.status(200).json({ tabs: { overview, agentConversion, timeIntervals, mqlLostReasons: reasonCounts, breakdown } })
  } catch (e:any) {
    console.error('sdr error', e)
    return res.status(500).json({ error: e?.message || String(e) })
  }
}

function group<T>(arr:T[], key:(r:T)=>string){
  return arr.reduce((acc:Record<string,T[]>, r:T)=>{ const k = key(r)||''; (acc[k] ||= []).push(r); return acc },{})
}

function counts(list:any[]){
  return {
    created: list.filter((r:any)=>r.created_at).length,
    distributed: list.filter((r:any)=>r.distributed_at).length,
    calls_scheduled: list.filter((r:any)=>r.calendly_created_at).length,
    calls_completed: list.filter((r:any)=>r.calendly_time).length,
    proposals: list.filter((r:any)=>r.proposal_sent_at).length,
    closed_won: list.filter((r:any)=>r.proposal_signed_at).length
  }
}
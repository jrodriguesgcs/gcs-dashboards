import type { VercelRequest, VercelResponse } from '@vercel/node'
import { query } from '../lib/db'
import { diffMinutes, diffDays, monthKey } from '../lib/time'
import { avg, median, topModes } from '../lib/util'

const SDR_FIELD = '--- SDR AGENT --- REQUIRED FIELD ---'
const COUNTRY_FIELD = 'Primary Country of Interest'
const PROGRAM_FIELD = 'Primary Program of Interest'

function group<T>(arr: T[], keyFn: (item: T) => string): Record<string, T[]> {
  return arr.reduce((acc, item) => {
    const key = keyFn(item) || '(not set)'
    if (!acc[key]) acc[key] = []
    acc[key].push(item)
    return acc
  }, {} as Record<string, T[]>)
}

function counts(list: any[]) {
  return {
    created: list.filter(r => r.created_at).length,
    distributed: list.filter(r => r.distributed_at).length,
    calls_scheduled: list.filter(r => r.calendly_created_at).length,
    calls_completed: list.filter(r => r.calendly_time).length,
    proposals: list.filter(r => r.proposal_sent_at).length,
    closed_won: list.filter(r => r.proposal_signed_at).length
  }
}

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

    if (metaOnly) {
      const meta = query(`
        SELECT DISTINCT d."${SDR_FIELD}" AS sdr_agent 
        FROM deals d 
        WHERE d."${SDR_FIELD}" IS NOT NULL 
        AND TRIM(d."${SDR_FIELD}") <> '' 
        ORDER BY sdr_agent
      `) as any[]
      
      const list = meta.map(r => r.sdr_agent as string || '').filter(Boolean)
      return res.status(200).json({ agents: list })
    }

    const rows = query(`
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
    `) as any[]

    // Apply filters
    let filteredRows = rows.filter(r =>
      (!createdMonth || monthKey(r.created_at) === createdMonth) &&
      (!distributedMonth || monthKey(r.distributed_at) === distributedMonth) &&
      (!callMonth || monthKey(r.calendly_time) === callMonth) &&
      (!proposalMonth || monthKey(r.proposal_sent_at) === proposalMonth)
    )

    if (agents.length) {
      const agentSet = new Set(agents.map(a => a.toLowerCase()))
      filteredRows = filteredRows.filter(r => {
        const sdrAgent = (r.sdr_agent || '').toLowerCase()
        return Array.from(agentSet).some(a => sdrAgent.includes(a))
      })
    }

    const overview = {
      created: filteredRows.filter(r => r.created_at).length,
      distributed: filteredRows.filter(r => r.distributed_at).length,
      calls_scheduled: filteredRows.filter(r => r.calendly_created_at).length,
      calls_completed: filteredRows.filter(r => r.calendly_time).length,
      proposals: filteredRows.filter(r => r.proposal_sent_at).length,
      closed_won: filteredRows.filter(r => r.proposal_signed_at).length
    }

    const byAgent = group(filteredRows, r => r.sdr_agent || '(not set)')
    const agentConversion = Object.keys(byAgent)
      .sort((a, b) => a.localeCompare(b))
      .map(sdr_agent => ({
        sdr_agent,
        ...counts(byAgent[sdr_agent])
      }))

    const timeIntervals = Object.keys(byAgent)
      .sort((a, b) => a.localeCompare(b))
      .map(sdr_agent => {
        const list = byAgent[sdr_agent]
        const dist = list.map(r => diffMinutes(r.created_at, r.distributed_at)).filter(n => n != null) as number[]
        const booking = list.map(r => diffDays(r.distributed_at, r.calendly_created_at)).filter(n => n != null) as number[]
        const conn = list.map(r => diffDays(r.calendly_created_at, r.calendly_time)).filter(n => n != null) as number[]
        const distShow = list.map(r => diffDays(r.distributed_at, r.calendly_time)).filter(n => n != null) as number[]
        const prop = list.map(r => diffMinutes(r.calendly_time, r.proposal_sent_at)).filter(n => n != null) as number[]
        const close = list.map(r => diffDays(r.proposal_sent_at, r.proposal_signed_at)).filter(n => n != null) as number[]
        
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

    const byCountry = group(filteredRows, r => r[COUNTRY_FIELD] || '(not set)')
    const breakdown = Object.keys(byCountry)
      .sort((a, b) => a.localeCompare(b))
      .map(country => {
        const list = byCountry[country]
        const byProgram = group(list, r => r[PROGRAM_FIELD] || '(not set)')
        
        return {
          key: 'c:' + country,
          label: country,
          metrics: counts(list),
          children: Object.keys(byProgram)
            .sort((a, b) => a.localeCompare(b))
            .map(program => ({
              key: 'p:' + country + ':' + program,
              label: program,
              metrics: counts(byProgram[program])
            }))
        }
      })

    const reasonCounts = Object.entries(group(filteredRows, r => r.mql_lost_reason || '(not set)'))
      .map(([reason, list]) => ({ reason, count: (list as any[]).length }))
      .sort((a, b) => b.count - a.count)

    return res.status(200).json({ 
      tabs: { 
        overview, 
        agentConversion, 
        timeIntervals, 
        mqlLostReasons: reasonCounts, 
        breakdown 
      } 
    })
  } catch (e: any) {
    console.error('sdr error', e)
    return res.status(500).json({ error: e?.message || String(e) })
  }
}
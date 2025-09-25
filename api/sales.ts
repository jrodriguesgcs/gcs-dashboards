import type { VercelRequest, VercelResponse } from '@vercel/node'
import { db } from '../lib/db'
import { diffMinutes, diffDays, monthKey } from '../lib/time'
import { OWNER_ALLOW, COUNTRY_FIELD, PROGRAM_FIELD, pct, avg, median, topModes } from '../lib/util'

const OWNER_FIELD = 'Owner Name'

function ownersFilterSQL(include: string[]) {
  const ors = include.map(() => `LOWER(d."${OWNER_FIELD}") LIKE ?`).join(' OR ')
  const args = include.map((v: string) => `%${v.toLowerCase()}%`)
  return { where: `(${ors})`, args }
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
    const metaOnly = req.query.pathname === '/meta'
    const qp = req.query as Record<string, string>
    
    const createdMonth = qp.createdMonth || ''
    const distributedMonth = qp.distributedMonth || ''
    const callMonth = qp.callMonth || ''
    const proposalMonth = qp.proposalMonth || ''
    const owners = (qp.owners || '').split('||').filter(Boolean)

    const client = db()

    // META: distinct owners fast path
    if (metaOnly) {
      const { where, args } = ownersFilterSQL(OWNER_ALLOW)
      const meta = await client.execute({
        sql: `SELECT DISTINCT d."${OWNER_FIELD}" AS owner FROM deals d WHERE ${where} ORDER BY owner`,
        args
      })
      const ownersList = (meta.rows || []).map((r: any) => r.owner || '').filter(Boolean)
      client.close()
      return res.status(200).json({ owners: ownersList })
    }

    // Rest of your existing logic here...
    // (Copy the rest from your original sales.ts, just remove the Handler type and json function)
    
    const { where, args } = ownersFilterSQL(OWNER_ALLOW)
    const baseSQL = `
      SELECT
        d."Deal ID" AS deal_id,
        d."${OWNER_FIELD}" AS owner,
        d."${COUNTRY_FIELD}" AS country,
        d."${PROGRAM_FIELD}" AS program,
        d."Deal Creation Date Time" AS created_at,
        d."DISTRIBUTION Time" AS distributed_at,
        d."CALENDLY Event Created At" AS calendly_created_at,
        d."CALENDLY Time" AS calendly_time,
        d."Deal Proposal Sent Date Time" AS proposal_sent_at,
        d."Deal Proposal Signed Date Time" AS proposal_signed_at
      FROM deals d
      WHERE ${where}
      LIMIT 200000
    `
    const rowsRes = await client.execute({ sql: baseSQL, args })
    let rows = rowsRes.rows as any[]

    rows = rows.filter((r: any) =>
      (!createdMonth || monthKey(r.created_at) === createdMonth) &&
      (!distributedMonth || monthKey(r.distributed_at) === distributedMonth) &&
      (!callMonth || monthKey(r.calendly_time) === callMonth) &&
      (!proposalMonth || monthKey(r.proposal_sent_at) === proposalMonth)
    )

    if (owners.length) {
      const set = new Set(owners.map(s => s.toLowerCase()))
      rows = rows.filter((r: any) => {
        const h = (r.owner || '').toLowerCase()
        for (const o of set) if (h.includes(o)) return true
        return false
      })
    }

    // Continue with all your existing logic...
    const overview = {
      created: rows.filter((r: any) => r.created_at).length,
      distributed: rows.filter((r: any) => r.distributed_at).length,
      calls_scheduled: rows.filter((r: any) => r.calendly_created_at).length,
      calls_completed: rows.filter((r: any) => r.calendly_time).length,
      proposals: rows.filter((r: any) => r.proposal_sent_at).length,
      closed_won: rows.filter((r: any) => r.proposal_signed_at).length
    }

    const byOwner = group(rows, (r: any) => r.owner || '(not set)')
    const ownerConversion = Object.keys(byOwner).sort((a,b) => a.localeCompare(b)).map(owner => {
      const list = byOwner[owner]
      const created = list.filter((r:any) => r.created_at).length
      const distributed = list.filter((r:any) => r.distributed_at).length
      const calls_scheduled = list.filter((r:any) => r.calendly_created_at).length
      const calls_completed = list.filter((r:any) => r.calendly_time).length
      const proposals = list.filter((r:any) => r.proposal_sent_at).length
      const closed_won = list.filter((r:any) => r.proposal_signed_at).length
      return {
        owner, created, distributed, calls_scheduled, calls_completed, proposals, closed_won,
        conv_created_to_distributed: pct(distributed, created),
        conv_distributed_to_scheduled: pct(calls_scheduled, distributed),
        conv_scheduled_to_completed: pct(calls_completed, calls_scheduled),
        conv_completed_to_proposal: pct(proposals, calls_completed),
        conv_proposal_to_won: pct(closed_won, proposals)
      }
    })

    const timeIntervals = Object.keys(byOwner).sort((a,b) => a.localeCompare(b)).map(owner => {
      const list = byOwner[owner]
      const dist = list.map((r:any) => diffMinutes(r.created_at, r.distributed_at)).filter((n:any) => n != null) as number[]
      const booking = list.map((r:any) => diffDays(r.distributed_at, r.calendly_created_at)).filter((n:any) => n != null) as number[]
      const conn = list.map((r:any) => diffDays(r.calendly_created_at, r.calendly_time)).filter((n:any) => n != null) as number[]
      const distShow = list.map((r:any) => diffDays(r.distributed_at, r.calendly_time)).filter((n:any) => n != null) as number[]
      const prop = list.map((r:any) => diffMinutes(r.calendly_time, r.proposal_sent_at)).filter((n:any) => n != null) as number[]
      const close = list.map((r:any) => diffDays(r.proposal_sent_at, r.proposal_signed_at)).filter((n:any) => n != null) as number[]
      return {
        owner,
        t_dist_avg: avg(dist), t_dist_med: median(dist), t_dist_modes: topModes(dist),
        t_booking_avg: avg(booking), t_booking_med: median(booking), t_booking_modes: topModes(booking),
        t_conn_avg: avg(conn), t_conn_med: median(conn), t_conn_modes: topModes(conn),
        t_dist_show_avg: avg(distShow), t_dist_show_med: median(distShow), t_dist_show_modes: topModes(distShow),
        t_prop_avg: avg(prop), t_prop_med: median(prop), t_prop_modes: topModes(prop),
        t_close_avg: avg(close), t_close_med: median(close), t_close_modes: topModes(close)
      }
    })

    const byCountry = group(rows, (r:any) => r[COUNTRY_FIELD] || '(not set)')
    const breakdown = Object.keys(byCountry).sort((a,b) => a.localeCompare(b)).map(country => {
      const list = byCountry[country]
      const byProgram = group(list, (r:any) => r[PROGRAM_FIELD] || '(not set)')
      return {
        key: 'c:'+country, label: country,
        metrics: counts(list),
        children: Object.keys(byProgram).sort((a,b) => a.localeCompare(b)).map(program => ({
          key: 'p:'+country+':'+program, label: program,
          metrics: counts(byProgram[program])
        }))
      }
    })

    client.close()
    return res.status(200).json({ tabs: { overview, ownerConversion, timeIntervals, breakdown } })
  } catch (e: any) {
    console.error('Sales API error:', e)
    return res.status(500).json({ error: e?.message || String(e) })
  }
}

function group<T>(arr: T[], key: (r:T) => string) {
  return arr.reduce((acc: Record<string,T[]>, r: T) => {
    const k = key(r) ?? ''
    ;(acc[k] ||= []).push(r)
    return acc
  }, {})
}

function counts(list: any[]) {
  return {
    created: list.filter((r:any) => r.created_at).length,
    distributed: list.filter((r:any) => r.distributed_at).length,
    calls_scheduled: list.filter((r:any) => r.calendly_created_at).length,
    calls_completed: list.filter((r:any) => r.calendly_time).length,
    proposals: list.filter((r:any) => r.proposal_sent_at).length,
    closed_won: list.filter((r:any) => r.proposal_signed_at).length
  }
}
import { Handler } from '@netlify/functions'
import { db } from './_db'
import { diffMinutes, diffDays, createdDOW, createdHour, monthKey } from './_time'
import { OWNER_ALLOW, COUNTRY_FIELD, PROGRAM_FIELD, containsAny, pct, avg, median, topModes } from './_util'

const OWNER_FIELD = 'Owner Name'

function ownersFilterSQL(include: string[]) {
  // contains (case-insensitive) any of the include list
  const ors = include.map(() => `LOWER(d."${OWNER_FIELD}") LIKE ?`).join(' OR ')
  const args = include.map(v => `%${v.toLowerCase()}%`)
  return { where: `(${ors})`, args }
}

const handler: Handler = async (event) => {
  const qp = event.queryStringParameters || {}
  const metaOnly = event.path.endsWith('/meta')

  const createdMonth = qp.createdMonth || ''
  const distributedMonth = qp.distributedMonth || ''
  const callMonth = qp.callMonth || ''   // CALENDLY Time
  const proposalMonth = qp.proposalMonth || ''
  const owners = (qp.owners || '').split('||').filter(Boolean)

  const client = db()

  // fetch minimal columns
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
    WHERE 1=1
  `
  const allow = OWNER_ALLOW
  const { where, args } = ownersFilterSQL(allow)
  let whereClause = ` AND ${where}`

  // owner multiselect (subset of allow list)
  let ownerSubset: string[]|null = null
  if (owners.length) ownerSubset = owners

  const rowsRes = await client.execute({
    sql: baseSQL + whereClause + ' LIMIT 200000',
    args
  })
  let rows = rowsRes.rows as any[]

  // filter by MONTHS (each applies to its own column independently)
  rows = rows.filter(r =>
    (!createdMonth || monthKey(r.created_at) === createdMonth) &&
    (!distributedMonth || monthKey(r.distributed_at) === distributedMonth) &&
    (!callMonth || monthKey(r.calendly_time) === callMonth) &&
    (!proposalMonth || monthKey(r.proposal_sent_at) === proposalMonth)
  )

  // apply owner multiselect (subset)
  if (ownerSubset) {
    const set = new Set(ownerSubset.map(s => s.toLowerCase()))
    rows = rows.filter(r => setHasContains(set, r.owner))
  }
  // helper: owner contains match
  function setHasContains(set: Set<string>, hay?: string|null) {
    const h = (hay||'').toLowerCase()
    for (const o of set) if (h.includes(o)) return true
    return false
  }

  if (metaOnly) {
    // distinct owners A→Z (from allowed set + present in data)
    const distinct = Array.from(new Set(rows.map(r => r.owner))).filter(Boolean)
      .filter(o => containsAny(o, OWNER_ALLOW))
      .sort((a,b)=> a.localeCompare(b))
    return json({ owners: distinct })
  }

  // KPI counts
  const overview = {
    created: rows.filter(r => r.created_at).length,
    distributed: rows.filter(r => r.distributed_at).length,
    calls_scheduled: rows.filter(r => r.calendly_created_at).length,
    calls_completed: rows.filter(r => r.calendly_time).length,
    proposals: rows.filter(r => r.proposal_sent_at).length,
    closed_won: rows.filter(r => r.proposal_signed_at).length
  }

  // Owner conversion
  const byOwner = group(rows, r => r.owner)
  const ownerConversion = Object.keys(byOwner).sort((a,b)=> a.localeCompare(b)).map(owner => {
    const list = byOwner[owner]
    const created = list.filter(r=>r.created_at).length
    const distributed = list.filter(r=>r.distributed_at).length
    const calls_scheduled = list.filter(r=>r.calendly_created_at).length
    const calls_completed = list.filter(r=>r.calendly_time).length
    const proposals = list.filter(r=>r.proposal_sent_at).length
    const closed_won = list.filter(r=>r.proposal_signed_at).length
    return {
      owner, created, distributed, calls_scheduled, calls_completed, proposals, closed_won,
      conv_created_to_distributed: pct(distributed, created),
      conv_distributed_to_scheduled: pct(calls_scheduled, distributed),
      conv_scheduled_to_completed: pct(calls_completed, calls_scheduled),
      conv_completed_to_proposal: pct(proposals, calls_completed),
      conv_proposal_to_won: pct(closed_won, proposals)
    }
  })

  // Time intervals per owner
  const timeIntervals = Object.keys(byOwner).sort((a,b)=> a.localeCompare(b)).map(owner => {
    const list = byOwner[owner]
    const dist = list.map(r => diffMinutes(r.created_at, r.distributed_at)).filter(n=>n!=null) as number[]
    const booking = list.map(r => diffDays(r.distributed_at, r.calendly_created_at)).filter(n=>n!=null) as number[]
    const conn = list.map(r => diffDays(r.calendly_created_at, r.calendly_time)).filter(n=>n!=null) as number[]
    const distShow = list.map(r => diffDays(r.distributed_at, r.calendly_time)).filter(n=>n!=null) as number[]
    const prop = list.map(r => diffMinutes(r.calendly_time, r.proposal_sent_at)).filter(n=>n!=null) as number[]
    const close = list.map(r => diffDays(r.proposal_sent_at, r.proposal_signed_at)).filter(n=>n!=null) as number[]
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

  // Breakdown Country → Program
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

  return json({
    tabs: {
      overview,
      ownerConversion,
      timeIntervals,
      breakdown
    }
  })
}

function json(body: any) {
  return { statusCode: 200, headers: {'content-type':'application/json'}, body: JSON.stringify(body) }
}
function group<T>(arr: T[], key: (r:T)=>string) {
  return arr.reduce((acc:Record<string,T[]>, r) => {
    const k = key(r) ?? ''
    ;(acc[k] ||= []).push(r)
    return acc
  }, {})
}
function counts(list: any[]) {
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

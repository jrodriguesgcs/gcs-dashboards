import { Handler } from '@netlify/functions'
import { db } from './_db'
import { diffMinutes, diffDays, createdDOW, createdHour } from './_time'

// If you want to run your EXACT SQL from your notebook, paste it in SALES_SQL.
// The function will use it verbatim (no filters), then compute the derived fields.
// Otherwise it uses the default query below.
const SALES_SQL = process.env.SALES_SQL?.trim()

const handler: Handler = async (event) => {
  const client = db()

  // Optional filters (match your current UI semantics)
  const qp = event.queryStringParameters || {}
  const createdMonth = qp.createdMonth
  const distributedMonth = qp.distributedMonth
  const callMonth = qp.callMonth
  const proposalMonth = qp.proposalMonth
  const pipeline = qp.pipeline

  let sql: string
  let args: any[] = []

  if (SALES_SQL) {
    sql = SALES_SQL
  } else {
    // Default: bring only the columns we need; quote names with spaces
    const filters: string[] = []
    if (createdMonth) { filters.push(`strftime('%Y-%m', "Deal Creation Date Time") = ?`); args.push(createdMonth) }
    if (distributedMonth) { filters.push(`substr("DISTRIBUTION Time",1,7) = ?`); args.push(distributedMonth) }
    if (callMonth) { filters.push(`substr("CALENDLY Time",1,7) = ?`); args.push(callMonth) }
    if (proposalMonth) { filters.push(`substr("Deal Proposal Sent Date Time",1,7) = ?`); args.push(proposalMonth) }
    if (pipeline) { filters.push(`Pipeline = ?`); args.push(pipeline) }
    const where = filters.length ? `WHERE ${filters.join(' AND ')}` : ''

    sql = `
      SELECT
        d."Deal ID"  AS deal_id,
        d."Title"    AS title,
        d."Value"    AS value,
        d."Currency" AS currency,
        d."Status"   AS status,
        d."Pipeline" AS pipeline,
        d."Stage"    AS stage,
        d."Primary Contact ID" AS contact_id,
        d."Deal Creation Date Time"        AS created_at,
        d."DISTRIBUTION Time"              AS distributed_at,
        d."CALENDLY Event Created At"      AS calendly_created_at,
        d."CALENDLY Time"                  AS calendly_time,
        d."Deal Proposal Sent Date Time"   AS proposal_sent_at,
        d."Deal Proposal Signed Date Time" AS proposal_signed_at
      FROM deals d
      ${where}
      LIMIT 5000
    `
  }

  const { rows } = await client.execute({ sql, args })

  const enriched = rows.map((r: any) => ({
    ...r,
    time_to_distribution_min:  diffMinutes(r.created_at, r.distributed_at),
    time_to_booking_days:      diffDays(r.distributed_at, r.calendly_created_at),
    time_to_connection_days:   diffDays(r.calendly_created_at, r.calendly_time),
    distribution_to_show_days: diffDays(r.distributed_at, r.calendly_time),
    time_to_proposal_min:      diffMinutes(r.calendly_time, r.proposal_sent_at),
    time_to_close_days:        diffDays(r.proposal_sent_at, r.proposal_signed_at),
    created_day_of_week:       createdDOW(r.created_at),
    created_hour:              createdHour(r.created_at)
  }))

  return {
    statusCode: 200,
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ rows: enriched, meta: { count: enriched.length } })
  }
}

export { handler }

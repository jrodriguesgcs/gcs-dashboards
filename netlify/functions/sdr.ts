import { Handler } from '@netlify/functions'
import { db } from './_db'
import { diffMinutes, diffDays, createdDOW, createdHour } from './_time'

// Paste your EXACT SDR SQL here (optional). Otherwise, default query below.
const SDR_SQL = process.env.SDR_SQL?.trim()

const handler: Handler = async () => {
  const client = db()
  let sql = SDR_SQL

  if (!sql) {
    // Example default: bring common columns for SDR views; adjust as desired
    sql = `
      SELECT
        d."Deal ID"  AS deal_id,
        d."Title"    AS title,
        d."Value"    AS value,
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
      WHERE d."Stage" IS NOT NULL
      LIMIT 5000
    `
  }

  const { rows } = await client.execute({ sql })
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

  return { statusCode: 200, body: JSON.stringify({ rows: enriched }) }
}

export { handler }

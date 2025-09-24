import { Handler } from '@netlify/functions'
import { db } from './_db'

// Paste your EXACT Marketing UTM SQL here (optional). Otherwise default join below.
const MKT_SQL = process.env.MARKETING_SQL?.trim()

const handler: Handler = async () => {
  const client = db()
  let sql = MKT_SQL

  if (!sql) {
    // Default: example join on contacts.ID -> deals."Primary Contact ID"
    sql = `
      SELECT
        c."ID"                AS contact_id,
        c."Email"             AS email,
        c."First Name"        AS first_name,
        c."Last Name"         AS last_name,
        c."Account ID"        AS account_id,
        d."Deal ID"           AS deal_id,
        d."Title"             AS title,
        d."Pipeline"          AS pipeline,
        d."Stage"             AS stage,
        d."Value"             AS value,
        -- adjust these to your actual UTM columns:
        c."*UTM Source"       AS utm_source,
        c."*UTM Medium"       AS utm_medium,
        c."*UTM Campaign"     AS utm_campaign,
        c."*Submission Page"  AS submission_page
      FROM contacts c
      JOIN deals d ON c."ID" = d."Primary Contact ID"
      LIMIT 5000
    `
  }

  const { rows } = await client.execute({ sql })
  // Heads-up: keep PII in server responses only if that matches your current HTML.
  // If you want to hide PII in the browser, map here and remove email/names.
  return { statusCode: 200, body: JSON.stringify({ rows }) }
}

export { handler }

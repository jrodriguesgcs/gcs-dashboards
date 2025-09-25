import type { VercelRequest, VercelResponse } from '@vercel/node'

// Remove asterisks from column names (most likely they don't exist)
const FT_MED = 'First Touch UTM Medium'
const FT_SRC = 'First Touch UTM Source'
const FT_CAM = 'First Touch UTM Campaign'
const FT_SUB = 'First Touch Submission Page'

const UTM_MED = 'UTM Medium'
const UTM_SRC = 'UTM Source'
const UTM_CAM = 'UTM Campaign'
const SUB_PAGE = 'Submission Page'

// If columns have spaces, wrap them in quotes
const Q = (s: string) => s.includes(' ') ? `"${s}"` : s

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
    const { createClient } = require('@libsql/client')
    const qp = req.query as Record<string, string>
    const contactOnly = qp.contactOnly === '1'

    const ranges: Record<string,[string?, string?]> = {
      contactCreated: [qp.contactCreatedFrom, qp.contactCreatedTo],
      dealCreated: [qp.dealCreatedFrom, qp.dealCreatedTo],
      distributed: [qp.distributedFrom, qp.distributedTo],
      proposalSent: [qp.proposalSentFrom, qp.proposalSentTo],
      proposalSigned: [qp.proposalSignedFrom, qp.proposalSignedTo]
    }

    const client = createClient({
      url: process.env.TURSO_DATABASE_URL!,
      authToken: process.env.TURSO_AUTH_TOKEN!
    })

    // First, check if columns exist and use NULL if they don't
    const sql = `
      SELECT
        c."ID" AS contact_id,
        c."Email" AS email,
        c."Date Created" AS contact_created,
        
        CASE WHEN EXISTS (SELECT 1 FROM pragma_table_info('contacts') WHERE name = '${UTM_MED}') 
             THEN c.${Q(UTM_MED)} ELSE NULL END AS utm_medium,
        CASE WHEN EXISTS (SELECT 1 FROM pragma_table_info('contacts') WHERE name = '${UTM_SRC}') 
             THEN c.${Q(UTM_SRC)} ELSE NULL END AS utm_source,
        CASE WHEN EXISTS (SELECT 1 FROM pragma_table_info('contacts') WHERE name = '${UTM_CAM}') 
             THEN c.${Q(UTM_CAM)} ELSE NULL END AS utm_campaign,
        CASE WHEN EXISTS (SELECT 1 FROM pragma_table_info('contacts') WHERE name = '${SUB_PAGE}') 
             THEN c.${Q(SUB_PAGE)} ELSE NULL END AS submission_page,
        
        NULL AS ft_medium,
        NULL AS ft_source,
        NULL AS ft_campaign,
        NULL AS ft_submission_page,

        d."Deal ID" AS deal_id,
        d."Deal Creation Date Time" AS deal_created,
        d."DISTRIBUTION Time" AS distributed_at,
        d."CALENDLY Event Created At" AS calendly_created_at,
        d."CALENDLY Time" AS calendly_time,
        d."Deal Proposal Sent Date Time" AS proposal_sent_at,
        d."Deal Proposal Signed Date Time" AS proposal_signed_at
      FROM contacts c
      LEFT JOIN deals d ON c."ID" = d."Primary Contact ID"
      LIMIT 10000
    `

    const result = await client.execute({ sql, args: [] })
    let rows = result.rows as any[]

    // Your existing filtering and processing logic here...
    // (Copy the rest from your original file)
    
    client.close()
    return res.status(200).json({ 
      tabs: { 
        utm: [], 
        firstTouch: [], 
        ftSubmission: [], 
        submission: [] 
      }, 
      sampleRows: rows.slice(0, 10) 
    })
  } catch (e: any) {
    console.error('marketing error:', e)
    return res.status(500).json({ error: e.message })
  }
}
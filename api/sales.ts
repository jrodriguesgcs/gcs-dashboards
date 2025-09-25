import type { VercelRequest, VercelResponse } from '@vercel/node'

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
    const metaOnly = req.query.pathname === '/meta'
    
    const client = createClient({
      url: process.env.TURSO_DATABASE_URL!,
      authToken: process.env.TURSO_AUTH_TOKEN!
    })

    // For meta, just return a simple list
    if (metaOnly) {
      const result = await client.execute({
        sql: `SELECT DISTINCT "Owner Name" AS owner 
              FROM deals 
              WHERE "Owner Name" IS NOT NULL 
              LIMIT 50`,
        args: []
      })
      const owners = result.rows.map((r: any) => r.owner).filter(Boolean)
      client.close()
      return res.status(200).json({ owners })
    }

    // For main query, reduce the limit significantly
    const result = await client.execute({
      sql: `
        SELECT
          d."Deal ID" AS deal_id,
          d."Owner Name" AS owner,
          d."Primary Country of Interest" AS country,
          d."Primary Program of Interest" AS program,
          d."Deal Creation Date Time" AS created_at,
          d."DISTRIBUTION Time" AS distributed_at,
          d."CALENDLY Time" AS calendly_time,
          d."Deal Proposal Sent Date Time" AS proposal_sent_at,
          d."Deal Proposal Signed Date Time" AS proposal_signed_at
        FROM deals d
        LIMIT 5000
      `,
      args: []
    })

    const rows = result.rows as any[]
    
    // Simple overview stats
    const overview = {
      created: rows.length,
      distributed: rows.filter((r: any) => r.distributed_at).length,
      calls_scheduled: 0,
      calls_completed: rows.filter((r: any) => r.calendly_time).length,
      proposals: rows.filter((r: any) => r.proposal_sent_at).length,
      closed_won: rows.filter((r: any) => r.proposal_signed_at).length
    }

    client.close()
    
    return res.status(200).json({ 
      tabs: { 
        overview,
        ownerConversion: [],
        timeIntervals: [],
        breakdown: []
      }
    })
  } catch (e: any) {
    console.error('Sales error:', e)
    return res.status(500).json({ error: e.message })
  }
}
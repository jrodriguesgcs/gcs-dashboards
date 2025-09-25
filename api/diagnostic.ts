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
    const { createClient } = await import('@libsql/client')
    
    const url = process.env.TURSO_DATABASE_URL
    const authToken = process.env.TURSO_AUTH_TOKEN
    
    if (!url || !authToken) {
      return res.status(400).json({ error: 'Missing database credentials' })
    }
    
    const client = createClient({ 
      url, 
      authToken,
      intMode: 'number'
    })
    
    const results: any = { 
      tables: [],
      contactColumns: [],
      dealColumns: [],
      utmRelated: [],
      sdrRelated: []
    }
    
    try {
      const tables = await client.execute(`SELECT name FROM sqlite_master WHERE type='table' LIMIT 10`)
      results.tables = tables.rows.map((r: any) => r.name)
      
      try {
        const contactSample = await client.execute(`SELECT * FROM contacts LIMIT 1`)
        if (contactSample.rows && contactSample.rows[0]) {
          results.contactColumns = Object.keys(contactSample.rows[0])
          results.utmRelated = results.contactColumns.filter((col: string) => 
            col.toLowerCase().includes('utm') || 
            col.toLowerCase().includes('medium') ||
            col.toLowerCase().includes('source') ||
            col.toLowerCase().includes('campaign') ||
            col.toLowerCase().includes('submission')
          )
        }
      } catch (e: any) {
        results.contactError = `Could not read contacts: ${e.message}`
      }
      
      try {
        const dealSample = await client.execute(`SELECT * FROM deals LIMIT 1`)
        if (dealSample.rows && dealSample.rows[0]) {
          results.dealColumns = Object.keys(dealSample.rows[0])
          results.sdrRelated = results.dealColumns.filter((col: string) =>
            col.toLowerCase().includes('sdr') ||
            col.toLowerCase().includes('agent')
          )
        }
      } catch (e: any) {
        results.dealError = `Could not read deals: ${e.message}`
      }
      
    } catch (e: any) {
      results.queryError = e.message
    }
    
    client.close()
    return res.status(200).json(results)
    
  } catch (e: any) {
    console.error('diagnostic error:', e)
    return res.status(500).json({ 
      error: e?.message || String(e),
      stack: e?.stack,
      env: {
        hasUrl: !!process.env.TURSO_DATABASE_URL,
        hasToken: !!process.env.TURSO_AUTH_TOKEN
      }
    })
  }
}
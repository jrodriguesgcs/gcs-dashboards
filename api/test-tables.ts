import type { VercelRequest, VercelResponse } from '@vercel/node'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  
  try {
    const { createClient } = await import('@libsql/client')
    
    const client = createClient({
      url: process.env.TURSO_DATABASE_URL!,
      authToken: process.env.TURSO_AUTH_TOKEN!
    })
    
    // List all tables
    const tables = await client.execute(`SELECT name FROM sqlite_master WHERE type='table'`)
    const tableNames = tables.rows.map((r: any) => r.name)
    
    const results: any = {
      tables: tableNames,
      details: {}
    }
    
    // Check contacts table
    if (tableNames.includes('contacts')) {
      const contactsInfo = await client.execute(`PRAGMA table_info(contacts)`)
      const contactsCount = await client.execute(`SELECT COUNT(*) as count FROM contacts`)
      const contactsSample = await client.execute(`SELECT * FROM contacts LIMIT 1`)
      
      results.details.contacts = {
        columns: contactsInfo.rows.map((r: any) => r.name),
        count: contactsCount.rows[0]?.count,
        sample: contactsSample.rows[0]
      }
    }
    
    // Check deals table  
    if (tableNames.includes('deals')) {
      const dealsInfo = await client.execute(`PRAGMA table_info(deals)`)
      const dealsCount = await client.execute(`SELECT COUNT(*) as count FROM deals`)
      const dealsSample = await client.execute(`SELECT * FROM deals LIMIT 1`)
      
      results.details.deals = {
        columns: dealsInfo.rows.map((r: any) => r.name),
        count: dealsCount.rows[0]?.count,
        sample: dealsSample.rows[0]
      }
    }
    
    client.close()
    
    return res.status(200).json(results)
  } catch (e: any) {
    return res.status(500).json({ 
      error: e.message,
      stack: e.stack 
    })
  }
}
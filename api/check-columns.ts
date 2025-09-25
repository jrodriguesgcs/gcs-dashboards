import type { VercelRequest, VercelResponse } from '@vercel/node'

export default async function handler(
  req: VercelRequest,
  res: VercelResponse
) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  
  try {
    const { createClient } = require('@libsql/client')
    
    const client = createClient({
      url: process.env.TURSO_DATABASE_URL!,
      authToken: process.env.TURSO_AUTH_TOKEN!
    })
    
    // Get first row from contacts to see column names
    const contacts = await client.execute('SELECT * FROM contacts LIMIT 1')
    const contactColumns = contacts.rows[0] ? Object.keys(contacts.rows[0]) : []
    
    // Filter for UTM-related columns
    const utmColumns = contactColumns.filter(col => 
      col.toLowerCase().includes('utm') || 
      col.toLowerCase().includes('medium') ||
      col.toLowerCase().includes('source') ||
      col.toLowerCase().includes('campaign') ||
      col.toLowerCase().includes('submission') ||
      col.toLowerCase().includes('touch')
    )
    
    client.close()
    
    return res.status(200).json({
      allContactColumns: contactColumns,
      utmRelatedColumns: utmColumns,
      totalColumns: contactColumns.length
    })
  } catch (e: any) {
    return res.status(500).json({ error: e.message })
  }
}
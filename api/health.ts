import type { VercelRequest, VercelResponse } from '@vercel/node'
import { getDb, query } from '../lib/db'

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
    // Test database connection
    const db = getDb()
    
    // Get table info
    const tables = query(`SELECT name FROM sqlite_master WHERE type='table'`) as any[]
    const tableNames = tables.map(t => t.name)
    
    // Get row counts
    let contactCount = 0
    let dealCount = 0
    
    if (tableNames.includes('contacts')) {
      const result = query('SELECT COUNT(*) as count FROM contacts') as any[]
      contactCount = result[0]?.count || 0
    }
    
    if (tableNames.includes('deals')) {
      const result = query('SELECT COUNT(*) as count FROM deals') as any[]
      dealCount = result[0]?.count || 0
    }

    return res.status(200).json({ 
      ok: true,
      database: 'local SQLite',
      tables: tableNames,
      counts: {
        contacts: contactCount,
        deals: dealCount
      },
      timestamp: new Date().toISOString()
    })
  } catch (e: any) {
    console.error('Health check error:', e)
    return res.status(500).json({ 
      ok: false, 
      error: e?.message || String(e),
      timestamp: new Date().toISOString()
    })
  }
}
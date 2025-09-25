import type { VercelRequest, VercelResponse } from '@vercel/node'
import { db } from '../lib/db.js'

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
    const url = process.env.TURSO_DATABASE_URL
    const hasToken = !!process.env.TURSO_AUTH_TOKEN
    const client = db()

    const result = await client.execute({ 
      sql: `SELECT name FROM sqlite_master WHERE type='table' LIMIT 5`, 
      args: [] 
    })
    const tables = (result.rows || []).map((r: any) => r.name)
    
    client.close()

    return res.status(200).json({ 
      ok: true, 
      url: url?.split('@')[1], // Show domain only
      hasToken, 
      tables 
    })
  } catch (e: any) {
    console.error('Health check error:', e)
    return res.status(500).json({ 
      ok: false, 
      error: e?.message || String(e) 
    })
  }
}
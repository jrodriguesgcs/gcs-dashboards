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
    // Use require instead of import for @libsql/client
    const { createClient } = require('@libsql/client')
    
    const url = process.env.TURSO_DATABASE_URL
    const authToken = process.env.TURSO_AUTH_TOKEN
    
    if (!url || !authToken) {
      return res.status(400).json({ 
        error: 'Missing database credentials',
        hasUrl: !!url,
        hasToken: !!authToken
      })
    }
    
    const client = createClient({ url, authToken, intMode: 'number' })
    const result = await client.execute({ 
      sql: `SELECT name FROM sqlite_master WHERE type='table' LIMIT 5`, 
      args: [] 
    })
    const tables = (result.rows || []).map((r: any) => r.name)
    
    client.close()

    return res.status(200).json({ 
      ok: true, 
      url: url?.split('@')[1],
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
import type { VercelRequest, VercelResponse } from '@vercel/node'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  
  try {
    const { createClient } = await import('@libsql/client')
    
    const client = createClient({
      url: process.env.TURSO_DATABASE_URL!,
      authToken: process.env.TURSO_AUTH_TOKEN!
    })
    
    const result = await client.execute('SELECT 1 as test')
    client.close()
    
    return res.status(200).json({
      success: true,
      result: result.rows[0],
      timestamp: new Date().toISOString()
    })
  } catch (e: any) {
    return res.status(500).json({ 
      error: e.message,
      stack: e.stack 
    })
  }
}
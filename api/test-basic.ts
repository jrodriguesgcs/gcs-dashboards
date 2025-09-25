import type { VercelRequest, VercelResponse } from '@vercel/node'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  
  try {
    return res.status(200).json({
      message: 'API is working',
      timestamp: new Date().toISOString(),
      environment: process.env.NODE_ENV,
      hasDbUrl: !!process.env.TURSO_DATABASE_URL,
      hasDbToken: !!process.env.TURSO_AUTH_TOKEN
    })
  } catch (e: any) {
    return res.status(500).json({ error: e.message })
  }
}
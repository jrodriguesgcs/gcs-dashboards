import type { VercelRequest, VercelResponse } from '@vercel/node'

export default async function handler(
  req: VercelRequest,
  res: VercelResponse
) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end()
  }

  try {
    const result = {
      timestamp: new Date().toISOString(),
      nodeVersion: process.version,
      platform: process.platform,
      environment: {
        NODE_ENV: process.env.NODE_ENV,
        VERCEL: process.env.VERCEL,
        VERCEL_ENV: process.env.VERCEL_ENV,
        VERCEL_REGION: process.env.VERCEL_REGION
      },
      database: {
        hasUrl: !!process.env.TURSO_DATABASE_URL,
        hasToken: !!process.env.TURSO_AUTH_TOKEN,
        urlLength: process.env.TURSO_DATABASE_URL?.length || 0,
        tokenLength: process.env.TURSO_AUTH_TOKEN?.length || 0,
        urlPreview: process.env.TURSO_DATABASE_URL 
          ? process.env.TURSO_DATABASE_URL.substring(0, 30) + '...'
          : 'NOT_SET'
      }
    }
    
    return res.status(200).json(result)
    
  } catch (e: any) {
    return res.status(500).json({
      error: e.message,
      timestamp: new Date().toISOString()
    })
  }
}
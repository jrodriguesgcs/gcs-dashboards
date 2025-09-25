import type { VercelRequest, VercelResponse } from '@vercel/node'

export default async function handler(
  req: VercelRequest,
  res: VercelResponse
) {
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end()
  }

  try {
    console.log('Simple diagnostic started')
    
    const result: any = {
      timestamp: new Date().toISOString(),
      step1_basic: true,
      step2_env: {},
      step3_import: {},
      step4_connection: {},
      errors: []
    }

    // Step 2: Check environment variables
    try {
      const dbUrl = process.env.TURSO_DATABASE_URL
      const dbToken = process.env.TURSO_AUTH_TOKEN
      
      result.step2_env = {
        success: true,
        hasUrl: !!dbUrl,
        hasToken: !!dbToken,
        urlLength: dbUrl ? dbUrl.length : 0,
        tokenLength: dbToken ? dbToken.length : 0,
        urlPreview: dbUrl ? dbUrl.substring(0, 50) + '...' : 'MISSING'
      }
    } catch (e: any) {
      result.step2_env = { success: false, error: e.message }
      result.errors.push('Environment check failed: ' + e.message)
    }

    // Step 3: Try to import libsql
    try {
      console.log('Attempting to import @libsql/client...')
      const { createClient } = await import('@libsql/client')
      result.step3_import = {
        success: true,
        createClientType: typeof createClient
      }
      console.log('Import successful')
    } catch (e: any) {
      console.error('Import failed:', e)
      result.step3_import = { 
        success: false, 
        error: e.message,
        stack: e.stack
      }
      result.errors.push('Import failed: ' + e.message)
      // Return early if import fails
      return res.status(200).json(result)
    }

    // Step 4: Try database connection (with timeout)
    try {
      console.log('Attempting database connection...')
      
      const { createClient } = await import('@libsql/client')
      
      if (!process.env.TURSO_DATABASE_URL || !process.env.TURSO_AUTH_TOKEN) {
        throw new Error('Missing database credentials')
      }
      
      const client = createClient({
        url: process.env.TURSO_DATABASE_URL,
        authToken: process.env.TURSO_AUTH_TOKEN
      })
      
      console.log('Client created, testing connection...')
      
      // Simple test query with timeout
      const testResult = await Promise.race([
        client.execute('SELECT 1 as test'),
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Connection timeout after 5 seconds')), 5000)
        )
      ])
      
      console.log('Query successful:', testResult)
      
      result.step4_connection = {
        success: true,
        testResult: (testResult as any).rows[0]
      }
      
      client.close()
      console.log('Connection closed')
      
    } catch (e: any) {
      console.error('Database connection failed:', e)
      result.step4_connection = { 
        success: false, 
        error: e.message,
        stack: e.stack?.substring(0, 500)
      }
      result.errors.push('Database connection failed: ' + e.message)
    }

    console.log('Diagnostic complete, returning result')
    return res.status(200).json(result)
    
  } catch (e: any) {
    console.error('Diagnostic function error:', e)
    return res.status(500).json({ 
      error: 'Diagnostic function failed',
      message: e.message,
      stack: e.stack?.substring(0, 500),
      timestamp: new Date().toISOString()
    })
  }
}
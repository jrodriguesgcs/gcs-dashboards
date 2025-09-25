import type { Handler } from '@netlify/functions'

export const handler: Handler = async () => {
  try {
    // Dynamic import to avoid initialization issues
    const { createClient } = await import('@libsql/client')
    
    const url = process.env.TURSO_DATABASE_URL
    const authToken = process.env.TURSO_AUTH_TOKEN
    
    if (!url || !authToken) {
      return {
        statusCode: 400,
        body: JSON.stringify({ 
          error: 'Missing credentials',
          hasUrl: !!url,
          hasToken: !!authToken 
        })
      }
    }
    
    // Create client with minimal config
    const client = createClient({ url, authToken })
    
    // Simple query
    const result = await client.execute('SELECT 1 as test')
    
    // Get table list
    const tables = await client.execute(`SELECT name FROM sqlite_master WHERE type='table' LIMIT 5`)
    
    // Close connection
    client.close()
    
    return {
      statusCode: 200,
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ 
        success: true,
        test: result.rows[0],
        tables: tables.rows.map((r: any) => r.name),
        dbUrl: url.split('@')[1] // Show domain only for security
      })
    }
  } catch (e: any) {
    return {
      statusCode: 500,
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ 
        error: e.message,
        type: e.constructor.name
      })
    }
  }
}
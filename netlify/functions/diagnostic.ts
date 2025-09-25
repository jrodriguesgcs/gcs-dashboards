import type { Handler } from '@netlify/functions'

const json = (statusCode: number, body: any) => ({
  statusCode,
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify(body)
})

export const handler: Handler = async () => {
  try {
    const { createClient } = await import('@libsql/client')
    
    const url = process.env.TURSO_DATABASE_URL
    const authToken = process.env.TURSO_AUTH_TOKEN
    
    if (!url || !authToken) {
      return json(400, { error: 'Missing database credentials' })
    }
    
    // Create a fresh client for this request
    const client = createClient({ 
      url, 
      authToken,
      intMode: 'number'
    })
    
    const results: any = { 
      tables: [],
      contactColumns: [],
      dealColumns: [],
      utmRelated: [],
      sdrRelated: []
    }
    
    try {
      // Step 1: Get table names
      const tables = await client.execute(`SELECT name FROM sqlite_master WHERE type='table' LIMIT 10`)
      results.tables = tables.rows.map((r: any) => r.name)
      
      // Step 2: Try to get one row from contacts to see actual columns
      try {
        const contactSample = await client.execute(`SELECT * FROM contacts LIMIT 1`)
        if (contactSample.rows && contactSample.rows[0]) {
          results.contactColumns = Object.keys(contactSample.rows[0])
          
          // Find UTM-related columns
          results.utmRelated = results.contactColumns.filter((col: string) => 
            col.toLowerCase().includes('utm') || 
            col.toLowerCase().includes('medium') ||
            col.toLowerCase().includes('source') ||
            col.toLowerCase().includes('campaign') ||
            col.toLowerCase().includes('submission')
          )
        }
      } catch (e: any) {
        results.contactError = `Could not read contacts: ${e.message}`
      }
      
      // Step 3: Try to get one row from deals to see actual columns  
      try {
        const dealSample = await client.execute(`SELECT * FROM deals LIMIT 1`)
        if (dealSample.rows && dealSample.rows[0]) {
          results.dealColumns = Object.keys(dealSample.rows[0])
          
          // Find SDR-related columns
          results.sdrRelated = results.dealColumns.filter((col: string) =>
            col.toLowerCase().includes('sdr') ||
            col.toLowerCase().includes('agent')
          )
        }
      } catch (e: any) {
        results.dealError = `Could not read deals: ${e.message}`
      }
      
      // Step 4: Check for specific problematic columns
      const checkColumns = [
        '*UTM Medium',
        'UTM Medium', 
        '*First Touch UTM Medium',
        'First Touch UTM Medium',
        '--- SDR AGENT --- REQUIRED FIELD ---'
      ]
      
      results.columnChecks = {}
      
      for (const col of checkColumns) {
        try {
          // Try with quotes
          const q1 = await client.execute({
            sql: `SELECT "${col.replace(/"/g, '""')}" FROM contacts LIMIT 1`,
            args: []
          })
          results.columnChecks[col] = 'exists in contacts (with quotes)'
        } catch {
          try {
            // Try with brackets
            const q2 = await client.execute({
              sql: `SELECT [${col.replace(/\]/g, ']]')}] FROM contacts LIMIT 1`,
              args: []
            })
            results.columnChecks[col] = 'exists in contacts (with brackets)'
          } catch {
            try {
              // Try in deals table
              const q3 = await client.execute({
                sql: `SELECT "${col.replace(/"/g, '""')}" FROM deals LIMIT 1`,
                args: []
              })
              results.columnChecks[col] = 'exists in deals'
            } catch {
              results.columnChecks[col] = 'NOT FOUND'
            }
          }
        }
      }
      
    } catch (e: any) {
      results.queryError = e.message
    }
    
    // Close the client
    client.close()
    
    return json(200, results)
    
  } catch (e: any) {
    console.error('diagnostic error:', e)
    return json(500, { 
      error: e?.message || String(e),
      stack: e?.stack,
      env: {
        hasUrl: !!process.env.TURSO_DATABASE_URL,
        hasToken: !!process.env.TURSO_AUTH_TOKEN
      }
    })
  }
}
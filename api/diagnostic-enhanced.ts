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

  const diagnostics: any = {
    timestamp: new Date().toISOString(),
    environment: {
      nodeVersion: process.version,
      platform: process.platform,
      hasUrl: !!process.env.TURSO_DATABASE_URL,
      hasToken: !!process.env.TURSO_AUTH_TOKEN,
      urlPreview: process.env.TURSO_DATABASE_URL ? 
        process.env.TURSO_DATABASE_URL.substring(0, 30) + '...' : null
    },
    tests: {}
  }

  // Test 1: Environment Variables
  try {
    const url = process.env.TURSO_DATABASE_URL
    const authToken = process.env.TURSO_AUTH_TOKEN
    
    diagnostics.tests.environmentVariables = {
      success: !!(url && authToken),
      details: {
        hasUrl: !!url,
        hasToken: !!authToken,
        urlLength: url?.length || 0,
        tokenLength: authToken?.length || 0
      }
    }
  } catch (e: any) {
    diagnostics.tests.environmentVariables = {
      success: false,
      error: e.message
    }
  }

  // Test 2: LibSQL Import
  try {
    const { createClient } = await import('@libsql/client')
    diagnostics.tests.libsqlImport = {
      success: true,
      clientFunction: typeof createClient
    }
  } catch (e: any) {
    diagnostics.tests.libsqlImport = {
      success: false,
      error: e.message,
      stack: e.stack
    }
    return res.status(500).json(diagnostics)
  }

  // Test 3: Database Connection
  try {
    const { createClient } = await import('@libsql/client')
    const client = createClient({
      url: process.env.TURSO_DATABASE_URL!,
      authToken: process.env.TURSO_AUTH_TOKEN!,
      intMode: 'number'
    })
    
    diagnostics.tests.databaseConnection = { success: true }
    client.close()
  } catch (e: any) {
    diagnostics.tests.databaseConnection = {
      success: false,
      error: e.message,
      stack: e.stack
    }
    return res.status(500).json(diagnostics)
  }

  // Test 4: Basic Query
  try {
    const { createClient } = await import('@libsql/client')
    const client = createClient({
      url: process.env.TURSO_DATABASE_URL!,
      authToken: process.env.TURSO_AUTH_TOKEN!,
      intMode: 'number'
    })
    
    const result = await client.execute('SELECT 1 as test')
    diagnostics.tests.basicQuery = {
      success: true,
      result: result.rows[0]
    }
    client.close()
  } catch (e: any) {
    diagnostics.tests.basicQuery = {
      success: false,
      error: e.message
    }
  }

  // Test 5: List Tables
  try {
    const { createClient } = await import('@libsql/client')
    const client = createClient({
      url: process.env.TURSO_DATABASE_URL!,
      authToken: process.env.TURSO_AUTH_TOKEN!,
      intMode: 'number'
    })
    
    const result = await client.execute(`SELECT name FROM sqlite_master WHERE type='table'`)
    const tables = result.rows.map((r: any) => r.name)
    
    diagnostics.tests.listTables = {
      success: true,
      tables,
      tableCount: tables.length
    }
    client.close()
  } catch (e: any) {
    diagnostics.tests.listTables = {
      success: false,
      error: e.message
    }
  }

  // Test 6: Contacts Table Structure
  try {
    const { createClient } = await import('@libsql/client')
    const client = createClient({
      url: process.env.TURSO_DATABASE_URL!,
      authToken: process.env.TURSO_AUTH_TOKEN!,
      intMode: 'number'
    })
    
    // Get table info
    const tableInfo = await client.execute(`PRAGMA table_info(contacts)`)
    const columns = tableInfo.rows.map((r: any) => ({
      name: r.name,
      type: r.type,
      notNull: r.notnull,
      pk: r.pk
    }))
    
    // Get sample data
    const sampleData = await client.execute('SELECT * FROM contacts LIMIT 3')
    
    diagnostics.tests.contactsTable = {
      success: true,
      columnCount: columns.length,
      columns,
      sampleRowCount: sampleData.rows.length,
      sampleData: sampleData.rows
    }
    client.close()
  } catch (e: any) {
    diagnostics.tests.contactsTable = {
      success: false,
      error: e.message
    }
  }

  // Test 7: Deals Table Structure
  try {
    const { createClient } = await import('@libsql/client')
    const client = createClient({
      url: process.env.TURSO_DATABASE_URL!,
      authToken: process.env.TURSO_AUTH_TOKEN!,
      intMode: 'number'
    })
    
    // Get table info
    const tableInfo = await client.execute(`PRAGMA table_info(deals)`)
    const columns = tableInfo.rows.map((r: any) => ({
      name: r.name,
      type: r.type,
      notNull: r.notnull,
      pk: r.pk
    }))
    
    // Get sample data
    const sampleData = await client.execute('SELECT * FROM deals LIMIT 3')
    
    diagnostics.tests.dealsTable = {
      success: true,
      columnCount: columns.length,
      columns,
      sampleRowCount: sampleData.rows.length,
      sampleData: sampleData.rows
    }
    client.close()
  } catch (e: any) {
    diagnostics.tests.dealsTable = {
      success: false,
      error: e.message
    }
  }

  // Test 8: Join Query Test
  try {
    const { createClient } = await import('@libsql/client')
    const client = createClient({
      url: process.env.TURSO_DATABASE_URL!,
      authToken: process.env.TURSO_AUTH_TOKEN!,
      intMode: 'number'
    })
    
    const joinQuery = `
      SELECT 
        c."ID" as contact_id,
        c."Email" as email,
        d."Deal ID" as deal_id
      FROM contacts c
      LEFT JOIN deals d ON c."ID" = d."Primary Contact ID"
      LIMIT 5
    `
    
    const result = await client.execute(joinQuery)
    
    diagnostics.tests.joinQuery = {
      success: true,
      rowCount: result.rows.length,
      sampleData: result.rows
    }
    client.close()
  } catch (e: any) {
    diagnostics.tests.joinQuery = {
      success: false,
      error: e.message
    }
  }

  // Summary
  const successfulTests = Object.values(diagnostics.tests).filter((t: any) => t.success).length
  const totalTests = Object.keys(diagnostics.tests).length
  
  diagnostics.summary = {
    successfulTests,
    totalTests,
    overallHealth: successfulTests === totalTests ? 'HEALTHY' : 'ISSUES_DETECTED'
  }

  return res.status(200).json(diagnostics)
}
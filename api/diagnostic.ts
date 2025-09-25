import type { VercelRequest, VercelResponse } from '@vercel/node'
import { query } from '../lib/db'
import path from 'path'
import fs from 'fs'

export default async function handler(
  req: VercelRequest,
  res: VercelResponse
) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS')
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end()
  }

  const diagnostics: any = {
    timestamp: new Date().toISOString(),
    environment: {
      nodeVersion: process.version,
      platform: process.platform,
      cwd: process.cwd()
    },
    tests: {}
  }

  // Test 1: Check if database file exists
  try {
    const dbPath = path.join(process.cwd(), 'activecampaign.db')
    const exists = fs.existsSync(dbPath)
    const stats = exists ? fs.statSync(dbPath) : null
    
    diagnostics.tests.databaseFile = {
      success: exists,
      path: dbPath,
      exists,
      size: stats?.size || 0,
      modified: stats?.mtime || null
    }
    
    if (!exists) {
      diagnostics.tests.databaseFile.error = 'Database file not found'
    }
  } catch (e: any) {
    diagnostics.tests.databaseFile = {
      success: false,
      error: e.message
    }
  }

  // Test 2: Try to connect and query
  try {
    const tables = query(`SELECT name FROM sqlite_master WHERE type='table'`) as any[]
    const tableNames = tables.map(t => t.name)
    
    diagnostics.tests.databaseConnection = {
      success: true,
      tables: tableNames,
      tableCount: tableNames.length
    }
  } catch (e: any) {
    diagnostics.tests.databaseConnection = {
      success: false,
      error: e.message
    }
    // Return early if connection fails
    diagnostics.summary = {
      successfulTests: 1,
      totalTests: 2,
      overallHealth: 'ISSUES_DETECTED'
    }
    return res.status(200).json(diagnostics)
  }

  // Test 3: Check contacts table
  try {
    const contactsInfo = query(`PRAGMA table_info(contacts)`) as any[]
    const contactsCount = query(`SELECT COUNT(*) as count FROM contacts`) as any[]
    const contactsSample = query(`SELECT * FROM contacts LIMIT 3`) as any[]
    
    diagnostics.tests.contactsTable = {
      success: true,
      columnCount: contactsInfo.length,
      columns: contactsInfo.map(c => c.name),
      rowCount: contactsCount[0]?.count || 0,
      sampleRowCount: contactsSample.length
    }
  } catch (e: any) {
    diagnostics.tests.contactsTable = {
      success: false,
      error: e.message
    }
  }

  // Test 4: Check deals table
  try {
    const dealsInfo = query(`PRAGMA table_info(deals)`) as any[]
    const dealsCount = query(`SELECT COUNT(*) as count FROM deals`) as any[]
    const dealsSample = query(`SELECT * FROM deals LIMIT 3`) as any[]
    
    diagnostics.tests.dealsTable = {
      success: true,
      columnCount: dealsInfo.length,
      columns: dealsInfo.map(c => c.name),
      rowCount: dealsCount[0]?.count || 0,
      sampleRowCount: dealsSample.length
    }
  } catch (e: any) {
    diagnostics.tests.dealsTable = {
      success: false,
      error: e.message
    }
  }

  // Test 5: Test join query
  try {
    const joinResult = query(`
      SELECT 
        c."ID" as contact_id,
        c."Email" as email,
        d."Deal ID" as deal_id
      FROM contacts c
      LEFT JOIN deals d ON c."ID" = d."Primary Contact ID"
      LIMIT 5
    `) as any[]
    
    diagnostics.tests.joinQuery = {
      success: true,
      rowCount: joinResult.length,
      sampleData: joinResult.map(r => ({
        contact_id: r.contact_id,
        has_email: !!r.email,
        has_deal: !!r.deal_id
      }))
    }
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
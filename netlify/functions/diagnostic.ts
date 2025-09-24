import type { Handler } from '@netlify/functions'
import { db } from './_db'

const json = (statusCode: number, body: any) => ({
  statusCode,
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify(body)
})

export const handler: Handler = async () => {
  try {
    const client = db()
    
    // Get all columns from contacts table
    const contactsInfo = await client.execute({
      sql: `PRAGMA table_info(contacts)`,
      args: []
    })
    
    // Get all columns from deals table
    const dealsInfo = await client.execute({
      sql: `PRAGMA table_info(deals)`,
      args: []
    })
    
    // Get sample data to see actual column values
    const contactSample = await client.execute({
      sql: `SELECT * FROM contacts LIMIT 1`,
      args: []
    })
    
    const dealSample = await client.execute({
      sql: `SELECT * FROM deals LIMIT 1`,
      args: []
    })
    
    // Format column names for easier reading
    const contactColumns = (contactsInfo.rows || []).map((r: any) => ({
      name: r.name,
      type: r.type,
      hasAsterisk: r.name?.includes('*'),
      hasSpaces: r.name?.includes(' ')
    }))
    
    const dealColumns = (dealsInfo.rows || []).map((r: any) => ({
      name: r.name,
      type: r.type,
      hasAsterisk: r.name?.includes('*'),
      hasSpaces: r.name?.includes(' ')
    }))
    
    // Look for UTM-related columns
    const utmColumns = contactColumns.filter((c: any) => 
      c.name?.toLowerCase().includes('utm') || 
      c.name?.toLowerCase().includes('medium') ||
      c.name?.toLowerCase().includes('source') ||
      c.name?.toLowerCase().includes('campaign') ||
      c.name?.toLowerCase().includes('submission')
    )
    
    // Look for SDR-related columns
    const sdrColumns = dealColumns.filter((c: any) =>
      c.name?.toLowerCase().includes('sdr') ||
      c.name?.toLowerCase().includes('agent')
    )
    
    // Get actual column names from sample data
    const contactSampleKeys = contactSample.rows?.[0] ? Object.keys(contactSample.rows[0]) : []
    const dealSampleKeys = dealSample.rows?.[0] ? Object.keys(dealSample.rows[0]) : []
    
    return json(200, {
      summary: {
        contactsTableColumns: contactColumns.length,
        dealsTableColumns: dealColumns.length,
        utmRelatedColumns: utmColumns.length,
        sdrRelatedColumns: sdrColumns.length
      },
      utmColumns,
      sdrColumns,
      contactColumns: contactColumns.slice(0, 20), // First 20 for brevity
      dealColumns: dealColumns.slice(0, 20),
      sampleKeys: {
        contacts: contactSampleKeys.slice(0, 10),
        deals: dealSampleKeys.slice(0, 10)
      },
      problematicColumns: {
        contacts: contactColumns.filter((c: any) => c.hasAsterisk || c.hasSpaces),
        deals: dealColumns.filter((c: any) => c.hasAsterisk || c.hasSpaces)
      }
    })
  } catch (e: any) {
    console.error('diagnostic error', e)
    return json(500, { 
      error: e?.message || String(e),
      stack: e?.stack
    })
  }
}
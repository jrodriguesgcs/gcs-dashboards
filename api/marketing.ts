import type { VercelRequest, VercelResponse } from '@vercel/node'
import { query } from '../lib/db'

// Column name constants
const UTM_MED = 'UTM Medium'
const UTM_SRC = 'UTM Source'
const UTM_CAM = 'UTM Campaign'
const SUB_PAGE = 'Submission Page'

function group<T>(arr: T[], keyFn: (item: T) => string): Record<string, T[]> {
  return arr.reduce((acc, item) => {
    const key = keyFn(item) || '(not set)'
    if (!acc[key]) acc[key] = []
    acc[key].push(item)
    return acc
  }, {} as Record<string, T[]>)
}

function counts(list: any[]) {
  return {
    contacts: list.length,
    deals_created: list.filter(r => r.deal_id).length,
    distributed: list.filter(r => r.distributed_at).length,
    calls_scheduled: list.filter(r => r.calendly_created_at).length,
    calls_completed: list.filter(r => r.calendly_time).length,
    proposals: list.filter(r => r.proposal_sent_at).length,
    closed_won: list.filter(r => r.proposal_signed_at).length
  }
}

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
    const qp = req.query as Record<string, string>
    const contactOnly = qp.contactOnly === '1'

    // Check what columns exist first
    const contactColumns = query(`PRAGMA table_info(contacts)`) as any[]
    const availableColumns = contactColumns.map(c => c.name)
    
    // Build dynamic SQL based on available columns
    let sql = `
      SELECT
        c."ID" AS contact_id,
        c."Email" AS email,
        c."Date Created" AS contact_created,
        `
    
    // Add UTM columns if they exist
    if (availableColumns.includes(UTM_MED)) {
      sql += `c."${UTM_MED}" AS utm_medium,`
    } else {
      sql += `NULL AS utm_medium,`
    }
    
    if (availableColumns.includes(UTM_SRC)) {
      sql += `c."${UTM_SRC}" AS utm_source,`
    } else {
      sql += `NULL AS utm_source,`
    }
    
    if (availableColumns.includes(UTM_CAM)) {
      sql += `c."${UTM_CAM}" AS utm_campaign,`
    } else {
      sql += `NULL AS utm_campaign,`
    }
    
    if (availableColumns.includes(SUB_PAGE)) {
      sql += `c."${SUB_PAGE}" AS submission_page,`
    } else {
      sql += `NULL AS submission_page,`
    }

    sql += `
        NULL AS ft_medium,
        NULL AS ft_source, 
        NULL AS ft_campaign,
        NULL AS ft_submission_page,
        d."Deal ID" AS deal_id,
        d."Deal Creation Date Time" AS deal_created,
        d."DISTRIBUTION Time" AS distributed_at,
        d."CALENDLY Event Created At" AS calendly_created_at,
        d."CALENDLY Time" AS calendly_time,
        d."Deal Proposal Sent Date Time" AS proposal_sent_at,
        d."Deal Proposal Signed Date Time" AS proposal_signed_at
      FROM contacts c
      LEFT JOIN deals d ON c."ID" = d."Primary Contact ID"
      LIMIT 10000
    `

    const rows = query(sql) as any[]

    // Filter by date ranges if provided
    let filteredRows = rows
    
    // Apply date filters here if needed based on qp parameters
    // (Add filtering logic based on your requirements)

    // Group by UTM Medium
    const byUtmMedium = group(filteredRows, r => r.utm_medium || '(not set)')
    const utmAnalysis = Object.keys(byUtmMedium)
      .sort((a, b) => a.localeCompare(b))
      .map(medium => {
        const mediumRows = byUtmMedium[medium]
        const bySource = group(mediumRows, r => r.utm_source || '(not set)')
        
        return {
          key: `m:${medium}`,
          label: medium,
          metrics: counts(mediumRows),
          children: Object.keys(bySource)
            .sort((a, b) => a.localeCompare(b))
            .map(source => ({
              key: `s:${medium}:${source}`,
              label: source,
              metrics: counts(bySource[source])
            }))
        }
      })

    // Group by Submission Page
    const bySubmissionPage = group(filteredRows, r => r.submission_page || '(not set)')
    const submissionAnalysis = Object.keys(bySubmissionPage)
      .sort((a, b) => a.localeCompare(b))
      .map(page => ({
        key: `sub:${page}`,
        label: page,
        metrics: counts(bySubmissionPage[page])
      }))

    // Sample rows for debugging (mask emails)
    const sampleRows = filteredRows.slice(0, 10).map(r => ({
      ...r,
      email_masked: r.email ? r.email.substring(0, 1) + '***@' + r.email.split('@')[1] : '(not set)'
    }))

    return res.status(200).json({ 
      tabs: { 
        utm: utmAnalysis, 
        firstTouch: [], // Not implemented yet
        ftSubmission: [], // Not implemented yet
        submission: submissionAnalysis 
      }, 
      sampleRows
    })
  } catch (e: any) {
    console.error('marketing error:', e)
    return res.status(500).json({ error: e.message || String(e) })
  }
}
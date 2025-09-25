import type { VercelRequest, VercelResponse } from '@vercel/node'
import { query } from '../lib/db'
import { diffMinutes, diffDays } from '../lib/time'

// Helper functions
function pct(a: number, b: number) {
  return b > 0 ? Math.round((a/b)*1000)/10 : 0
}

function group<T>(arr: T[], keyFn: (item: T) => string): Record<string, T[]> {
  return arr.reduce((acc, item) => {
    const key = keyFn(item) || '(not set)'
    if (!acc[key]) acc[key] = []
    acc[key].push(item)
    return acc
  }, {} as Record<string, T[]>)
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
    const metaOnly = req.query.pathname === '/meta'
    
    // For meta, just return owner list
    if (metaOnly) {
      const result = query(`
        SELECT DISTINCT "Owner Name" AS owner 
        FROM deals 
        WHERE "Owner Name" IS NOT NULL 
        AND "Owner Name" != ''
        ORDER BY "Owner Name"
        LIMIT 50
      `) as any[]
      
      const owners = result.map(r => r.owner).filter(Boolean)
      return res.status(200).json({ owners })
    }

    // Parse query parameters for filtering
    const qp = req.query as Record<string, string>
    const owners = (qp.owners || '').split('||').filter(Boolean)

    // For main query, get deal data
    let sql = `
      SELECT
        d."Deal ID" AS deal_id,
        d."Owner Name" AS owner,
        d."Primary Country of Interest" AS country,
        d."Primary Program of Interest" AS program,
        d."Deal Creation Date Time" AS created_at,
        d."DISTRIBUTION Time" AS distributed_at,
        d."CALENDLY Event Created At" AS calendly_created_at,
        d."CALENDLY Time" AS calendly_time,
        d."Deal Proposal Sent Date Time" AS proposal_sent_at,
        d."Deal Proposal Signed Date Time" AS proposal_signed_at
      FROM deals d
      WHERE 1=1
    `
    
    const params: any[] = []
    
    // Add owner filter if provided
    if (owners.length > 0) {
      const placeholders = owners.map(() => '?').join(',')
      sql += ` AND d."Owner Name" IN (${placeholders})`
      params.push(...owners)
    }
    
    sql += ' LIMIT 10000'

    const rows = query(sql, params) as any[]

    // Calculate overview stats
    const overview = {
      created: rows.length,
      distributed: rows.filter(r => r.distributed_at).length,
      calls_scheduled: rows.filter(r => r.calendly_created_at).length,
      calls_completed: rows.filter(r => r.calendly_time).length,
      proposals: rows.filter(r => r.proposal_sent_at).length,
      closed_won: rows.filter(r => r.proposal_signed_at).length
    }

    // Group by owner for conversion analysis
    const byOwner = group(rows, r => r.owner || '(not set)')
    const ownerConversion = Object.keys(byOwner)
      .sort((a, b) => a.localeCompare(b))
      .map(owner => {
        const ownerRows = byOwner[owner]
        const created = ownerRows.length
        const distributed = ownerRows.filter(r => r.distributed_at).length
        const calls_scheduled = ownerRows.filter(r => r.calendly_created_at).length
        const calls_completed = ownerRows.filter(r => r.calendly_time).length
        const proposals = ownerRows.filter(r => r.proposal_sent_at).length
        const closed_won = ownerRows.filter(r => r.proposal_signed_at).length

        return {
          owner,
          created,
          distributed,
          calls_scheduled,
          calls_completed,
          proposals,
          closed_won,
          conv_created_to_distributed: pct(distributed, created),
          conv_distributed_to_scheduled: pct(calls_scheduled, distributed),
          conv_scheduled_to_completed: pct(calls_completed, calls_scheduled),
          conv_completed_to_proposal: pct(proposals, calls_completed),
          conv_proposal_to_won: pct(closed_won, proposals)
        }
      })

    // Time intervals analysis
    const timeIntervals = Object.keys(byOwner)
      .sort((a, b) => a.localeCompare(b))
      .map(owner => {
        const ownerRows = byOwner[owner]
        
        const distTimes = ownerRows
          .map(r => diffMinutes(r.created_at, r.distributed_at))
          .filter(t => t !== null) as number[]
        
        const bookingTimes = ownerRows
          .map(r => diffDays(r.distributed_at, r.calendly_created_at))
          .filter(t => t !== null) as number[]
          
        const connTimes = ownerRows
          .map(r => diffDays(r.calendly_created_at, r.calendly_time))
          .filter(t => t !== null) as number[]
        
        const distShowTimes = ownerRows
          .map(r => diffDays(r.distributed_at, r.calendly_time))
          .filter(t => t !== null) as number[]
          
        const propTimes = ownerRows
          .map(r => diffMinutes(r.calendly_time, r.proposal_sent_at))
          .filter(t => t !== null) as number[]
          
        const closeTimes = ownerRows
          .map(r => diffDays(r.proposal_sent_at, r.proposal_signed_at))
          .filter(t => t !== null) as number[]

        const avg = (arr: number[]) => arr.length ? Math.round((arr.reduce((a, b) => a + b, 0) / arr.length) * 100) / 100 : null
        const median = (arr: number[]) => {
          if (!arr.length) return null
          const sorted = [...arr].sort((a, b) => a - b)
          const mid = Math.floor(sorted.length / 2)
          return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2
        }

        return {
          owner,
          t_dist_avg: avg(distTimes),
          t_dist_med: median(distTimes),
          t_dist_modes: distTimes.length ? `${distTimes.length} samples` : '',
          t_booking_avg: avg(bookingTimes),
          t_booking_med: median(bookingTimes),
          t_booking_modes: bookingTimes.length ? `${bookingTimes.length} samples` : '',
          t_conn_avg: avg(connTimes),
          t_conn_med: median(connTimes),
          t_conn_modes: connTimes.length ? `${connTimes.length} samples` : '',
          t_dist_show_avg: avg(distShowTimes),
          t_dist_show_med: median(distShowTimes),
          t_dist_show_modes: distShowTimes.length ? `${distShowTimes.length} samples` : '',
          t_prop_avg: avg(propTimes),
          t_prop_med: median(propTimes),
          t_prop_modes: propTimes.length ? `${propTimes.length} samples` : '',
          t_close_avg: avg(closeTimes),
          t_close_med: median(closeTimes),
          t_close_modes: closeTimes.length ? `${closeTimes.length} samples` : ''
        }
      })

    // Breakdown by country and program
    const byCountry = group(rows, r => r.country || '(not set)')
    const breakdown = Object.keys(byCountry)
      .sort((a, b) => a.localeCompare(b))
      .map(country => {
        const countryRows = byCountry[country]
        const byProgram = group(countryRows, r => r.program || '(not set)')
        
        const countryMetrics = {
          created: countryRows.length,
          distributed: countryRows.filter(r => r.distributed_at).length,
          calls_scheduled: countryRows.filter(r => r.calendly_created_at).length,
          calls_completed: countryRows.filter(r => r.calendly_time).length,
          proposals: countryRows.filter(r => r.proposal_sent_at).length,
          closed_won: countryRows.filter(r => r.proposal_signed_at).length
        }
        
        const children = Object.keys(byProgram)
          .sort((a, b) => a.localeCompare(b))
          .map(program => {
            const programRows = byProgram[program]
            return {
              key: `p:${country}:${program}`,
              label: program,
              metrics: {
                created: programRows.length,
                distributed: programRows.filter(r => r.distributed_at).length,
                calls_scheduled: programRows.filter(r => r.calendly_created_at).length,
                calls_completed: programRows.filter(r => r.calendly_time).length,
                proposals: programRows.filter(r => r.proposal_sent_at).length,
                closed_won: programRows.filter(r => r.proposal_signed_at).length
              }
            }
          })

        return {
          key: `c:${country}`,
          label: country,
          metrics: countryMetrics,
          children
        }
      })

    return res.status(200).json({ 
      tabs: { 
        overview,
        ownerConversion,
        timeIntervals,
        breakdown
      }
    })
  } catch (e: any) {
    console.error('Sales error:', e)
    return res.status(500).json({ error: e.message || String(e) })
  }
}
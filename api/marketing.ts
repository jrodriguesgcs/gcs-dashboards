import type { VercelRequest, VercelResponse } from '@vercel/node'
import { db } from '../lib/db'
import { monthKey } from '../lib/time'
import { normalizeUTM, maskEmail } from '../lib/util'

// Contact fields (keep "Date Created" with normal quoting)
const CONTACT_CREATED = 'Date Created'

// UTM / First-touch field names (we'll bracket-quote them in SQL)
const FT_MED = '*First Touch UTM Medium'
const FT_SRC = '*First Touch UTM Source'
const FT_CAM = '*First Touch UTM Campaign'
const FT_SUB = '*First Touch Submission Page'

const UTM_MED = '*UTM Medium'
const UTM_SRC = '*UTM Source'
const UTM_CAM = '*UTM Campaign'
const SUB_PAGE = '*Submission Page'

// helper to safely wrap weird column names for SQLite
const Q = (s:string) => `[${s.replace(/]/g, ']]')}]`

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

    const ranges: Record<string,[string?, string?]> = {
      contactCreated: [qp.contactCreatedFrom, qp.contactCreatedTo],
      dealCreated: [qp.dealCreatedFrom, qp.dealCreatedTo],
      distributed: [qp.distributedFrom, qp.distributedTo],
      proposalSent: [qp.proposalSentFrom, qp.proposalSentTo],
      proposalSigned: [qp.proposalSignedFrom, qp.proposalSignedTo]
    }

    const client = db()
    const result = await client.execute({
      sql: `
        SELECT
          c."ID" AS contact_id,
          c."Email" AS email,
          c."${CONTACT_CREATED}" AS contact_created,

          c.${Q(UTM_MED)} AS utm_medium,
          c.${Q(UTM_SRC)} AS utm_source,
          c.${Q(UTM_CAM)} AS utm_campaign,
          c.${Q(SUB_PAGE)} AS submission_page,

          c.${Q(FT_MED)} AS ft_medium,
          c.${Q(FT_SRC)} AS ft_source,
          c.${Q(FT_CAM)} AS ft_campaign,
          c.${Q(FT_SUB)} AS ft_submission_page,

          d."Deal ID" AS deal_id,
          d."Deal Creation Date Time" AS deal_created,
          d."DISTRIBUTION Time" AS distributed_at,
          d."CALENDLY Event Created At" AS calendly_created_at,
          d."CALENDLY Time" AS calendly_time,
          d."Deal Proposal Sent Date Time" AS proposal_sent_at,
          d."Deal Proposal Signed Date Time" AS proposal_signed_at
        FROM contacts c
        LEFT JOIN deals d ON c."ID" = d."Primary Contact ID"
        LIMIT 300000
      `,
      args: []
    })
    let rows = result.rows as any[]

    const inRange = (val?: string|null, from?: string, to?: string) => {
      if (!from && !to) return true
      const mk = monthKey(val)
      if (!mk) return false
      const mFrom = from ? from.slice(0,7) : ''
      const mTo = to ? to.slice(0,7) : ''
      if (mFrom && mk < mFrom) return false
      if (mTo && mk > mTo) return false
      return true
    }

    if (contactOnly) {
      const [from,to] = ranges.contactCreated
      rows = rows.filter((r:any) => inRange(r.contact_created, from, to))
    } else {
      rows = rows.filter((r:any) =>
        inRange(r.contact_created, ranges.contactCreated[0], ranges.contactCreated[1]) &&
        inRange(r.deal_created, ranges.dealCreated[0], ranges.dealCreated[1]) &&
        inRange(r.distributed_at, ranges.distributed[0], ranges.distributed[1]) &&
        inRange(r.proposal_sent_at, ranges.proposalSent[0], ranges.proposalSent[1]) &&
        inRange(r.proposal_signed_at, ranges.proposalSigned[0], ranges.proposalSigned[1])
      )
    }

    function groupMSC(med?:string|null, src?:string|null, cam?:string|null) {
      const { utm_medium, utm_source } = normalizeUTM(med, src)
      return {
        m: utm_medium || '(not set)',
        s: utm_source || '(not set)',
        c: (cam||'(not set)').toLowerCase().trim() || '(not set)'
      }
    }

    function stepCounts(list:any[]){
      const contacts = new Set(list.map((r:any)=>r.contact_id).filter(Boolean)).size
      const deals_created = list.filter((r:any)=>r.deal_id && r.deal_created).length
      const distributed = list.filter((r:any)=>r.distributed_at).length
      const calls_scheduled = list.filter((r:any)=>r.calendly_created_at).length
      const calls_completed = list.filter((r:any)=>r.calendly_time).length
      const proposals = list.filter((r:any)=>r.proposal_sent_at).length
      const closed_won = list.filter((r:any)=>r.proposal_signed_at).length
      return { contacts, deals_created, distributed, calls_scheduled, calls_completed, proposals, closed_won }
    }

    function group<T>(arr:T[], key:(r:T)=>string){
      return arr.reduce((acc:Record<string,T[]>, r:any)=>{ const k = key(r)||''; (acc[k] ||= []).push(r); return acc },{})
    }

    function buildTree(items:any[], picker: (r:any)=>{m:string,s:string,c:string}) {
      const byM = group(items, (r:any) => picker(r).m)
      return Object.keys(byM).sort((a:string,b:string)=>a.localeCompare(b)).map((med: string) => {
        const listM = byM[med]
        const byS = group(listM, (r:any) => picker(r).s)
        return {
          key:'m:'+med, label: med,
          metrics: stepCounts(listM),
          children: Object.keys(byS).sort((a:string,b:string)=>a.localeCompare(b)).map((src: string) => {
            const listS = byS[src]
            const byC = group(listS, (r:any) => picker(r).c)
            return {
              key:'s:'+med+':'+src, label: src,
              metrics: stepCounts(listS),
              children: Object.keys(byC).sort((a:string,b:string)=>a.localeCompare(b)).map((cam: string) => ({
                key:'c:'+med+':'+src+':'+cam, label: cam,
                metrics: stepCounts(byC[cam])
              }))
            }
          })
        }
      })
    }

    const tabs = {
      utm: buildTree(rows, (r:any) => groupMSC(r.utm_medium, r.utm_source, r.utm_campaign)),
      firstTouch: buildTree(rows, (r:any) => groupMSC(r.ft_medium, r.ft_source, r.ft_campaign)),
      ftSubmission: buildTree(rows, (r:any) => groupMSC(r.ft_medium, r.ft_source, r.ft_submission_page)),
      submission: buildTree(rows, (r:any) => groupMSC(r.utm_medium, r.utm_source, r.submission_page))
    }

    const sampleRows = rows.slice(0, 500).map((r:any) => ({
      contact_id: r.contact_id,
      email_masked: maskEmail(r.email),
      utm_medium: r.utm_medium || '(not set)',
      utm_source: r.utm_source || '(not set)',
      utm_campaign: r.utm_campaign || '(not set)'
    }))

    client.close()
    return res.status(200).json({ tabs, sampleRows })
  } catch (e:any) {
    console.error('marketing error', e)
    return res.status(500).json({ error: e?.message || String(e) })
  }
}
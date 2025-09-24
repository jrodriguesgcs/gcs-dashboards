import { Handler } from '@netlify/functions'
import { db } from './_db'
import { monthKey } from './_time'
import { normalizeUTM, maskEmail } from './_util'

const FT_MED = '*First Touch UTM Medium'
const FT_SRC = '*First Touch UTM Source'
const FT_CAM = '*First Touch UTM Campaign'
const FT_SUB = '*First Touch Submission Page'

const UTM_MED = '*UTM Medium'
const UTM_SRC = '*UTM Source'
const UTM_CAM = '*UTM Campaign'
const SUB_PAGE = '*Submission Page'

const CONTACT_CREATED = 'Date Created' // contacts

const handler: Handler = async (event) => {
  const qp = event.queryStringParameters || {}
  const contactOnly = qp.contactOnly === '1'

  const ranges = {
    contactCreated: [qp.contactCreatedFrom, qp.contactCreatedTo],
    dealCreated: [qp.dealCreatedFrom, qp.dealCreatedTo],
    distributed: [qp.distributedFrom, qp.distributedTo],
    proposalSent: [qp.proposalSentFrom, qp.proposalSentTo],
    proposalSigned: [qp.proposalSignedFrom, qp.proposalSignedTo]
  }

  const client = db()
  // bring only the columns we need
  const res = await client.execute({
    sql: `
      SELECT
        c."ID" AS contact_id,
        c."Email" AS email,
        c."${CONTACT_CREATED}" AS contact_created,

        c."${UTM_MED}" AS utm_medium,
        c."${UTM_SRC}" AS utm_source,
        c."${UTM_CAM}" AS utm_campaign,
        c."${SUB_PAGE}" AS submission_page,

        c."${FT_MED}" AS ft_medium,
        c."${FT_SRC}" AS ft_source,
        c."${FT_CAM}" AS ft_campaign,
        c."${FT_SUB}" AS ft_submission_page,

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
  let rows = res.rows as any[]

  // date range logic
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
    rows = rows.filter(r => inRange(r.contact_created, from, to))
  } else {
    rows = rows.filter(r =>
      inRange(r.contact_created, ranges.contactCreated[0], ranges.contactCreated[1]) &&
      inRange(r.deal_created, ranges.dealCreated[0], ranges.dealCreated[1]) &&
      inRange(r.distributed_at, ranges.distributed[0], ranges.distributed[1]) &&
      inRange(r.proposal_sent_at, ranges.proposalSent[0], ranges.proposalSent[1]) &&
      inRange(r.proposal_signed_at, ranges.proposalSigned[0], ranges.proposalSigned[1])
    )
  }

  // Normalize UTM (skip CPC/PPC)
  function mapUTM(med?:string|null, src?:string|null) { return normalizeUTM(med, src) }

  // Build group structures (Medium → Source → Campaign)
  function groupMSC(med?:string|null, src?:string|null, cam?:string|null) {
    const { utm_medium, utm_source } = mapUTM(med, src)
    return {
      m: utm_medium || '(not set)',
      s: utm_source || '(not set)',
      c: (cam||'(not set)').toLowerCase().trim() || '(not set)'
    }
  }

  // shared counters per step
  function stepCounts(list:any[]){
    const contacts = new Set(list.map(r=>r.contact_id).filter(Boolean)).size
    const deals_created = list.filter(r=>r.deal_id && r.deal_created).length
    const distributed = list.filter(r=>r.distributed_at).length
    const calls_scheduled = list.filter(r=>r.calendly_created_at).length
    const calls_completed = list.filter(r=>r.calendly_time).length
    const proposals = list.filter(r=>r.proposal_sent_at).length
    const closed_won = list.filter(r=>r.proposal_signed_at).length
    return { contacts, deals_created, distributed, calls_scheduled, calls_completed, proposals, closed_won }
  }

  function buildTree(items:any[], picker: (r:any)=>{m:string,s:string,c:string}) {
    // medium nodes
    const byM = group(items, r => picker(r).m)
    return Object.keys(byM).sort((a,b)=>a.localeCompare(b)).map(med => {
      const listM = byM[med]
      const byS = group(listM, r => picker(r).s)
      return {
        key:'m:'+med, label: med,
        metrics: stepCounts(listM),
        children: Object.keys(byS).sort((a,b)=>a.localeCompare(b)).map(src => {
          const listS = byS[src]
          const byC = group(listS, r => picker(r).c)
          return {
            key:'s:'+med+':'+src, label: src,
            metrics: stepCounts(listS),
            children: Object.keys(byC).sort((a,b)=>a.localeCompare(b)).map(cam => ({
              key:'c:'+med+':'+src+':'+cam, label: cam,
              metrics: stepCounts(byC[cam])
            }))
          }
        })
      }
    })
  }

  const tabs = {
    utm: buildTree(rows, r => groupMSC(r.utm_medium, r.utm_source, r.utm_campaign)),
    firstTouch: buildTree(rows, r => groupMSC(r.ft_medium, r.ft_source, r.ft_campaign)),
    ftSubmission: buildTree(rows, r => groupMSC(r.ft_medium, r.ft_source, r.ft_submission_page)),
    submission: buildTree(rows, r => groupMSC(r.utm_medium, r.utm_source, r.submission_page))
  }

  // sample flat rows (masked)
  const sampleRows = rows.slice(0, 500).map(r => ({
    contact_id: r.contact_id,
    email_masked: maskEmail(r.email),
    utm_medium: r.utm_medium || '(not set)',
    utm_source: r.utm_source || '(not set)',
    utm_campaign: r.utm_campaign || '(not set)'
  }))

  return json({ tabs, sampleRows })
}

function json(body:any){ return { statusCode:200, headers:{'content-type':'application/json'}, body: JSON.stringify(body)} }
function group<T>(arr:T[], key:(r:T)=>string){
  return arr.reduce((acc:Record<string,T[]>, r)=>{ const k = key(r)||''; (acc[k] ||= []).push(r); return acc },{})
}

export { handler }

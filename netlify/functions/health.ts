// netlify/functions/health.ts
import type { Handler } from '@netlify/functions'
import { db } from './_db'

export const handler: Handler = async () => {
  try {
    const url = process.env.TURSO_DATABASE_URL
    const hasToken = !!process.env.TURSO_AUTH_TOKEN
    const client = db()

    // tiny, fast query
    const res = await client.execute({ sql: `SELECT name FROM sqlite_master WHERE type='table' LIMIT 5`, args: [] })
    const tables = res.rows?.map(r => r.name) ?? []

    return {
      statusCode: 200,
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ ok: true, url, hasToken, tables })
    }
  } catch (e: any) {
    console.error('health error', e)
    return {
      statusCode: 500,
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ ok: false, error: e?.message || String(e) })
    }
  }
}

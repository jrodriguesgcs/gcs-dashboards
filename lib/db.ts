// lib/db.ts
import { createClient } from '@libsql/client'

export function db() {
  const url = process.env.TURSO_DATABASE_URL
  const authToken = process.env.TURSO_AUTH_TOKEN
  
  if (!url || !authToken) {
    throw new Error('Missing TURSO_DATABASE_URL or TURSO_AUTH_TOKEN')
  }
  
  return createClient({ 
    url, 
    authToken,
    intMode: 'number'
  })
}
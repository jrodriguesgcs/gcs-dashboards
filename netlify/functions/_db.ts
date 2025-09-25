import { createClient } from '@libsql/client'

export function db() {
  const url = process.env.TURSO_DATABASE_URL
  const authToken = process.env.TURSO_AUTH_TOKEN
  
  if (!url || !authToken) {
    throw new Error('Missing TURSO_DATABASE_URL or TURSO_AUTH_TOKEN')
  }
  
  // Create client with explicit configuration to avoid migration issues
  return createClient({ 
    url, 
    authToken,
    // Disable automatic migrations which can cause issues in serverless environments
    intMode: 'number'
  })
}
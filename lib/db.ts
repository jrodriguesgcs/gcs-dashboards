// lib/db.ts
import Database from 'better-sqlite3'
import path from 'path'

let db: Database.Database | null = null

export function getDb() {
  if (!db) {
    // Path to your activecampaign.db file
    const dbPath = path.join(process.cwd(), 'activecampaign.db')
    
    try {
      db = new Database(dbPath, { 
        readonly: true, // Read-only for safety
        fileMustExist: true 
      })
      
      // Enable WAL mode for better performance
      db.pragma('journal_mode = WAL')
      db.pragma('synchronous = NORMAL')
      
    } catch (error) {
      console.error('Failed to connect to database:', error)
      throw new Error(`Could not connect to database at ${dbPath}`)
    }
  }
  
  return db
}

export function closeDb() {
  if (db) {
    db.close()
    db = null
  }
}

// Helper function to execute queries safely
export function query(sql: string, params: any[] = []) {
  const database = getDb()
  
  try {
    if (sql.trim().toUpperCase().startsWith('SELECT')) {
      // For SELECT queries, use all()
      const stmt = database.prepare(sql)
      return stmt.all(...params)
    } else {
      // For other queries, use run()
      const stmt = database.prepare(sql)
      return stmt.run(...params)
    }
  } catch (error) {
    console.error('Query failed:', error)
    console.error('SQL:', sql)
    console.error('Params:', params)
    throw error
  }
}
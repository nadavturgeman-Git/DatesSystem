import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import * as schema from './schema'

// Get connection string - if not set, use empty string (will fail on actual use)
const connectionString = process.env.DATABASE_URL || ''

// Disable prefetch as it is not supported for "Transaction" pool mode
// Add SSL configuration for Supabase
export const client = connectionString ? postgres(connectionString, {
  prepare: false,
  ssl: 'require',
  max: 1, // Limit connections for pooler
  idle_timeout: 20,
  connect_timeout: 10
}) : postgres(connectionString, { prepare: false })

export const db = drizzle(client, { schema })

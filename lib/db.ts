import { neon } from '@neondatabase/serverless'

let cachedSql: ReturnType<typeof neon> | undefined

export function getSql() {
  if (cachedSql) return cachedSql

  const databaseUrl = process.env.DATABASE_URL
  if (!databaseUrl) {
    throw new Error('DATABASE_URL is not configured')
  }

  cachedSql = neon(databaseUrl)
  return cachedSql
}

import { createHmac } from 'node:crypto'
import { getSql } from '@/lib/db'
import type { ToolRecord } from '@/lib/tools/types'

type UsageSettings = { anonymousDailyLimit?: number; anonymousPerToolDailyLimit?: number }
type CountRow = { id: string | null; tool_today: number; tool_month: number; total_today: number }
type Reservation = { allowed: true; runId: string } | { allowed: false; retryAfterSeconds: number }

export function getVisitorHash(request: Request) {
  const address = request.headers.get('x-real-ip') ?? request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown'
  const secret = process.env.DATABASE_URL
  if (!secret) throw new Error('Usage hashing secret is not configured')
  const utcDay = new Date().toISOString().slice(0, 10)
  return createHmac('sha256', secret).update(`${address}:${utcDay}`).digest('hex')
}

export async function reserveToolRun(tool: ToolRecord, visitorHash: string, userId: string | null): Promise<Reservation> {
  const sql = getSql()
  const settingsRows = (await sql`
    SELECT value FROM public.site_settings WHERE key = 'usage_limits' LIMIT 1
  `) as unknown as { value: UsageSettings }[]
  const settings = settingsRows[0]?.value ?? {}
  const dailyLimit = tool.dailyLimit ?? validLimit(settings.anonymousPerToolDailyLimit, 20)
  const anonymousDailyLimit = userId ? 2_147_483_647 : validLimit(settings.anonymousDailyLimit, 60)
  const monthlyLimit = tool.monthlyLimit

  const results = await sql.transaction((transactionSql) => [
    transactionSql`SELECT pg_advisory_xact_lock(hashtextextended(${visitorHash} || ':daily', 0))`,
    transactionSql`SELECT pg_advisory_xact_lock(hashtextextended(${visitorHash} || ':' || ${tool.id}::text, 0))`,
    transactionSql`
      WITH usage AS MATERIALIZED (
        SELECT
          count(*) FILTER (WHERE tool_id = ${tool.id}::uuid AND created_at >= date_trunc('day', now()))::int AS tool_today,
          count(*) FILTER (WHERE tool_id = ${tool.id}::uuid AND created_at >= date_trunc('month', now()))::int AS tool_month,
          count(*) FILTER (WHERE created_at >= date_trunc('day', now()))::int AS total_today
        FROM public.tool_runs
        WHERE (
          (${userId}::uuid IS NOT NULL AND user_id = ${userId}::uuid)
          OR (${userId}::uuid IS NULL AND visitor_hash = ${visitorHash})
        )
      ),
      reserved AS (
        INSERT INTO public.tool_runs (tool_id, user_id, visitor_hash, status, duration_ms)
        SELECT ${tool.id}::uuid, ${userId}::uuid, ${visitorHash}, 'error', 0
        FROM usage
        WHERE usage.tool_today < ${dailyLimit}
          AND usage.total_today < ${anonymousDailyLimit}
          AND (${monthlyLimit}::int IS NULL OR usage.tool_month < ${monthlyLimit}::int)
        RETURNING id
      )
      SELECT reserved.id, usage.tool_today, usage.tool_month, usage.total_today
      FROM usage LEFT JOIN reserved ON true
    `,
  ], { isolationLevel: 'ReadCommitted' })

  const rows = results[2] as unknown as CountRow[]
  const row = rows[0]
  if (!row?.id) {
    const retryAfterSeconds = monthlyLimit !== null && row && row.tool_month >= monthlyLimit
      ? secondsUntilNextMonth()
      : secondsUntilTomorrow()
    return { allowed: false, retryAfterSeconds }
  }

  return { allowed: true, runId: row.id }
}

export async function finishToolRun(runId: string, status: 'success' | 'error', durationMs: number) {
  const sql = getSql()
  await sql`
    UPDATE public.tool_runs
    SET status = ${status}, duration_ms = ${Math.max(0, Math.round(durationMs))}
    WHERE id = ${runId}::uuid
  `
}

function validLimit(value: number | undefined, fallback: number) {
  return typeof value === 'number' && Number.isInteger(value) && value >= 0 ? value : fallback
}

function secondsUntilTomorrow() {
  const tomorrow = new Date()
  tomorrow.setUTCHours(24, 0, 0, 0)
  return Math.max(1, Math.ceil((tomorrow.getTime() - Date.now()) / 1000))
}

function secondsUntilNextMonth() {
  const nextMonth = new Date()
  nextMonth.setUTCMonth(nextMonth.getUTCMonth() + 1, 1)
  nextMonth.setUTCHours(0, 0, 0, 0)
  return Math.max(1, Math.ceil((nextMonth.getTime() - Date.now()) / 1000))
}

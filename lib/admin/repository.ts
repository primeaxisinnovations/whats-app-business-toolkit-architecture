import 'server-only'

import { getSql } from '@/lib/db'
import { requireAdminPermission } from '@/lib/admin/access'

export type AdminPage = {
  id: string
  slug: string
  title: string
  excerpt: string
  content: string
  status: 'draft' | 'published' | 'archived'
  seoTitle: string | null
  seoDescription: string | null
  canonicalUrl: string | null
  publishedAt: string | null
  updatedAt: string
}

export type AdminPageStatus = 'all' | 'draft' | 'published' | 'archived'

type PageRow = {
  id: string
  slug: string
  title: string
  excerpt: string
  content: string
  status: AdminPage['status']
  seo_title: string | null
  seo_description: string | null
  canonical_url: string | null
  published_at: string | Date | null
  updated_at: string | Date
}

function iso(value: string | Date | null) {
  if (!value) return null
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString()
}

function mapPage(row: PageRow): AdminPage {
  return {
    id: row.id,
    slug: row.slug,
    title: row.title,
    excerpt: row.excerpt,
    content: row.content,
    status: row.status,
    seoTitle: row.seo_title,
    seoDescription: row.seo_description,
    canonicalUrl: row.canonical_url,
    publishedAt: iso(row.published_at),
    updatedAt: iso(row.updated_at) ?? new Date().toISOString(),
  }
}

export async function listAdminPages(status: AdminPageStatus = 'all') {
  await requireAdminPermission('pages.view')
  const sql = getSql()
  const rows = await sql`
    SELECT id::text, slug, title, excerpt, content, status, seo_title,
      seo_description, canonical_url, published_at, updated_at
    FROM public.pages
    WHERE ${status} = 'all' OR status = ${status}
    ORDER BY updated_at DESC, title ASC
    LIMIT 250
  ` as unknown as PageRow[]

  return rows.map(mapPage)
}

export async function getAdminPage(id: string) {
  await requireAdminPermission('pages.view')
  const sql = getSql()
  const rows = await sql`
    SELECT id::text, slug, title, excerpt, content, status, seo_title,
      seo_description, canonical_url, published_at, updated_at
    FROM public.pages
    WHERE id = ${id}::uuid
    LIMIT 1
  ` as unknown as PageRow[]

  return rows[0] ? mapPage(rows[0]) : null
}

export async function upsertAdminPage(page: {
  id?: string
  slug: string
  title: string
  excerpt: string
  content: string
  status: AdminPage['status']
  seoTitle: string | null
  seoDescription: string | null
  canonicalUrl: string | null
}) {
  const sql = getSql()

  if (page.id) {
    const rows = await sql`
      UPDATE public.pages
      SET slug = ${page.slug}, title = ${page.title}, excerpt = ${page.excerpt},
        content = ${page.content}, status = ${page.status},
        seo_title = ${page.seoTitle}, seo_description = ${page.seoDescription},
        canonical_url = ${page.canonicalUrl},
        published_at = CASE
          WHEN ${page.status} = 'published' THEN COALESCE(published_at, now())
          ELSE NULL
        END,
        updated_at = now()
      WHERE id = ${page.id}::uuid
      RETURNING id
    ` as unknown as { id: string }[]
    if (!rows[0]) throw new Error('PAGE_NOT_FOUND')
    return rows[0].id
  }

  const rows = await sql`
    INSERT INTO public.pages (
      slug, title, excerpt, content, status, seo_title, seo_description,
      canonical_url, published_at
    ) VALUES (
      ${page.slug}, ${page.title}, ${page.excerpt}, ${page.content}, ${page.status},
      ${page.seoTitle}, ${page.seoDescription}, ${page.canonicalUrl},
      CASE WHEN ${page.status} = 'published' THEN now() ELSE NULL END
    )
    RETURNING id
  ` as unknown as { id: string }[]

  return rows[0].id
}

export async function archiveAdminPage(id: string) {
  await requireAdminPermission('pages.delete')
  const sql = getSql()
  const rows = await sql`
    UPDATE public.pages
    SET status = 'archived', published_at = NULL, updated_at = now()
    WHERE id = ${id}::uuid
    RETURNING slug
  ` as unknown as { slug: string }[]
  return rows[0] ?? null
}

export type DashboardData = {
  users: { total: number; newThisWeek: number; activeThisMonth: number }
  usage: { today: number; month: number; errorsToday: number; apiTracked: false }
  dailyRuns: { day: string; runs: number; errors: number }[]
  topTools: { name: string; slug: string; runs: number }[]
  pages: { total: number; published: number; drafts: number; archived: number }
}

export async function getAdminDashboardData(): Promise<DashboardData> {
  await requireAdminPermission('analytics.view')
  const sql = getSql()
  const [userRows, usageRows, dailyRows, topToolRows, pageRows] = await Promise.all([
    sql`
      SELECT
        (SELECT count(*)::int FROM neon_auth."user") AS total,
        (SELECT count(*)::int FROM neon_auth."user" WHERE "createdAt" >= now() - interval '7 days') AS new_this_week,
        (SELECT count(DISTINCT user_id)::int FROM public.tool_runs WHERE user_id IS NOT NULL AND created_at >= now() - interval '30 days') AS active_this_month
    ` as unknown as Promise<{ total: number; new_this_week: number; active_this_month: number }[]>,
    sql`
      SELECT
        count(*) FILTER (WHERE created_at >= date_trunc('day', now()))::int AS today,
        count(*) FILTER (WHERE created_at >= date_trunc('month', now()))::int AS month,
        count(*) FILTER (WHERE status = 'error' AND created_at >= date_trunc('day', now()))::int AS errors_today
      FROM public.tool_runs
    ` as unknown as Promise<{ today: number; month: number; errors_today: number }[]>,
    sql`
      SELECT to_char(days.day, 'Dy') AS day,
        count(runs.id)::int AS runs,
        count(runs.id) FILTER (WHERE runs.status = 'error')::int AS errors
      FROM generate_series(
        date_trunc('day', now()) - interval '6 days',
        date_trunc('day', now()),
        interval '1 day'
      ) AS days(day)
      LEFT JOIN public.tool_runs runs
        ON runs.created_at >= days.day AND runs.created_at < days.day + interval '1 day'
      GROUP BY days.day
      ORDER BY days.day
    ` as unknown as Promise<{ day: string; runs: number; errors: number }[]>,
    sql`
      SELECT t.name, t.slug, count(r.id)::int AS runs
      FROM public.tools t
      JOIN public.tool_runs r ON r.tool_id = t.id
      WHERE r.created_at >= now() - interval '30 days'
      GROUP BY t.id, t.name, t.slug
      ORDER BY runs DESC, t.name ASC
      LIMIT 5
    ` as unknown as Promise<{ name: string; slug: string; runs: number }[]>,
    sql`
      SELECT count(*)::int AS total,
        count(*) FILTER (WHERE status = 'published')::int AS published,
        count(*) FILTER (WHERE status = 'draft')::int AS drafts,
        count(*) FILTER (WHERE status = 'archived')::int AS archived
      FROM public.pages
    ` as unknown as Promise<{ total: number; published: number; drafts: number; archived: number }[]>,
  ])

  return {
    users: {
      total: userRows[0]?.total ?? 0,
      newThisWeek: userRows[0]?.new_this_week ?? 0,
      activeThisMonth: userRows[0]?.active_this_month ?? 0,
    },
    usage: {
      today: usageRows[0]?.today ?? 0,
      month: usageRows[0]?.month ?? 0,
      errorsToday: usageRows[0]?.errors_today ?? 0,
      apiTracked: false,
    },
    dailyRuns: dailyRows,
    topTools: topToolRows,
    pages: pageRows[0] ?? { total: 0, published: 0, drafts: 0, archived: 0 },
  }
}

import { getSql } from '@/lib/db'

export type PublishedPage = {
  slug: string
  title: string
  excerpt: string
  content: string
  seoTitle: string | null
  seoDescription: string | null
  canonicalUrl: string | null
  publishedAt: string | null
  updatedAt: string
}

export type PublishedPageSummary = Pick<PublishedPage, 'slug' | 'title' | 'excerpt' | 'seoTitle' | 'seoDescription' | 'publishedAt' | 'updatedAt'>

type PageRow = {
  slug: string
  title: string
  excerpt: string
  content: string
  seo_title: string | null
  seo_description: string | null
  canonical_url: string | null
  published_at: string | Date | null
  updated_at: string | Date
}

function toIsoString(value: string | Date | null) {
  if (!value) return null
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString()
}

function mapPage(row: PageRow): PublishedPage {
  return {
    slug: row.slug,
    title: row.title,
    excerpt: row.excerpt,
    content: row.content,
    seoTitle: row.seo_title,
    seoDescription: row.seo_description,
    canonicalUrl: row.canonical_url,
    publishedAt: toIsoString(row.published_at),
    updatedAt: toIsoString(row.updated_at) ?? new Date().toISOString(),
  }
}

export async function getPublishedPage(slug: string): Promise<PublishedPage | null> {
  const sql = getSql()
  const rows = await sql`
    SELECT slug, title, excerpt, content, seo_title, seo_description,
      canonical_url, published_at, updated_at
    FROM public.pages
    WHERE slug = ${slug}
      AND status = 'published'
      AND (published_at IS NULL OR published_at <= now())
    LIMIT 1
  ` as unknown as PageRow[]

  return rows[0] ? mapPage(rows[0]) : null
}

export async function listPublishedPageSummaries({ limit, offset }: { limit: number; offset: number }): Promise<{ pages: PublishedPageSummary[]; total: number }> {
  const sql = getSql()
  const [rows, countRows] = await Promise.all([
    sql`
      SELECT slug, title, excerpt, seo_title, seo_description, published_at, updated_at
      FROM public.pages
      WHERE status = 'published'
        AND (published_at IS NULL OR published_at <= now())
      ORDER BY published_at DESC NULLS LAST, updated_at DESC
      LIMIT ${limit} OFFSET ${offset}
    ` as unknown as Promise<PageRow[]>,
    sql`
      SELECT count(*)::int AS total
      FROM public.pages
      WHERE status = 'published'
        AND (published_at IS NULL OR published_at <= now())
    ` as unknown as Promise<{ total: number }[]>,
  ])

  return {
    pages: rows.map((row) => {
      const page = mapPage({ ...row, content: '', canonical_url: null })
      return {
        slug: page.slug,
        title: page.title,
        excerpt: page.excerpt,
        seoTitle: page.seoTitle,
        seoDescription: page.seoDescription,
        publishedAt: page.publishedAt,
        updatedAt: page.updatedAt,
      }
    }),
    total: countRows[0]?.total ?? 0,
  }
}

import { getSql } from '@/lib/db'
import type { PublicTool, ToolCategory, ToolRecord } from '@/lib/tools/types'

type ToolRow = {
  id: string
  slug: string
  name: string
  description: string
  short_description: string
  icon: string
  type: 'utility' | 'ai'
  is_featured: boolean
  is_free: boolean
  requires_authentication: boolean
  instructions: string
  seo_title: string | null
  seo_description: string | null
  daily_limit: number | null
  monthly_limit: number | null
  configuration: Record<string, unknown> | null
  category_slug: string | null
  category_name: string | null
  category_description: string | null
}

type CategoryRow = { category_slug: string; category_name: string; category_description: string }

function mapCategory(row: ToolRow): ToolCategory | null {
  if (!row.category_slug || !row.category_name) return null
  return {
    slug: row.category_slug,
    name: row.category_name,
    description: row.category_description ?? '',
  }
}

function mapPublicTool(row: ToolRow): PublicTool {
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    description: row.description,
    shortDescription: row.short_description,
    icon: row.icon,
    type: row.type,
    isFeatured: row.is_featured,
    isFree: row.is_free,
    requiresAuthentication: row.requires_authentication,
    instructions: row.instructions,
    seoTitle: row.seo_title,
    seoDescription: row.seo_description,
    category: mapCategory(row),
  }
}

function mapToolRecord(row: ToolRow): ToolRecord {
  return {
    ...mapPublicTool(row),
    dailyLimit: row.daily_limit,
    monthlyLimit: row.monthly_limit,
    configuration: row.configuration ?? {},
  }
}

export async function listPublicTools(): Promise<PublicTool[]> {
  const sql = getSql()
  const rows = (await sql`
    SELECT
      t.id, t.slug, t.name, t.description, t.short_description, t.icon, t.type,
      t.is_featured, t.is_free, t.requires_authentication, t.instructions,
      t.seo_title, t.seo_description, t.daily_limit, t.monthly_limit, t.configuration,
      c.slug AS category_slug, c.name AS category_name, c.description AS category_description
    FROM public.tools AS t
    LEFT JOIN public.tool_categories AS c ON c.id = t.category_id
    WHERE t.status = 'active' AND t.visibility = 'public'
    ORDER BY t.sort_order ASC, t.name ASC
  `) as unknown as ToolRow[]
  return rows.map(mapPublicTool)
}

export async function listPublicCategories(): Promise<ToolCategory[]> {
  const sql = getSql()
  const rows = (await sql`
    SELECT DISTINCT c.slug AS category_slug, c.name AS category_name, c.description AS category_description
    FROM public.tool_categories AS c
    INNER JOIN public.tools AS t ON t.category_id = c.id
    WHERE t.status = 'active' AND t.visibility = 'public'
    ORDER BY c.name ASC
  `) as unknown as CategoryRow[]

  return rows.map((row) => ({ slug: row.category_slug, name: row.category_name, description: row.category_description }))
}

export async function getPublicTool(slug: string): Promise<PublicTool | null> {
  const sql = getSql()
  const rows = (await sql`
    SELECT
      t.id, t.slug, t.name, t.description, t.short_description, t.icon, t.type,
      t.is_featured, t.is_free, t.requires_authentication, t.instructions,
      t.seo_title, t.seo_description, t.daily_limit, t.monthly_limit, t.configuration,
      c.slug AS category_slug, c.name AS category_name, c.description AS category_description
    FROM public.tools AS t
    LEFT JOIN public.tool_categories AS c ON c.id = t.category_id
    WHERE t.status = 'active' AND t.visibility = 'public' AND t.slug = ${slug}
    LIMIT 1
  `) as unknown as ToolRow[]
  return rows[0] ? mapPublicTool(rows[0]) : null
}

export async function getToolRecord(slug: string): Promise<ToolRecord | null> {
  const sql = getSql()
  const rows = (await sql`
    SELECT
      t.id, t.slug, t.name, t.description, t.short_description, t.icon, t.type,
      t.is_featured, t.is_free, t.requires_authentication, t.instructions,
      t.seo_title, t.seo_description, t.daily_limit, t.monthly_limit, t.configuration,
      c.slug AS category_slug, c.name AS category_name, c.description AS category_description
    FROM public.tools AS t
    LEFT JOIN public.tool_categories AS c ON c.id = t.category_id
    WHERE t.status = 'active' AND t.visibility = 'public' AND t.slug = ${slug}
    LIMIT 1
  `) as unknown as ToolRow[]
  return rows[0] ? mapToolRecord(rows[0]) : null
}

'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { z } from 'zod'
import { requireAdminPermission } from '@/lib/admin/access'
import { archiveAdminPage, upsertAdminPage } from '@/lib/admin/repository'

export type PageActionState = { error?: string; success?: boolean }

const pageSchema = z.object({
  id: z.string().uuid().optional().or(z.literal('')),
  title: z.string().trim().min(2, 'Add a title.').max(160, 'Keep the title under 160 characters.'),
  slug: z.string().trim().min(1, 'Add a page slug.').max(100).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Use lowercase letters, numbers, and hyphens for the slug.'),
  excerpt: z.string().trim().max(800, 'Keep the excerpt under 800 characters.'),
  content: z.string().trim().min(1, 'Add page content.').max(50000, 'Keep page content under 50,000 characters.'),
  status: z.enum(['draft', 'published', 'archived']),
  seoTitle: z.string().trim().max(160).transform((value) => value || null),
  seoDescription: z.string().trim().max(320).transform((value) => value || null),
  canonicalUrl: z.string().trim().max(2048).refine((value) => {
    if (!value) return true
    try {
      const url = new URL(value)
      return url.protocol === 'https:' || url.protocol === 'http:'
    } catch {
      return false
    }
  }, 'Enter a valid HTTP or HTTPS canonical URL.').transform((value) => value || null),
})

function formString(formData: FormData, key: string) {
  const value = formData.get(key)
  return typeof value === 'string' ? value : ''
}

export async function saveAdminPageAction(_previous: PageActionState, formData: FormData): Promise<PageActionState> {
  const parsed = pageSchema.safeParse({
    id: formString(formData, 'id') || undefined,
    title: formString(formData, 'title'),
    slug: formString(formData, 'slug'),
    excerpt: formString(formData, 'excerpt'),
    content: formString(formData, 'content'),
    status: formString(formData, 'status'),
    seoTitle: formString(formData, 'seoTitle'),
    seoDescription: formString(formData, 'seoDescription'),
    canonicalUrl: formString(formData, 'canonicalUrl'),
  })

  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? 'Review the page details and try again.' }

  try {
    const permission = parsed.data.id ? 'pages.update' : 'pages.create'
    await requireAdminPermission(permission)
    if (parsed.data.status === 'published') await requireAdminPermission('pages.publish')
    if (parsed.data.status === 'archived') await requireAdminPermission('pages.delete')
  } catch {
    return { error: 'Your account does not have permission to make this change.' }
  }

  try {
    const id = parsed.data.id || undefined
    await upsertAdminPage({ ...parsed.data, id })
    revalidatePath('/admin')
    revalidatePath('/admin/pages')
    revalidatePath('/pages')
    revalidatePath('/pages/[slug]', 'page')
    return { success: true, error: undefined }
  } catch (error) {
    const code = typeof error === 'object' && error !== null && 'code' in error ? error.code : null
    if (code === '23505') return { error: 'That slug is already in use. Choose another one.' }
    if (error instanceof Error && error.message === 'PAGE_NOT_FOUND') return { error: 'This page was removed. Refresh the list and try again.' }
    return { error: 'We couldn’t save this page. Please try again.' }
  }
}

export async function archiveAdminPageAction(formData: FormData): Promise<void> {
  const id = formString(formData, 'id')
  if (!z.string().uuid().safeParse(id).success) redirect('/admin/pages?error=invalid')

  let page: Awaited<ReturnType<typeof archiveAdminPage>>
  try {
    page = await archiveAdminPage(id)
  } catch {
    redirect('/admin/pages?error=archive')
  }

  if (!page) redirect('/admin/pages?error=not-found')
  revalidatePath('/admin')
  revalidatePath('/admin/pages')
  revalidatePath('/pages')
  revalidatePath('/pages/[slug]', 'page')
  redirect('/admin/pages?archived=1')
}

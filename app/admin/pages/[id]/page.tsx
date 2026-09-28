import Link from 'next/link'
import { notFound } from 'next/navigation'
import { z } from 'zod'
import { ChevronLeft } from 'lucide-react'
import { requireAdminPermission } from '@/lib/admin/access'
import { getAdminPage } from '@/lib/admin/repository'
import { PageEditor } from '@/components/admin/page-editor'

export default async function EditAdminPage({ params }: { params: Promise<{ id: string }> }) {
  await requireAdminPermission('pages.update')
  const { id } = await params
  if (!z.string().uuid().safeParse(id).success) notFound()
  const page = await getAdminPage(id)
  if (!page) notFound()

  return (
    <div className="admin-page-stack admin-editor-page">
      <Link className="admin-breadcrumb-link" href="/admin/pages"><ChevronLeft aria-hidden="true" size={15} /> All pages</Link>
      <header className="admin-page-heading">
        <div><p className="admin-overline">WEBSITE CONTENT · EDIT PAGE</p><h1>{page.title}</h1><p>Last updated {new Date(page.updatedAt).toLocaleDateString('en', { month: 'long', day: 'numeric', year: 'numeric' })}.</p></div>
      </header>
      <PageEditor page={page} />
    </div>
  )
}

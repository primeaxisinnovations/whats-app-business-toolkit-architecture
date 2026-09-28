import Link from 'next/link'
import { ChevronLeft } from 'lucide-react'
import { requireAdminPermission } from '@/lib/admin/access'
import { PageEditor } from '@/components/admin/page-editor'

export default async function NewAdminPage() {
  await requireAdminPermission('pages.create')

  return (
    <div className="admin-page-stack admin-editor-page">
      <Link className="admin-breadcrumb-link" href="/admin/pages"><ChevronLeft aria-hidden="true" size={15} /> All pages</Link>
      <header className="admin-page-heading">
        <div><p className="admin-overline">WEBSITE CONTENT · NEW PAGE</p><h1>Create a page</h1><p>Start with a clear title, then fill in the details before publishing.</p></div>
      </header>
      <PageEditor />
    </div>
  )
}

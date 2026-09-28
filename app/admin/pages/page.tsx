import Link from 'next/link'
import { ArrowUpRight, FilePlus2, Search } from 'lucide-react'
import { listAdminPages, type AdminPageStatus } from '@/lib/admin/repository'

const filters: { label: string; value: AdminPageStatus }[] = [
  { label: 'All pages', value: 'all' },
  { label: 'Published', value: 'published' },
  { label: 'Drafts', value: 'draft' },
  { label: 'Archived', value: 'archived' },
]

type AdminPagesProps = { searchParams: Promise<{ status?: string; archived?: string; error?: string }> }

export default async function AdminPagesPage({ searchParams }: AdminPagesProps) {
  const params = await searchParams
  const status = filters.some((filter) => filter.value === params.status) ? params.status as AdminPageStatus : 'all'
  const pages = await listAdminPages(status)

  return (
    <div className="admin-page-stack">
      <header className="admin-page-heading">
        <div>
          <p className="admin-overline">WEBSITE CONTENT</p>
          <h1>Pages</h1>
          <p>Write, review, and publish the pages that shape your site.</p>
        </div>
        <Link className="admin-primary-button admin-button-link" href="/admin/pages/new"><FilePlus2 aria-hidden="true" size={16} /> New page</Link>
      </header>

      {params.archived === '1' ? <div className="admin-success-notice" role="status">Page archived. It is no longer visible on the public site.</div> : null}
      {params.error ? <div className="admin-notice" role="status">{params.error === 'archive' ? 'The page could not be archived. Please try again.' : params.error === 'not-found' ? 'That page no longer exists.' : 'The page request could not be completed.'}</div> : null}
      <section className="admin-panel admin-pages-panel" aria-labelledby="pages-table-heading">
        <div className="admin-list-toolbar">
          <div className="admin-filter-tabs" aria-label="Filter pages by status">
            {filters.map((filter) => (
              <Link key={filter.value} href={filter.value === 'all' ? '/admin/pages' : `/admin/pages?status=${filter.value}`} className={status === filter.value ? 'is-active' : ''} aria-current={status === filter.value ? 'page' : undefined}>{filter.label}</Link>
            ))}
          </div>
          <span className="admin-result-count"><Search aria-hidden="true" size={14} /> {pages.length} {pages.length === 1 ? 'page' : 'pages'}</span>
        </div>
        <h2 className="sr-only" id="pages-table-heading">Pages list</h2>
        {pages.length ? (
          <div className="admin-table-scroll">
            <table className="admin-table">
              <thead><tr><th scope="col">Page</th><th scope="col">Status</th><th scope="col">Updated</th><th scope="col"><span className="sr-only">Actions</span></th></tr></thead>
              <tbody>
                {pages.map((page) => (
                  <tr key={page.id}>
                    <td><Link className="admin-page-title-link" href={`/admin/pages/${page.id}`}>{page.title || 'Untitled page'}</Link><span className="admin-page-slug">/pages/{page.slug}</span></td>
                    <td><span className={`admin-status-pill admin-status-${page.status}`}>{page.status}</span></td>
                    <td><time dateTime={page.updatedAt}>{new Date(page.updatedAt).toLocaleDateString('en', { month: 'short', day: 'numeric', year: 'numeric' })}</time></td>
                    <td><Link className="admin-row-action" href={`/admin/pages/${page.id}`} aria-label={`Edit ${page.title}`}><ArrowUpRight aria-hidden="true" size={16} /></Link></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="admin-empty-state">
            <span className="admin-empty-icon"><FilePlus2 aria-hidden="true" size={20} /></span>
            <h2>{status === 'all' ? 'Your first page starts here.' : `No ${status} pages yet.`}</h2>
            <p>Create an editorial page, keep it in draft, and publish it when it&apos;s ready.</p>
            {status === 'all' ? <Link href="/admin/pages/new" className="admin-text-link">Create a page <span aria-hidden="true">→</span></Link> : null}
          </div>
        )}
      </section>
    </div>
  )
}

import type { Metadata } from 'next'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { Activity, BookOpenText, Boxes, ChartNoAxesColumn, CircleUserRound, LockKeyhole, Settings2, Shield, Sparkles } from 'lucide-react'
import { getAdminShellAccess } from '@/lib/admin/access'
import { signOutAdminAction } from '@/app/admin/sign-out-action'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: { default: 'Control room', template: '%s | wa toolkit admin' },
  robots: { index: false, follow: false },
}

const primaryLinks = [
  { href: '/admin', label: 'Overview', icon: ChartNoAxesColumn },
  { href: '/admin/pages', label: 'Pages', icon: BookOpenText },
] as const

const comingSoon = [
  { label: 'Tools & categories', icon: Boxes },
  { label: 'Users & roles', icon: CircleUserRound },
  { label: 'Usage & analytics', icon: Activity },
  { label: 'Settings', icon: Settings2 },
] as const

type AdminLayoutProps = Readonly<{ children: React.ReactNode }>

export default async function AdminLayout({ children }: AdminLayoutProps) {
  const access = await getAdminShellAccess()
  const { user, canEnter } = access

  if (!user) redirect('/admin/login')

  if (!canEnter) {
    return (
      <main className="admin-access-denied">
        <div className="admin-access-card">
          <div className="admin-auth-icon"><LockKeyhole aria-hidden="true" size={22} /></div>
          <p className="admin-overline">CONTROL ROOM · RESTRICTED</p>
          <h1>Admin access is not assigned.</h1>
          <p>Your account is signed in, but it doesn&apos;t have an administrator role. Ask an administrator to grant access or add this verified email to the <code>ADMIN_EMAILS</code> project variable.</p>
          <form action={signOutAdminAction}><button className="admin-secondary-button" type="submit">Sign out</button></form>
        </div>
      </main>
    )
  }

  return (
    <div className="admin-frame">
      <aside className="admin-sidebar">
        <Link className="admin-brand" href="/admin" aria-label="wa toolkit admin overview">
          <span className="admin-brand-mark"><Sparkles aria-hidden="true" size={18} /></span>
          <span>wa toolkit <small>CONTROL ROOM</small></span>
        </Link>
        <div className="admin-nav-label">WORKSPACE</div>
        <nav className="admin-nav" aria-label="Admin navigation">
          {primaryLinks.map(({ href, label, icon: Icon }) => (
            <Link className="admin-nav-link" href={href} key={href}>
              <Icon aria-hidden="true" size={17} strokeWidth={1.8} />
              <span>{label}</span>
            </Link>
          ))}
        </nav>
        <div className="admin-nav-label admin-nav-label-spaced">MANAGE</div>
        <nav className="admin-nav" aria-label="Upcoming admin sections">
          {comingSoon.map(({ label, icon: Icon }) => (
            <span className="admin-nav-link admin-nav-disabled" key={label} aria-disabled="true" title="This section is not available yet">
              <Icon aria-hidden="true" size={17} strokeWidth={1.8} />
              <span>{label}</span>
              <small>SOON</small>
            </span>
          ))}
        </nav>
        <div className="admin-sidebar-bottom">
          <div className="admin-user-chip">
            <span className="admin-avatar" aria-hidden="true">{user.name?.trim().charAt(0).toUpperCase() || user.email?.charAt(0).toUpperCase() || 'A'}</span>
            <span className="admin-user-details"><strong>{user.name || 'Admin'}</strong><small>{user.email}</small></span>
          </div>
          <form action={signOutAdminAction}><button className="admin-signout-button" type="submit">Sign out</button></form>
          <Link className="admin-back-link" href="/">← Back to website</Link>
        </div>
      </aside>
      <div className="admin-main-column">
        <header className="admin-topbar">
          <div><Shield aria-hidden="true" size={15} /><span>Administrator workspace</span></div>
          <span className="admin-topbar-user">{user.email}</span>
        </header>
        <main className="admin-content">{children}</main>
      </div>
    </div>
  )
}

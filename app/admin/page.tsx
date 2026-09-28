import Link from 'next/link'
import { Activity, AlertTriangle, ArrowUpRight, BookOpenText, CircleHelp, FileText, Users, Zap } from 'lucide-react'
import { getAdminDashboardData } from '@/lib/admin/repository'
import { getAdminAccess, isAdminPermissionGranted } from '@/lib/admin/access'
import { UsageChart } from '@/components/admin/usage-chart'

function formatNumber(value: number) {
  return new Intl.NumberFormat('en').format(value)
}

export default async function AdminDashboardPage({ searchParams }: { searchParams: Promise<{ access?: string; permission?: string }> }) {
  const params = await searchParams
  const access = await getAdminAccess()
  const canViewAnalytics = await isAdminPermissionGranted('analytics.view')
  const data = canViewAnalytics ? await getAdminDashboardData() : null
  const canViewPages = await isAdminPermissionGranted('pages.view')

  return (
    <div className="admin-page-stack">
      <header className="admin-page-heading admin-dashboard-heading">
        <div>
          <p className="admin-overline">{new Date().toLocaleDateString('en', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' }).toUpperCase()}</p>
          <h1>Good to see you{access.user?.name ? `, ${access.user.name.split(' ')[0]}` : ''}.</h1>
          <p>Here&apos;s what&apos;s happening across your toolkit today.</p>
        </div>
        {canViewPages ? <Link href="/admin/pages" className="admin-secondary-button admin-button-link"><BookOpenText aria-hidden="true" size={16} /> Manage pages</Link> : null}
      </header>

      {params.access === 'denied' ? <div className="admin-notice" role="status">This account does not have an administrator role. Use an assigned staff account or contact your workspace owner.</div> : null}
      {params.permission === 'denied' ? <div className="admin-notice" role="status">Your account does not have permission to view that section.</div> : null}

      {!canViewAnalytics ? (
        <section className="admin-panel admin-permission-panel">
          <span className="admin-empty-icon"><CircleHelp aria-hidden="true" size={20} /></span>
          <div><h2>Analytics access is limited.</h2><p>Your account can access the workspace, but it hasn&apos;t been granted the <code>analytics.view</code> permission.</p></div>
        </section>
      ) : data ? (
        <>
          <section className="admin-metric-grid" aria-label="Key metrics">
            <article className="admin-metric-card">
              <div className="admin-metric-top"><span>Total users</span><span className="admin-metric-icon"><Users aria-hidden="true" size={17} /></span></div>
              <strong>{formatNumber(data.users.total)}</strong>
              <p><span className="admin-metric-positive">+{formatNumber(data.users.newThisWeek)}</span> this week</p>
            </article>
            <article className="admin-metric-card">
              <div className="admin-metric-top"><span>Active users</span><span className="admin-metric-icon"><Activity aria-hidden="true" size={17} /></span></div>
              <strong>{formatNumber(data.users.activeThisMonth)}</strong>
              <p>With a tool run in the last 30 days</p>
            </article>
            <article className="admin-metric-card">
              <div className="admin-metric-top"><span>Tool runs today</span><span className="admin-metric-icon"><Zap aria-hidden="true" size={17} /></span></div>
              <strong>{formatNumber(data.usage.today)}</strong>
              <p>{formatNumber(data.usage.month)} runs this month</p>
            </article>
            <article className="admin-metric-card">
              <div className="admin-metric-top"><span>Errors today</span><span className="admin-metric-icon admin-metric-icon-warning"><AlertTriangle aria-hidden="true" size={17} /></span></div>
              <strong>{formatNumber(data.usage.errorsToday)}</strong>
              <p>Tool runs marked as errors</p>
            </article>
          </section>

          <section className="admin-dashboard-grid">
            <article className="admin-panel admin-activity-panel">
              <div className="admin-panel-heading admin-chart-heading">
                <div><span className="admin-overline">LAST 7 DAYS</span><h2>Tool activity</h2></div>
                <div className="admin-chart-legend"><span><i className="legend-runs" /> Runs</span><span><i className="legend-errors" /> Errors</span></div>
              </div>
              <UsageChart data={data.dailyRuns} />
              <p className="admin-chart-caption">Daily executions recorded by the toolkit.</p>
            </article>

            <article className="admin-panel admin-top-tools-panel">
              <div className="admin-panel-heading">
                <div><span className="admin-overline">PAST 30 DAYS</span><h2>Most-used tools</h2></div>
                <Link className="admin-icon-link" href="/tools" aria-label="View public tools"><ArrowUpRight aria-hidden="true" size={17} /></Link>
              </div>
              {data.topTools.length ? (
                <ol className="admin-top-tools-list">
                  {data.topTools.map((tool, index) => {
                    const largest = data.topTools[0]?.runs || 1
                    const width = Math.max(8, (tool.runs / largest) * 100)
                    return (
                      <li key={tool.slug}>
                        <div className="admin-tool-row"><span className="admin-tool-rank">0{index + 1}</span><span className="admin-tool-name">{tool.name}</span><strong>{formatNumber(tool.runs)}</strong></div>
                        <div className="admin-tool-track"><span style={{ width: `${width}%` }} /></div>
                      </li>
                    )
                  })}
                </ol>
              ) : <p className="admin-panel-empty">Tool activity will appear here once visitors start using the toolkit.</p>}
              <p className="admin-panel-footnote">Counts include all anonymous and signed-in runs.</p>
            </article>
          </section>

          <section className="admin-dashboard-grid admin-dashboard-bottom">
            <article className="admin-panel admin-cms-panel">
              <div className="admin-panel-heading">
                <div><span className="admin-overline">CONTENT</span><h2>Website pages</h2></div>
                {canViewPages ? <Link href="/admin/pages" className="admin-icon-link" aria-label="Manage website pages"><ArrowUpRight aria-hidden="true" size={17} /></Link> : <FileText aria-hidden="true" className="admin-muted-icon" size={19} />}
              </div>
              {canViewPages ? (
                <div className="admin-page-counts">
                  <div><strong>{formatNumber(data.pages.published)}</strong><span>Published</span></div>
                  <div><strong>{formatNumber(data.pages.drafts)}</strong><span>Drafts</span></div>
                  <div><strong>{formatNumber(data.pages.archived)}</strong><span>Archived</span></div>
                </div>
              ) : <p className="admin-panel-empty">Your role does not have access to page management.</p>}
            </article>

            <article className="admin-panel admin-api-panel">
              <div className="admin-panel-heading">
                <div><span className="admin-overline">PLATFORM</span><h2>API requests</h2></div>
                <CircleHelp aria-hidden="true" className="admin-muted-icon" size={18} />
              </div>
              <div className="admin-untracked-state"><span className="admin-untracked-dot" /> Not instrumented yet</div>
              <p className="admin-panel-footnote">API traffic is served by versioned routes. Request-level tracking has not been added, so no volume is reported here.</p>
            </article>
          </section>
        </>
      ) : null}
    </div>
  )
}

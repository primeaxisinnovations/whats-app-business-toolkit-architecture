import 'server-only'

import { redirect } from 'next/navigation'
import { getAuthSession } from '@/lib/auth'
import { getSql } from '@/lib/db'

export type AdminPermission = 'analytics.view' | 'pages.view' | 'pages.create' | 'pages.update' | 'pages.publish' | 'pages.delete'

type RolePermissionRow = { role_slug: string; permission_slug: string | null }

function configuredAdminEmails() {
  return new Set(
    (process.env.ADMIN_EMAILS ?? '')
      .split(',')
      .map((email) => email.trim().toLowerCase())
      .filter(Boolean),
  )
}

export async function getAdminAccess() {
  const session = await getAuthSession()
  const user = session?.user ?? null

  if (!user) return { user: null, isAdmin: false, canEnter: false, permissions: [] as string[] }

  const email = user.email?.trim().toLowerCase()
  const emailAllowlisted = Boolean(user.emailVerified && email && configuredAdminEmails().has(email))
  const sql = getSql()
  const rows = await sql`
    SELECT r.slug AS role_slug, p.slug AS permission_slug
    FROM public.user_roles ur
    JOIN public.roles r ON r.id = ur.role_id
    LEFT JOIN public.role_permissions rp ON rp.role_id = r.id
    LEFT JOIN public.permissions p ON p.id = rp.permission_id
    WHERE ur.user_id = ${user.id}::uuid
  ` as unknown as RolePermissionRow[]

  const roleSlugs = new Set(rows.map((row) => row.role_slug))
  const permissions = [...new Set(rows.flatMap((row) => row.permission_slug ? [row.permission_slug] : []))]
  const isAdmin = emailAllowlisted || roleSlugs.has('super_admin') || roleSlugs.has('admin')
  const canEnter = isAdmin || permissions.length > 0 || roleSlugs.has('editor') || roleSlugs.has('support')

  return { user, isAdmin, canEnter, permissions }
}

export async function requireAdminPermission(permission: AdminPermission) {
  const access = await getAdminAccess()

  if (!access.user) redirect('/admin/login')
  if (!access.canEnter) redirect('/admin?access=denied')
  if (!access.isAdmin && !access.permissions.includes(permission)) redirect('/admin?permission=denied')

  return access
}

export async function getAdminShellAccess() {
  const access = await getAdminAccess()
  if (!access.user) redirect('/admin/login')
  return access
}

export async function isAdminPermissionGranted(permission: AdminPermission) {
  const access = await getAdminAccess()
  return Boolean(access.user && access.canEnter && (access.isAdmin || access.permissions.includes(permission)))
}

export async function signOutAdmin() {
  const { signOut } = await import('@/lib/auth')
  await signOut()
  redirect('/admin/login')
}

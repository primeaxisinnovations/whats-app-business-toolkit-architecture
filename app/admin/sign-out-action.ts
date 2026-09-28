'use server'

import { signOut } from '@/lib/auth'
import { redirect } from 'next/navigation'

export async function signOutAdminAction() {
  await signOut()
  redirect('/admin/login')
}

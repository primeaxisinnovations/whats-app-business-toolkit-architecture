import { createNeonAuth } from '@neondatabase/auth/next/server'

const baseUrl = process.env.NEON_AUTH_BASE_URL
const cookieSecret = process.env.NEON_AUTH_COOKIE_SECRET

if (!baseUrl) throw new Error('NEON_AUTH_BASE_URL is not configured')
if (!cookieSecret || cookieSecret.length < 32) {
  throw new Error('NEON_AUTH_COOKIE_SECRET must contain at least 32 characters')
}

export const auth = createNeonAuth({
  baseUrl,
  cookies: {
    secret: cookieSecret,
    sameSite: process.env.NODE_ENV === 'development' ? 'none' : 'lax',
  },
})

export type AuthSession = NonNullable<Awaited<ReturnType<typeof auth.getSession>>['data']>
export type AuthUser = AuthSession['user']

export async function getAuthSession() {
  const { data } = await auth.getSession()
  return data
}

export async function getAuthUser() {
  const session = await getAuthSession()
  return session?.user ?? null
}

export async function signOut() {
  return auth.signOut()
}

export async function signInWithEmail(email: string, password: string) {
  return auth.signIn.email({ email, password })
}

export async function signUpWithEmail(email: string, password: string, name: string) {
  return auth.signUp.email({ email, password, name })
}

export async function signInWithSocial(provider: string) {
  return auth.signIn.social({ provider })
}

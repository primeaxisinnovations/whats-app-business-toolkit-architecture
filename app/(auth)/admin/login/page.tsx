'use client'

import { useState, type FormEvent } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, KeyRound, ShieldCheck } from 'lucide-react'
import { authClient } from '@/lib/auth-client'

export default function AdminLoginPage() {
  const router = useRouter()
  const [mode, setMode] = useState<'sign-in' | 'sign-up'>('sign-in')
  const [email, setEmail] = useState('')
  const [name, setName] = useState('')
  const [password, setPassword] = useState('')
  const [message, setMessage] = useState('')
  const [pending, setPending] = useState(false)

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (pending) return
    setPending(true)
    setMessage('')

    try {
      const result = mode === 'sign-in'
        ? await authClient.signIn.email({ email, password })
        : await authClient.signUp.email({ email, password, name })

      if (result.error) {
        setMessage(result.error.message || 'We couldn’t complete that request. Check your details and try again.')
        return
      }

      router.replace('/admin')
      router.refresh()
    } catch {
      setMessage('We couldn’t connect to the sign-in service. Please try again.')
    } finally {
      setPending(false)
    }
  }

  return (
    <main className="admin-auth-page">
      <Link className="admin-auth-back" href="/">
        <ArrowLeft aria-hidden="true" size={16} /> Back to wa toolkit
      </Link>
      <section className="admin-auth-card" aria-labelledby="admin-auth-title">
        <div className="admin-auth-icon"><ShieldCheck aria-hidden="true" size={22} /></div>
        <p className="admin-overline">WA TOOLKIT · CONTROL ROOM</p>
        <h1 id="admin-auth-title">{mode === 'sign-in' ? 'Welcome back.' : 'Create your account.'}</h1>
        <p className="admin-auth-intro">Sign in with your wa toolkit account. Admin access is granted separately by role or verified email.</p>

        <form className="admin-auth-form" onSubmit={handleSubmit}>
          {mode === 'sign-up' ? (
            <label>
              <span>Name</span>
              <input autoComplete="name" value={name} onChange={(event) => setName(event.target.value)} required maxLength={120} />
            </label>
          ) : null}
          <label>
            <span>Email address</span>
            <input type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} required maxLength={254} />
          </label>
          <label>
            <span>Password</span>
            <input type="password" autoComplete={mode === 'sign-in' ? 'current-password' : 'new-password'} value={password} onChange={(event) => setPassword(event.target.value)} required minLength={8} maxLength={128} />
          </label>
          {message ? <p className="admin-form-message" role="alert">{message}</p> : null}
          <button className="admin-primary-button" type="submit" disabled={pending}>
            <KeyRound aria-hidden="true" size={16} />
            {pending ? 'Please wait…' : mode === 'sign-in' ? 'Sign in securely' : 'Create account'}
          </button>
        </form>

        <p className="admin-auth-switch">
          {mode === 'sign-in' ? 'New to wa toolkit?' : 'Already have an account?'}{' '}
          <button type="button" onClick={() => { setMode(mode === 'sign-in' ? 'sign-up' : 'sign-in'); setMessage('') }}>
            {mode === 'sign-in' ? 'Create account' : 'Sign in'}
          </button>
        </p>
        <p className="admin-auth-note">New accounts do not receive admin privileges automatically.</p>
      </section>
    </main>
  )
}

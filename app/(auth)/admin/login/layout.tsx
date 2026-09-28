import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Sign in to the control room',
  robots: { index: false, follow: false },
}

export default function AdminLoginLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return children
}

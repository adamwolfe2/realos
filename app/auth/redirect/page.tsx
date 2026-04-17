'use client'

/**
 * Smart auth redirect — runs after Clerk sign-in or sign-up.
 * Must be a client component so Clerk's session is available
 * immediately after the post-sign-in redirect.
 */
import { useEffect, useState } from 'react'
import { useAuth } from '@clerk/nextjs'
import { useRouter } from 'next/navigation'

export default function AuthRedirectPage() {
  const { userId, isLoaded } = useAuth()
  const router = useRouter()
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!isLoaded) return

    if (!userId) {
      router.replace('/sign-in')
      return
    }

    // Fetch role from DB and redirect accordingly
    fetch('/api/auth/role')
      .then(r => {
        if (!r.ok) {
          // 401 means Clerk session didn't propagate to server — show manual nav
          throw new Error(`Role check failed: ${r.status}`)
        }
        return r.json()
      })
      .then(({ role }) => {
        if (role === 'ADMIN' || role === 'OPS' || role === 'SALES_REP') {
          router.replace('/admin')
        } else if (role === 'SUPPLIER') {
          router.replace('/supplier/dashboard')
        } else if (role) {
          router.replace('/client-portal/dashboard')
        } else {
          // User exists in Clerk but no DB record yet — go to homepage
          // instead of client-portal which requires auth and may loop
          setError('no-role')
        }
      })
      .catch(() => {
        setError('auth-failed')
      })
  }, [isLoaded, userId, router])

  if (error) {
    return (
      <div className="min-h-screen bg-cream flex items-center justify-center">
        <div className="text-center max-w-sm">
          <p className="text-sm text-ink/60 mb-4">
            {error === 'no-role'
              ? 'Your account is not set up yet. Please contact your administrator.'
              : 'There was a problem verifying your account. Please try again.'}
          </p>
          <div className="flex gap-3 justify-center">
            <a
              href="/"
              className="px-4 py-2 text-sm font-medium border border-shell bg-white hover:bg-cream transition-colors"
            >
              Go home
            </a>
            <button
              onClick={() => {
                setError(null)
                window.location.reload()
              }}
              className="px-4 py-2 text-sm font-medium bg-ink text-cream hover:bg-ink/90 transition-colors"
            >
              Try again
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-cream flex items-center justify-center">
      <p className="text-sm text-ink/40">Redirecting…</p>
    </div>
  )
}

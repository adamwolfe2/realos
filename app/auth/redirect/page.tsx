'use client'

/**
 * Smart auth redirect — runs after Clerk sign-in or sign-up.
 *
 * Two resilience features the previous version lacked:
 *   1. Retries the /api/auth/role fetch up to 4 times with backoff. The
 *      Clerk session sometimes propagates to the server a beat behind
 *      the client, producing a transient 401. Without retry, brand-new
 *      sign-ups would dead-end on an "auth-failed" message.
 *   2. Reads the `created` flag from the response and routes fresh
 *      sign-ups to /portal/setup (the welcome wizard) instead of the
 *      empty dashboard at /portal.
 */
import { useEffect, useState } from 'react'
import { useAuth } from '@clerk/nextjs'
import { useRouter } from 'next/navigation'

type RoleResponse = {
  role: string | null
  orgType: string | null
  orgSlug?: string | null
  created?: boolean
}

async function fetchRoleWithRetry(): Promise<RoleResponse | null> {
  const delays = [0, 400, 800, 1600]
  let lastErr: unknown = null
  for (let i = 0; i < delays.length; i++) {
    if (delays[i] > 0) {
      await new Promise((r) => setTimeout(r, delays[i]))
    }
    try {
      const res = await fetch('/api/auth/role', {
        cache: 'no-store',
        credentials: 'include',
      })
      // 401 is the typical "session not yet propagated" symptom — retry.
      // 5xx is also worth retrying; the server may be in a transient
      // bad state during cold-start or migration. 4xx-other returns
      // null role which we treat as a final answer.
      if (res.status === 401 || res.status >= 500) {
        lastErr = new Error(`HTTP ${res.status}`)
        continue
      }
      const json = (await res.json()) as RoleResponse
      // If the server explicitly says "role: null" treat that as a final
      // answer (the user has no usable account) rather than retrying
      // forever.
      return json
    } catch (err) {
      lastErr = err
    }
  }
  if (lastErr) console.warn('[auth/redirect] role fetch retries exhausted:', lastErr)
  return null
}

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

    fetchRoleWithRetry()
      .then((data) => {
        if (!data) {
          setError('auth-failed')
          return
        }
        const { role, orgType, created } = data
        const agencyRoles = ['AGENCY_OWNER', 'AGENCY_ADMIN', 'AGENCY_OPERATOR']
        const clientRoles = ['CLIENT_OWNER', 'CLIENT_ADMIN', 'CLIENT_VIEWER', 'LEASING_AGENT']

        if (!role) {
          setError('no-role')
          return
        }
        if (agencyRoles.includes(role) || orgType === 'AGENCY') {
          router.replace('/admin')
        } else if (clientRoles.includes(role) || orgType === 'CLIENT') {
          // Fresh self-provisioned org → drop them into the marketplace
          // so they can pick which modules to activate (every module is
          // free during the trial). Returning users go straight to the
          // dashboard; the marketplace is always reachable from the nav.
          router.replace(created ? '/portal/marketplace' : '/portal')
        } else {
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
              className="px-4 py-2 text-sm font-medium bg-primary text-primary-foreground hover:bg-primary-dark transition-colors transition-colors"
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

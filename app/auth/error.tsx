'use client'

import { useEffect } from 'react'

export default function AuthError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    if (process.env.NODE_ENV === 'production') {
      console.error('[auth]', error.digest ?? error.message)
    }
  }, [error])

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-cream text-ink px-4">
      <h1 className="font-serif text-2xl mb-3">Authentication error</h1>
      <p className="font-mono text-sm text-ink/60 mb-8 max-w-sm text-center leading-relaxed">
        Something went wrong during authentication. Please try signing in again.
      </p>
      <div className="flex gap-3">
        <button
          onClick={reset}
          className="font-mono text-sm border border-shell px-5 py-2.5 bg-cream text-ink hover:border-ink transition-colors"
        >
          Try again
        </button>
        <a
          href="/sign-in"
          className="font-mono text-sm border border-ink bg-ink text-cream px-5 py-2.5 hover:bg-ink/80 transition-colors"
        >
          Sign in
        </a>
      </div>
    </div>
  )
}

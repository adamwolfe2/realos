'use client'

import { useEffect } from 'react'

export default function MarketingError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    if (process.env.NODE_ENV === 'production') {
      console.error('[marketing]', error.digest ?? error.message)
    }
  }, [error])

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-cream text-ink px-4">
      <p className="font-mono text-[10px] uppercase tracking-widest text-sand mb-4">
        Something went wrong
      </p>
      <h1 className="font-serif text-3xl sm:text-4xl mb-3 text-center">
        We hit an unexpected error.
      </h1>
      <p className="font-mono text-sm text-ink/60 mb-8 max-w-md text-center leading-relaxed">
        This page failed to load. Try refreshing — if the issue persists, contact us
        at{' '}
        <a
          href="mailto:orders@wholesailhub.com"
          className="underline underline-offset-2"
        >
          orders@wholesailhub.com
        </a>
        .
      </p>
      <div className="flex gap-3">
        <button
          onClick={reset}
          className="font-mono text-sm border border-shell px-5 py-2.5 bg-cream text-ink hover:border-ink transition-colors"
        >
          Try again
        </button>
        <a
          href="/"
          className="font-mono text-sm border border-ink bg-ink text-cream px-5 py-2.5 hover:bg-ink/80 transition-colors"
        >
          Back to home
        </a>
      </div>
      {error.digest && (
        <p className="mt-8 text-[10px] text-sand font-mono">
          Error ID: {error.digest}
        </p>
      )}
    </div>
  )
}

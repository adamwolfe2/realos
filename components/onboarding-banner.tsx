'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import {
  Store,
  ShoppingCart,
  RefreshCw,
  CheckCircle2,
  X,
  ArrowRight,
} from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'

const STORAGE_KEY = 'onboarding-dismissed'

interface OnboardingStep {
  icon: typeof Store
  title: string
  description: string
  href: string
  complete: boolean
}

interface OnboardingBannerProps {
  orderCount: number
}

export function OnboardingBanner({ orderCount }: OnboardingBannerProps) {
  const [dismissed, setDismissed] = useState(true)

  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY)
      setDismissed(stored === 'true')
    } catch {
      // Storage unavailable (e.g. Safari private browsing) — keep hidden
    }
  }, [])

  function handleDismiss() {
    try {
      localStorage.setItem(STORAGE_KEY, 'true')
    } catch {
      // Storage unavailable — dismiss in memory only
    }
    setDismissed(true)
  }

  if (dismissed) return null

  const steps: OnboardingStep[] = [
    {
      icon: Store,
      title: 'Browse the catalog',
      description: 'Explore our full product lineup and find what you need.',
      href: '/client-portal/catalog',
      complete: orderCount > 0,
    },
    {
      icon: ShoppingCart,
      title: 'Place your first order',
      description: 'Add items to your cart and check out in minutes.',
      href: '/client-portal/catalog',
      complete: orderCount > 0,
    },
    {
      icon: RefreshCw,
      title: 'Set up standing orders',
      description: 'Automate recurring orders so you never run low.',
      href: '/client-portal/standing-orders',
      complete: false,
    },
  ]

  return (
    <Card className="border-sand bg-white mb-6 sm:mb-8 relative">
      <CardContent className="p-5 sm:p-6">
        {/* Dismiss button */}
        <button
          type="button"
          onClick={handleDismiss}
          aria-label="Dismiss welcome guide"
          className="absolute top-3 right-3 sm:top-4 sm:right-4 p-2 text-ink/40 hover:text-ink transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center"
        >
          <X className="h-5 w-5" />
        </button>

        {/* Header */}
        <div className="mb-5 pr-10">
          <h2 className="font-serif text-xl sm:text-2xl font-bold text-ink mb-1">
            Welcome to your portal
          </h2>
          <p className="text-sm text-ink/50">
            Get started in three simple steps.
          </p>
        </div>

        {/* Steps */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {steps.map((step, index) => {
            const Icon = step.icon
            return (
              <Link
                key={step.title}
                href={step.href}
                className="group border border-shell bg-cream p-4 flex flex-col gap-3 hover:border-ink/20 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <div className="flex items-center justify-center h-9 w-9 border border-shell bg-white shrink-0">
                    {step.complete ? (
                      <CheckCircle2 className="h-5 w-5 text-ink" />
                    ) : (
                      <Icon className="h-5 w-5 text-sand" />
                    )}
                  </div>
                  <span className="text-xs font-mono text-ink/30 uppercase tracking-widest">
                    Step {index + 1}
                  </span>
                </div>

                <div>
                  <p className={`text-sm font-semibold leading-snug mb-0.5 ${
                    step.complete ? 'text-ink/40 line-through' : 'text-ink'
                  }`}>
                    {step.title}
                  </p>
                  <p className="text-xs text-ink/50 leading-relaxed">
                    {step.description}
                  </p>
                </div>

                <span className="inline-flex items-center gap-1 text-xs font-medium text-ink/60 group-hover:text-ink transition-colors mt-auto">
                  {step.complete ? 'Done' : 'Get started'}
                  <ArrowRight className="h-3 w-3" />
                </span>
              </Link>
            )
          })}
        </div>
      </CardContent>
    </Card>
  )
}

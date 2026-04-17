'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Package, Users, Webhook, MessageSquare, Tag, CheckSquare, Square, X, ArrowRight } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'

const STORAGE_KEY = 'admin-onboarding-dismissed'

interface ChecklistStep {
  icon: typeof Package
  title: string
  description: string
  href: string
  storageKey: string
}

const STEPS: ChecklistStep[] = [
  {
    icon: Package,
    title: 'Add your first product',
    description: 'Build your catalog so clients can start ordering.',
    href: '/admin/products',
    storageKey: 'admin-step-products',
  },
  {
    icon: Users,
    title: 'Invite your first client',
    description: 'Add a client and send them a portal invitation.',
    href: '/admin/clients',
    storageKey: 'admin-step-clients',
  },
  {
    icon: Webhook,
    title: 'Configure Stripe webhook',
    description: 'Enable payment notifications for real-time order updates.',
    href: '/admin/settings/webhooks',
    storageKey: 'admin-step-stripe',
  },
  {
    icon: MessageSquare,
    title: 'Set up Bloo.io SMS',
    description: 'Connect iMessage and SMS to message clients directly.',
    href: '/admin/settings',
    storageKey: 'admin-step-blooio',
  },
  {
    icon: Tag,
    title: 'Review your pricing tiers',
    description: 'Configure wholesale tiers for different client segments.',
    href: '/admin/pricing',
    storageKey: 'admin-step-pricing',
  },
]

export function AdminOnboardingChecklist() {
  const [dismissed, setDismissed] = useState(true)
  const [completedSteps, setCompletedSteps] = useState<Record<string, boolean>>({})

  useEffect(() => {
    try {
      const isDismissed = localStorage.getItem(STORAGE_KEY) === 'true'
      setDismissed(isDismissed)

      const completed: Record<string, boolean> = {}
      for (const step of STEPS) {
        completed[step.storageKey] = localStorage.getItem(step.storageKey) === 'true'
      }
      setCompletedSteps(completed)
    } catch {
      // localStorage unavailable — keep hidden
    }
  }, [])

  function handleDismiss() {
    try {
      localStorage.setItem(STORAGE_KEY, 'true')
    } catch {
      // storage unavailable
    }
    setDismissed(true)
  }

  function toggleStep(storageKey: string) {
    const next = !completedSteps[storageKey]
    try {
      if (next) {
        localStorage.setItem(storageKey, 'true')
      } else {
        localStorage.removeItem(storageKey)
      }
    } catch {
      // storage unavailable
    }
    setCompletedSteps((prev) => ({ ...prev, [storageKey]: next }))
  }

  if (dismissed) return null

  const completedCount = Object.values(completedSteps).filter(Boolean).length
  const allDone = completedCount === STEPS.length

  return (
    <Card className="border-sand bg-white mb-6 sm:mb-8 relative">
      <CardContent className="p-5 sm:p-6">
        {/* Dismiss button */}
        <button
          type="button"
          onClick={handleDismiss}
          aria-label="Dismiss setup checklist"
          className="absolute top-3 right-3 sm:top-4 sm:right-4 p-2 text-ink/40 hover:text-ink transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center"
        >
          <X className="h-5 w-5" />
        </button>

        {/* Header */}
        <div className="mb-5 pr-10">
          <p className="text-xs font-mono tracking-[0.15em] uppercase text-sand mb-1">Setup</p>
          <h2 className="font-serif text-xl sm:text-2xl font-bold text-ink mb-1">
            Get your portal ready
          </h2>
          <p className="text-sm text-ink/50">
            {completedCount} of {STEPS.length} steps complete
          </p>
          {/* Progress bar */}
          <div className="mt-3 h-1 bg-shell w-full">
            <div
              className="h-1 bg-ink transition-all duration-300"
              style={{ width: `${(completedCount / STEPS.length) * 100}%` }}
            />
          </div>
        </div>

        {/* Steps */}
        <div className="space-y-2">
          {STEPS.map((step) => {
            const Icon = step.icon
            const isComplete = completedSteps[step.storageKey] ?? false
            return (
              <div
                key={step.storageKey}
                className="flex items-center gap-3 border border-shell p-3 hover:border-sand/80 transition-colors"
              >
                <button
                  type="button"
                  onClick={() => toggleStep(step.storageKey)}
                  aria-label={isComplete ? `Mark "${step.title}" as incomplete` : `Mark "${step.title}" as complete`}
                  className="shrink-0 text-ink/40 hover:text-ink transition-colors min-h-[44px] min-w-[20px] flex items-center justify-center"
                >
                  {isComplete ? (
                    <CheckSquare className="h-5 w-5 text-ink" />
                  ) : (
                    <Square className="h-5 w-5" />
                  )}
                </button>
                <div className="flex items-center gap-3 flex-1 min-w-0">
                  <div className="flex items-center justify-center h-8 w-8 border border-shell bg-cream shrink-0">
                    <Icon className="h-4 w-4 text-sand" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className={`text-sm font-medium leading-snug ${isComplete ? 'text-ink/40 line-through' : 'text-ink'}`}>
                      {step.title}
                    </p>
                    <p className="text-xs text-ink/50 leading-relaxed truncate">{step.description}</p>
                  </div>
                </div>
                <Link
                  href={step.href}
                  className="shrink-0 inline-flex items-center gap-1 text-xs font-medium text-ink/60 hover:text-ink transition-colors min-h-[44px] px-1"
                >
                  <span className="hidden sm:inline">Go</span>
                  <ArrowRight className="h-3.5 w-3.5" />
                </Link>
              </div>
            )
          })}
        </div>

        {allDone && (
          <div className="mt-4 flex items-center justify-between border border-sand/50 bg-cream p-3">
            <p className="text-sm text-ink font-medium">All steps complete.</p>
            <button
              type="button"
              onClick={handleDismiss}
              className="text-xs font-mono text-ink/60 hover:text-ink underline transition-colors"
            >
              Dismiss checklist
            </button>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

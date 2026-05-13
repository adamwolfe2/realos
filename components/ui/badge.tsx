import * as React from 'react'
import { Slot } from '@radix-ui/react-slot'
import { cva, type VariantProps } from 'class-variance-authority'

import { cn } from '@/lib/utils'

// ---------------------------------------------------------------------------
// Badge — the canonical pill component for the entire portal.
//
// Semantic variants are split into FOUR roles so the visual language scans
// quickly:
//
//   • status   → operational state (Active / Draft / Connected / Done)
//                Renders as a flat tinted pill with consistent casing.
//   • severity → urgency (Critical / Warning / Info / Success)
//                Use the dedicated `severity` prop instead of variant so
//                pages can pass severity strings from data without mapping.
//   • category → taxonomy label (Channel / Source / Type / Tag)
//                Neutral muted bg with foreground text.
//   • count    → numeric badge (3, 12, 99+) — minimal, tabular-nums.
//
// All other legacy variants (default / secondary / destructive / outline)
// remain for backward compatibility with shadcn/ui and existing call sites.
// ---------------------------------------------------------------------------

const badgeVariants = cva(
  'inline-flex items-center justify-center rounded-md border px-2 py-0.5 text-xs font-medium w-fit whitespace-nowrap shrink-0 [&>svg]:size-3 gap-1 [&>svg]:pointer-events-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] aria-invalid:ring-destructive/20 aria-invalid:border-destructive transition-[color,box-shadow] overflow-hidden',
  {
    variants: {
      variant: {
        // Legacy / shadcn — keep for backward compat.
        default:
          'border-transparent bg-primary text-primary-foreground [a&]:hover:bg-primary/90',
        secondary:
          'border-transparent bg-secondary text-secondary-foreground [a&]:hover:bg-secondary/90',
        destructive:
          'border-transparent bg-destructive text-white [a&]:hover:bg-destructive/90 focus-visible:ring-destructive/20',
        outline:
          'text-foreground [a&]:hover:bg-accent [a&]:hover:text-accent-foreground',

        // === Semantic roles ================================================
        // status — operational state. Subtle tinted pills, Title Case label.
        status:
          'border-border bg-card text-foreground',
        statusActive:
          'border-transparent bg-primary/10 text-primary',
        statusSuccess:
          'border-transparent bg-emerald-50 text-emerald-700',
        statusMuted:
          'border-transparent bg-muted text-muted-foreground',

        // severity — urgency tokens (use the `severity` prop for cleanest API).
        severityCritical:
          'border-transparent bg-red-50 text-red-700',
        severityWarning:
          'border-transparent bg-amber-50 text-amber-800',
        severityInfo:
          'border-transparent bg-blue-50 text-blue-700',
        severitySuccess:
          'border-transparent bg-emerald-50 text-emerald-700',

        // category — taxonomy / tag.
        category:
          'border-transparent bg-muted text-muted-foreground uppercase tracking-wide text-[10px] font-semibold',

        // count — numeric badge.
        count:
          'border-transparent bg-muted text-foreground tabular-nums px-1.5 min-w-[1.25rem] h-5 text-[11px] font-semibold',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  },
)

type Severity = 'critical' | 'warning' | 'info' | 'success'

const SEVERITY_TO_VARIANT: Record<Severity, NonNullable<VariantProps<typeof badgeVariants>['variant']>> = {
  critical: 'severityCritical',
  warning: 'severityWarning',
  info: 'severityInfo',
  success: 'severitySuccess',
}

type BadgeProps = React.ComponentProps<'span'> &
  VariantProps<typeof badgeVariants> & {
    asChild?: boolean
    /** Shorthand for severity-role badges. Overrides `variant` if provided. */
    severity?: Severity
  }

function Badge({
  className,
  variant,
  asChild = false,
  severity,
  ...props
}: BadgeProps) {
  const Comp = asChild ? Slot : 'span'
  const resolved = severity ? SEVERITY_TO_VARIANT[severity] : variant

  return (
    <Comp
      data-slot="badge"
      data-severity={severity}
      className={cn(badgeVariants({ variant: resolved }), className)}
      {...props}
    />
  )
}

export { Badge, badgeVariants }
export type { Severity as BadgeSeverity }

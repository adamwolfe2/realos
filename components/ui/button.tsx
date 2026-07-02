import * as React from 'react'
import { Slot } from '@radix-ui/react-slot'
import { cva, type VariantProps } from 'class-variance-authority'

import { cn } from '@/lib/utils'

// TODO(#27): Centralize Lucide stroke width. We standardized on
// strokeWidth={1.5} during the icon pass, but most call sites apply it
// inline. Wrap lucide-react with a thin re-export (e.g. lib/icons.tsx)
// that defaults strokeWidth so future contributors don't need to think
// about it, and remove the inline prop everywhere. Tracked separately
// to keep the icon-replacement diff scoped.

// Premium micro-interaction: every button variant ships with a subtle
// scale-on-press — active:scale-[0.98] with a 100ms transition. Reads as
// satisfying tactile feedback without any visible motion on hover.
// duration-100 matches the macOS dock press timing (fast in, fast out).
// Disabled buttons skip the scale. Respects prefers-reduced-motion.
const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-[3px] text-sm font-medium transition-all duration-100 active:scale-[0.98] disabled:active:scale-100 motion-reduce:active:scale-100 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg:not([class*='size-'])]:size-4 shrink-0 [&_svg]:shrink-0 outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] aria-invalid:ring-destructive/20 aria-invalid:border-destructive",
  {
    variants: {
      variant: {
        default: 'bg-primary text-primary-foreground hover:bg-primary/90',
        destructive:
          'bg-destructive text-white hover:bg-destructive/90 focus-visible:ring-destructive/20',
        outline:
          'border bg-background shadow-xs hover:bg-accent hover:text-accent-foreground',
        secondary:
          'bg-secondary text-secondary-foreground hover:bg-secondary/80',
        ghost:
          'hover:bg-accent hover:text-accent-foreground',
        link: 'text-primary underline-offset-4 hover:underline',
      },
      size: {
        default: 'h-9 px-4 py-2 has-[>svg]:px-3',
        sm: 'h-8 rounded-[3px] gap-1.5 px-3 has-[>svg]:px-2.5',
        lg: 'h-10 rounded-[3px] px-6 has-[>svg]:px-4',
        icon: 'size-9',
        'icon-sm': 'size-8',
        'icon-lg': 'size-10',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  },
)

function Button({
  className,
  variant,
  size,
  asChild = false,
  ...props
}: React.ComponentProps<'button'> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean
  }) {
  const Comp = asChild ? Slot : 'button'

  return (
    <Comp
      data-slot="button"
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  )
}

export { Button, buttonVariants }

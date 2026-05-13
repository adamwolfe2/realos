'use client'

import { Toaster as Sonner, ToasterProps } from 'sonner'

// Brand-aligned Sonner wrapper.
//
// Success / info toasts use the LeaseStack primary blue token; error
// toasts use the destructive red token. Default toasts are neutral
// popover-styled. This keeps notifications consistent with the rest
// of the product palette — no green / amber / yellow leaks.
const Toaster = ({ ...props }: ToasterProps) => {
  return (
    <Sonner
      theme="light"
      position="top-right"
      richColors={false}
      className="toaster group"
      toastOptions={{
        unstyled: false,
        classNames: {
          toast:
            'group toast group-[.toaster]:bg-popover group-[.toaster]:text-popover-foreground group-[.toaster]:border-border group-[.toaster]:shadow-lg',
          description: 'group-[.toast]:text-muted-foreground',
          actionButton:
            'group-[.toast]:bg-primary group-[.toast]:text-primary-foreground',
          cancelButton:
            'group-[.toast]:bg-muted group-[.toast]:text-muted-foreground',
          // Brand-blue success / info; destructive error. Sonner default
          // success = green, default info = blue, default error = red —
          // we lock success to brand blue so it never reads as green.
          success:
            '!bg-primary/10 !text-primary !border-primary/30',
          info: '!bg-primary/10 !text-primary !border-primary/30',
          warning:
            '!bg-primary/10 !text-primary !border-primary/30',
          error:
            '!bg-destructive/10 !text-destructive !border-destructive/30',
        },
      }}
      style={
        {
          '--normal-bg': 'var(--popover)',
          '--normal-text': 'var(--popover-foreground)',
          '--normal-border': 'var(--border)',
        } as React.CSSProperties
      }
      {...props}
    />
  )
}

export { Toaster }

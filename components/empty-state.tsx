import Link from 'next/link'
import type { LucideIcon } from 'lucide-react'

export interface EmptyStateProps {
  icon: LucideIcon
  title: string
  description: string
  action?: { label: string; href: string }
}

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
}: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
      {/* Icon circle */}
      <div className="flex items-center justify-center w-16 h-16 border border-sand bg-cream mb-5">
        <Icon className="h-7 w-7 text-sand" strokeWidth={1.5} />
      </div>

      {/* Title */}
      <h3 className="font-serif text-lg font-semibold text-ink mb-2">
        {title}
      </h3>

      {/* Description */}
      <p className="text-sm text-ink/50 max-w-xs leading-relaxed mb-6">
        {description}
      </p>

      {/* Optional CTA */}
      {action && (
        <Link
          href={action.href}
          className="inline-flex items-center justify-center px-5 py-2.5 text-sm font-medium bg-ink text-cream hover:bg-ink/80 transition-colors min-h-[40px]"
        >
          {action.label}
        </Link>
      )}
    </div>
  )
}

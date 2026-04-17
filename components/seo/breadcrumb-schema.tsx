import { portalConfig } from "@/lib/portal-config"

interface BreadcrumbItem {
  readonly name: string
  readonly href?: string
}

interface BreadcrumbSchemaProps {
  readonly items: readonly BreadcrumbItem[]
}

/**
 * Renders a BreadcrumbList JSON-LD script tag for SEO.
 *
 * Usage:
 *   <BreadcrumbSchema items={[{ name: "Home", href: "/" }, { name: "About" }]} />
 *
 * The last item is treated as the current page (no link).
 */
export function BreadcrumbSchema({ items }: BreadcrumbSchemaProps) {
  const schema = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: item.name,
      ...(item.href
        ? { item: `${portalConfig.appUrl}${item.href}` }
        : {}),
    })),
  }

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
    />
  )
}

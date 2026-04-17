import Link from "next/link";
import type { TenantWithSite } from "@/lib/tenancy/tenant-context";

const DEFAULT_LINKS = [
  { href: "/floor-plans", label: "Floor Plans" },
  { href: "/amenities", label: "Amenities" },
  { href: "/gallery", label: "Gallery" },
  { href: "/location", label: "Location" },
  { href: "/contact", label: "Contact" },
];

export function TenantNav({ tenant }: { tenant: TenantWithSite }) {
  const config = tenant.tenantSiteConfig;
  const applyUrl = config?.primaryCtaUrl ?? "/apply";
  const phone = config?.phoneNumber ?? tenant.primaryContactPhone ?? null;

  return (
    <header className="sticky top-0 z-40 bg-white/90 backdrop-blur border-b">
      <div className="max-w-6xl mx-auto px-4 md:px-6 py-3 flex items-center justify-between gap-3">
        <Link href="/" className="flex items-center gap-2">
          {tenant.logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={tenant.logoUrl}
              alt={tenant.name}
              className="h-8 w-auto"
            />
          ) : null}
          <span className="font-serif font-bold text-lg">{tenant.name}</span>
        </Link>
        <nav className="hidden md:flex items-center gap-6 text-sm">
          {DEFAULT_LINKS.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className="hover:opacity-70 transition-opacity"
            >
              {l.label}
            </Link>
          ))}
        </nav>
        <div className="flex items-center gap-2">
          {phone ? (
            <a
              href={`tel:${phone.replace(/[^0-9+]/g, "")}`}
              className="hidden md:inline text-sm font-medium"
            >
              {phone}
            </a>
          ) : null}
          <Link
            href={applyUrl}
            className="inline-block px-4 py-2 text-sm font-semibold rounded"
            style={{
              backgroundColor: "var(--tenant-primary)",
              color: "white",
            }}
          >
            {config?.primaryCtaText ?? "Apply Now"}
          </Link>
        </div>
      </div>
    </header>
  );
}

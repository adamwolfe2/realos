import Link from "next/link";
import type { TenantWithSite } from "@/lib/tenancy/tenant-context";

export function TenantFooter({ tenant }: { tenant: TenantWithSite }) {
  const config = tenant.tenantSiteConfig;
  const year = new Date().getFullYear();
  const phone = config?.phoneNumber ?? tenant.primaryContactPhone ?? null;
  const email = config?.contactEmail ?? tenant.primaryContactEmail ?? null;
  const property = tenant.properties[0];

  return (
    <footer className="mt-16 border-t bg-slate-950 text-slate-200">
      <div className="max-w-6xl mx-auto px-4 md:px-6 py-12 grid grid-cols-1 md:grid-cols-3 gap-8 text-sm">
        <div>
          <p className="font-serif text-xl font-bold">{tenant.name}</p>
          {config?.tagline ? (
            <p className="opacity-70 mt-2">{config.tagline}</p>
          ) : null}
          {property?.addressLine1 ? (
            <p className="opacity-70 mt-4">
              {property.addressLine1}
              <br />
              {property.city}
              {property.state ? `, ${property.state}` : ""}
              {property.postalCode ? ` ${property.postalCode}` : ""}
            </p>
          ) : null}
        </div>
        <div>
          <p className="font-semibold mb-3 opacity-80 text-xs tracking-widest uppercase">
            Explore
          </p>
          <ul className="space-y-1.5">
            <li><Link href="/floor-plans" className="opacity-80 hover:opacity-100">Floor plans</Link></li>
            <li><Link href="/amenities" className="opacity-80 hover:opacity-100">Amenities</Link></li>
            <li><Link href="/gallery" className="opacity-80 hover:opacity-100">Gallery</Link></li>
            <li><Link href="/location" className="opacity-80 hover:opacity-100">Location</Link></li>
            <li><Link href="/contact" className="opacity-80 hover:opacity-100">Contact</Link></li>
            <li><Link href="/parents" className="opacity-80 hover:opacity-100">Parents + FAQ</Link></li>
          </ul>
        </div>
        <div>
          <p className="font-semibold mb-3 opacity-80 text-xs tracking-widest uppercase">
            Talk to us
          </p>
          {phone ? (
            <p className="opacity-80">
              <a href={`tel:${phone.replace(/[^0-9+]/g, "")}`}>{phone}</a>
            </p>
          ) : null}
          {email ? (
            <p className="opacity-80">
              <a href={`mailto:${email}`}>{email}</a>
            </p>
          ) : null}
          <Link
            href={config?.primaryCtaUrl ?? "/apply"}
            className="inline-block mt-4 px-4 py-2 text-sm font-semibold rounded"
            style={{
              backgroundColor: "var(--tenant-primary)",
              color: "white",
            }}
          >
            {config?.primaryCtaText ?? "Apply Now"}
          </Link>
        </div>
      </div>
      <div className="border-t border-slate-800 text-xs opacity-60 py-4 px-4 md:px-6 max-w-6xl mx-auto flex flex-col md:flex-row gap-2 md:justify-between">
        <span>
          © {year} {tenant.name}. All rights reserved.
        </span>
        <span className="flex gap-3">
          <Link href="/fair-housing">Fair Housing</Link>
          <Link href="/privacy">Privacy</Link>
          <Link href="/terms">Terms</Link>
        </span>
      </div>
    </footer>
  );
}

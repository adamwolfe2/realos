# Sprint 07 — Tenant Marketing Site Renderer

**Duration:** 1 day
**Dependencies:** Sprint 02, 06
**Goal:** When a visitor hits `telegraphcommons.com` (or `telegraph-commons.platformdomain.com`), our Next.js app serves a full marketing site with live AppFolio listings, branded with the tenant's config, with chatbot + pixel + exit-intent wired in. Plus "bring your own site" mode that serves nothing here but exposes embed scripts.

---

## Fork from Telegraph Commons

**FORK FROM:** `github.com/adamwolfe2/telegraph-commons` — Norman's existing site has the hero, listings grid, amenities section, and apply CTA already built. Pull those components into `components/tenant-site/` as the base, then parameterize them to pull from `TenantSiteConfig` + `Property.listings` instead of hardcoded content.

Specifically port these (if they exist in that repo — names may vary):
- Hero component
- Listings grid / Rooms grid
- Amenities section
- Photo gallery
- Apply CTA / Tour form
- Footer
- Navigation

Keep the visual design. Swap every hardcoded string for a prop coming from `TenantSiteConfig`, and every hardcoded listing for a `Listing` record from the DB.

---

## Architecture

All tenant marketing routes live under `app/_tenant/`. The middleware (Sprint 02) rewrites `telegraphcommons.com/apply` → `/_tenant/apply` with `x-tenant-org-id` header. Every page in `_tenant/` resolves its org from that header via a helper:

```typescript
// lib/tenancy/tenant-context.ts
import { headers } from "next/headers";
import { prisma } from "@/lib/db";
import { cache } from "react";

export const getTenantFromHeaders = cache(async () => {
  const h = await headers();
  const orgId = h.get("x-tenant-org-id");
  if (!orgId) return null;
  return prisma.organization.findUnique({
    where: { id: orgId },
    include: {
      tenantSiteConfig: true,
      properties: {
        include: {
          listings: { where: { isAvailable: true }, orderBy: { priceCents: "asc" } },
        },
      },
    },
  });
});
```

---

## Step-by-step

### 1. Route group structure

```
app/_tenant/
├── layout.tsx              # Tenant branding wrapper, chatbot + pixel injection
├── page.tsx                # Homepage
├── apply/page.tsx          # Apply form
├── tours/page.tsx          # Request a tour form
├── floor-plans/page.tsx    # Floor plan / unit type grid
├── amenities/page.tsx
├── about/page.tsx
├── international-students/page.tsx   # SEO landing (student housing only)
├── summer-leases/page.tsx            # SEO landing (student housing only)
├── contact/page.tsx
└── robots.txt/route.ts     # Tenant-specific robots
```

### 2. Tenant layout

```tsx
// app/_tenant/layout.tsx
import { getTenantFromHeaders } from "@/lib/tenancy/tenant-context";
import { notFound } from "next/navigation";
import { TenantNav } from "@/components/tenant-site/nav";
import { TenantFooter } from "@/components/tenant-site/footer";
import { ChatbotLoader } from "@/components/chatbot/chatbot-loader";
import { CursivePixelLoader } from "@/components/pixel/cursive-pixel-loader";
import { ExitIntentPopup } from "@/components/tenant-site/exit-intent-popup";

export default async function TenantLayout({ children }: { children: React.ReactNode }) {
  const tenant = await getTenantFromHeaders();
  if (!tenant) notFound();
  const config = tenant.tenantSiteConfig;

  // Bring-your-own-site mode: only emit chatbot + pixel scripts, no layout
  if (tenant.bringYourOwnSite) {
    return (
      <>
        {config?.enableChatbot && <ChatbotLoader orgId={tenant.id} config={config} />}
        {config?.enablePixel && <CursivePixelLoader orgId={tenant.id} />}
      </>
    );
  }

  return (
    <html lang="en">
      <head>
        <title>{config?.metaTitle ?? tenant.name}</title>
        <meta name="description" content={config?.metaDescription ?? ""} />
        {config?.ogImageUrl && <meta property="og:image" content={config.ogImageUrl} />}
        <style>{`
          :root {
            --brand-primary: ${tenant.primaryColor ?? "#000000"};
            --brand-secondary: ${tenant.secondaryColor ?? "#ffffff"};
          }
        `}</style>
      </head>
      <body>
        <TenantNav tenant={tenant} />
        <main>{children}</main>
        <TenantFooter tenant={tenant} />
        {config?.enableChatbot && <ChatbotLoader orgId={tenant.id} config={config} />}
        {config?.enablePixel && <CursivePixelLoader orgId={tenant.id} />}
        {config?.enableExitIntent && (
          <ExitIntentPopup
            headline={config.exitIntentHeadline}
            body={config.exitIntentBody}
            ctaText={config.exitIntentCtaText}
            offerCode={config.exitIntentOfferCode}
            orgId={tenant.id}
          />
        )}
      </body>
    </html>
  );
}
```

### 3. Homepage

```tsx
// app/_tenant/page.tsx
import { getTenantFromHeaders } from "@/lib/tenancy/tenant-context";
import { Hero } from "@/components/tenant-site/hero";
import { ListingsGrid } from "@/components/tenant-site/listings-grid";
import { AmenitiesSection } from "@/components/tenant-site/amenities-section";
import { AboutSection } from "@/components/tenant-site/about-section";
import { ApplyCta } from "@/components/tenant-site/apply-cta";

export default async function TenantHome() {
  const tenant = await getTenantFromHeaders();
  if (!tenant) return null;
  const config = tenant.tenantSiteConfig;
  const primaryProperty = tenant.properties[0];

  return (
    <>
      <Hero
        headline={config?.heroHeadline ?? tenant.name}
        subheadline={config?.heroSubheadline}
        imageUrl={config?.heroImageUrl}
        ctaText={config?.primaryCtaText ?? "Apply Now"}
        ctaUrl={config?.primaryCtaUrl ?? "/apply"}
      />

      {config?.showListings !== false && primaryProperty && (
        <ListingsGrid
          property={primaryProperty}
          listings={primaryProperty.listings}
        />
      )}

      {config?.showAmenities !== false && primaryProperty?.amenities && (
        <AmenitiesSection amenities={primaryProperty.amenities as string[]} />
      )}

      {config?.aboutCopy && <AboutSection copy={config.aboutCopy} />}

      <ApplyCta tenant={tenant} />
    </>
  );
}
```

### 4. Listings grid + room card

```tsx
// components/tenant-site/listings-grid.tsx
import { RoomCard } from "./room-card";
import type { Property, Listing } from "@prisma/client";

export function ListingsGrid({ property, listings }: { property: Property; listings: Listing[] }) {
  if (listings.length === 0) {
    return (
      <section className="py-16 text-center">
        <h2 className="text-3xl font-bold mb-2">All leased for the current term</h2>
        <p className="text-muted-foreground">Join the waitlist for next term.</p>
        <a href="/apply" className="inline-block mt-4 px-6 py-3 bg-[var(--brand-primary)] text-white rounded">Join waitlist</a>
      </section>
    );
  }

  // Group by unit type
  const grouped = listings.reduce((acc, l) => {
    const key = l.unitType ?? "Standard";
    (acc[key] ??= []).push(l);
    return acc;
  }, {} as Record<string, Listing[]>);

  return (
    <section className="py-16 px-4 max-w-6xl mx-auto">
      <h2 className="text-4xl font-bold mb-8">Available units</h2>
      {Object.entries(grouped).map(([unitType, units]) => {
        const minPrice = Math.min(...units.map(u => u.priceCents ?? Infinity));
        return (
          <div key={unitType} className="mb-10">
            <h3 className="text-2xl font-semibold mb-4">{unitType}</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {units.slice(0, 6).map(l => (
                <RoomCard key={l.id} listing={l} />
              ))}
            </div>
            {units.length > 6 && <a href="/floor-plans" className="text-sm underline mt-2 inline-block">See all {units.length} units</a>}
          </div>
        );
      })}
    </section>
  );
}
```

### 5. Apply form

```tsx
// app/_tenant/apply/page.tsx
import { getTenantFromHeaders } from "@/lib/tenancy/tenant-context";
import { ApplyForm } from "@/components/tenant-site/apply-form";

export default async function ApplyPage() {
  const tenant = await getTenantFromHeaders();
  if (!tenant) return null;
  return (
    <div className="max-w-2xl mx-auto py-12 px-4">
      <h1 className="text-4xl font-bold mb-6">Apply to live at {tenant.name}</h1>
      <ApplyForm
        orgId={tenant.id}
        propertyId={tenant.properties[0]?.id}
        unitTypes={[...new Set(tenant.properties.flatMap(p => p.listings.map(l => l.unitType)).filter(Boolean))]}
      />
    </div>
  );
}
```

```tsx
// components/tenant-site/apply-form.tsx (client component)
"use client";
import { useState } from "react";

export function ApplyForm({ orgId, propertyId, unitTypes }: { orgId: string; propertyId?: string; unitTypes: string[] }) {
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSubmitting(true);
    const fd = new FormData(e.currentTarget);
    const payload = {
      orgId,
      propertyId,
      source: "FORM",
      sourceDetail: "apply_page",
      firstName: fd.get("firstName"),
      lastName: fd.get("lastName"),
      email: fd.get("email"),
      phone: fd.get("phone"),
      preferredUnitType: fd.get("preferredUnitType"),
      desiredMoveIn: fd.get("desiredMoveIn"),
      budgetMax: fd.get("budgetMax"),
      notes: fd.get("notes"),
    };
    const res = await fetch("/api/public/leads", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (res.ok) setSubmitted(true);
    setSubmitting(false);
  }

  if (submitted) {
    return (
      <div className="text-center py-12">
        <h2 className="text-2xl font-bold mb-2">Thanks — we'll be in touch within 24 hours.</h2>
        <p>Check your email for confirmation and next steps.</p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <input name="firstName" placeholder="First name" required className="border p-3 rounded" />
        <input name="lastName" placeholder="Last name" required className="border p-3 rounded" />
      </div>
      <input name="email" type="email" placeholder="Email" required className="w-full border p-3 rounded" />
      <input name="phone" placeholder="Phone" className="w-full border p-3 rounded" />
      <select name="preferredUnitType" className="w-full border p-3 rounded">
        <option value="">Preferred unit type</option>
        {unitTypes.map(t => <option key={t} value={t!}>{t}</option>)}
      </select>
      <input name="desiredMoveIn" type="date" className="w-full border p-3 rounded" />
      <input name="budgetMax" type="number" placeholder="Max monthly budget ($)" className="w-full border p-3 rounded" />
      <textarea name="notes" placeholder="Anything else?" className="w-full border p-3 rounded" rows={3} />
      <button type="submit" disabled={submitting} className="w-full py-3 bg-[var(--brand-primary)] text-white rounded font-semibold">
        {submitting ? "Submitting..." : "Submit application"}
      </button>
    </form>
  );
}
```

### 6. Public lead capture endpoint

```typescript
// app/api/public/leads/route.ts
import { prisma } from "@/lib/db";
import { z } from "zod";
import { NextRequest, NextResponse } from "next/server";
import { ratelimit } from "@/lib/rate-limit";
import { sendSlackAlert } from "@/lib/integrations/slack";
import { sendLeadAutoReplyEmail } from "@/lib/email/lead-emails";

const schema = z.object({
  orgId: z.string(),
  propertyId: z.string().optional(),
  source: z.string(),
  sourceDetail: z.string().optional(),
  firstName: z.string().optional(),
  lastName: z.string().optional(),
  email: z.string().email().optional(),
  phone: z.string().optional(),
  preferredUnitType: z.string().optional(),
  desiredMoveIn: z.string().optional(),
  budgetMax: z.string().optional(),
  notes: z.string().optional(),
  visitorHash: z.string().optional(),               // Passed from pixel if available
});

export async function POST(req: NextRequest) {
  const ip = req.headers.get("x-forwarded-for") ?? "unknown";
  const { success } = await ratelimit.limit(ip);
  if (!success) return NextResponse.json({ error: "Rate limited" }, { status: 429 });

  const body = await req.json();
  const data = schema.parse(body);

  const lead = await prisma.lead.create({
    data: {
      orgId: data.orgId,
      propertyId: data.propertyId,
      source: data.source as any,
      sourceDetail: data.sourceDetail,
      firstName: data.firstName,
      lastName: data.lastName,
      email: data.email,
      phone: data.phone,
      preferredUnitType: data.preferredUnitType,
      desiredMoveIn: data.desiredMoveIn ? new Date(data.desiredMoveIn) : null,
      budgetMaxCents: data.budgetMax ? parseInt(data.budgetMax) * 100 : null,
      notes: data.notes,
    },
  });

  // Link to Visitor if we have a hash
  if (data.visitorHash) {
    await prisma.visitor.updateMany({
      where: { orgId: data.orgId, visitorHash: data.visitorHash },
      data: { status: "MATCHED_TO_LEAD", convertedAt: new Date() },
    });
  }

  // Notify agency + client
  const org = await prisma.organization.findUnique({ where: { id: data.orgId } });
  await Promise.all([
    sendSlackAlert({
      channel: "#leads",
      message: `New lead for *${org?.name}*: ${data.firstName} ${data.lastName} (${data.email}) via ${data.source}`,
    }),
    data.email && sendLeadAutoReplyEmail({
      to: data.email,
      firstName: data.firstName,
      orgName: org?.name,
    }),
  ]);

  return NextResponse.json({ ok: true, leadId: lead.id });
}
```

### 7. Exit intent popup

```tsx
// components/tenant-site/exit-intent-popup.tsx
"use client";
import { useEffect, useState } from "react";

export function ExitIntentPopup({
  headline, body, ctaText, offerCode, orgId,
}: {
  headline?: string | null;
  body?: string | null;
  ctaText?: string | null;
  offerCode?: string | null;
  orgId: string;
}) {
  const [open, setOpen] = useState(false);
  const [shown, setShown] = useState(false);

  useEffect(() => {
    function onMouseLeave(e: MouseEvent) {
      if (e.clientY < 10 && !shown) {
        setOpen(true);
        setShown(true);
      }
    }
    document.addEventListener("mouseleave", onMouseLeave);
    return () => document.removeEventListener("mouseleave", onMouseLeave);
  }, [shown]);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    await fetch("/api/public/leads", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        orgId,
        email: fd.get("email"),
        source: "FORM",
        sourceDetail: `exit_intent${offerCode ? `:${offerCode}` : ""}`,
      }),
    });
    setOpen(false);
  }

  if (!open) return null;
  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50" onClick={() => setOpen(false)}>
      <div className="bg-white rounded-lg p-8 max-w-md" onClick={e => e.stopPropagation()}>
        <h2 className="text-2xl font-bold mb-2">{headline ?? "Wait — before you go"}</h2>
        <p className="mb-4">{body ?? "Drop your email and we'll send you info on next term's openings."}</p>
        <form onSubmit={handleSubmit} className="space-y-3">
          <input name="email" type="email" required placeholder="Email" className="w-full border p-3 rounded" />
          <button type="submit" className="w-full py-3 bg-[var(--brand-primary)] text-white rounded font-semibold">
            {ctaText ?? "Send me updates"}
          </button>
        </form>
      </div>
    </div>
  );
}
```

### 8. SEO landing pages

For student housing, ship two high-intent SEO pages:

- `app/_tenant/international-students/page.tsx` — targets "international student housing near {campus}"
- `app/_tenant/summer-leases/page.tsx` — targets "summer sublet {city}"

These pull content from `TenantSiteConfig.customJson` so agency can fill in per-tenant copy. Include schema.org markup, location, FAQ.

Gate rendering by `tenant.residentialSubtype === "STUDENT_HOUSING"`. For other subtypes, return `notFound()` or render a tenant-specific variant.

### 9. Revalidation

When site builder saves in portal, trigger revalidation:

```typescript
// Inside /api/tenant/site-config PATCH handler:
import { revalidatePath } from "next/cache";

revalidatePath("/_tenant", "layout");
```

And when AppFolio sync finishes, revalidate per-tenant listings pages. Add to `syncListingsForOrg`:

```typescript
import { revalidateTag } from "next/cache";
revalidateTag(`tenant-listings:${orgId}`);
```

Use `unstable_cache` with that tag on listings fetches.

### 10. robots.txt per tenant

```typescript
// app/_tenant/robots.txt/route.ts
import { getTenantFromHeaders } from "@/lib/tenancy/tenant-context";

export async function GET() {
  const tenant = await getTenantFromHeaders();
  const host = tenant?.domains[0]?.hostname ?? tenant?.slug;
  return new Response(
    `User-agent: *
Allow: /
Sitemap: https://${host}/sitemap.xml`,
    { headers: { "Content-Type": "text/plain" } }
  );
}
```

---

## Done when

- [ ] Visiting `telegraph-commons.{platformdomain}.com` renders a full marketing site
- [ ] Live AppFolio listings display on homepage + floor-plans page
- [ ] Apply form creates a Lead, notifies Slack + emails applicant
- [ ] Exit intent popup fires once per session, captures email as Lead with `sourceDetail: "exit_intent"`
- [ ] Brand colors from `Organization` apply to CSS variables
- [ ] Meta tags + OG image render from `TenantSiteConfig`
- [ ] Bring-your-own-site mode loads only chatbot + pixel scripts, no layout
- [ ] Lighthouse scores above 90 on mobile

## Handoff to Sprint 08
Marketing site is live. Sprint 08 wires Cursive pixel so the site captures anonymous visitors and turns them into identified leads.

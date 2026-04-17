# Sprint 06 — AppFolio Integration & Listings Sync

**Duration:** 1 day
**Dependencies:** Sprint 05
**Goal:** Tenant's AppFolio listings flow into `Property.listings` on a schedule and on-demand. Tenant marketing site shows live availability.

---

## Fork from Telegraph Commons

**FORK FROM:** `github.com/adamwolfe2/telegraph-commons` — Adam has already done the AppFolio API research there. Before writing this sprint, pull that repo and extract:
- Any `lib/appfolio.ts`, `lib/integrations/appfolio.ts`, or similar
- API endpoint patterns used
- Auth approach (OAuth vs API key)
- Rate limits observed
- Listing payload shape

Copy the research into `docs/appfolio-integration-notes.md` as the canonical reference for this sprint. If the repo has working code, port it to `lib/integrations/appfolio.ts` in the new monorepo.

---

## Two modes

1. **REST API mode** (AppFolio Plus plan — Norman has this)
2. **Embed script fallback** (for clients without Plus)

Both populate the same `Listing` table so downstream code doesn't care which mode.

---

## Step-by-step

### 1. REST client

```typescript
// lib/integrations/appfolio.ts
import { prisma } from "@/lib/db";
import { decrypt } from "@/lib/crypto";

const APPFOLIO_BASE = (subdomain: string) => `https://${subdomain}.appfolio.com/api/v1`;

export type AppFolioListing = {
  id: string;
  property_id: string;
  property_group: string;
  unit_number?: string;
  unit_type?: string;
  bedrooms?: number;
  bathrooms?: number;
  square_feet?: number;
  rent?: number;                                        // Monthly rent in dollars
  available?: boolean;
  available_from?: string;
  photos?: string[];
  description?: string;
  amenities?: string[];
};

export async function fetchAppFolioListings(orgId: string): Promise<AppFolioListing[]> {
  const integration = await prisma.appFolioIntegration.findUnique({
    where: { orgId },
    include: { org: true },
  });
  if (!integration) throw new Error("No AppFolio integration configured");

  if (integration.useEmbedFallback) {
    return fetchFromEmbedFallback(integration);
  }

  const apiKey = integration.apiKeyEncrypted ? decrypt(integration.apiKeyEncrypted) : null;
  if (!apiKey) throw new Error("AppFolio API key missing");

  const url = new URL(`${APPFOLIO_BASE(integration.instanceSubdomain)}/listings`);
  if (integration.propertyGroupFilter) {
    url.searchParams.set("property_group", integration.propertyGroupFilter);
  }

  const res = await fetch(url.toString(), {
    headers: {
      Authorization: `Bearer ${apiKey}`,
      Accept: "application/json",
    },
  });

  if (!res.ok) {
    await prisma.appFolioIntegration.update({
      where: { orgId },
      data: { syncStatus: "error", lastError: `${res.status}: ${await res.text()}` },
    });
    throw new Error(`AppFolio fetch failed: ${res.status}`);
  }

  const data = await res.json();
  return data.listings ?? data.data ?? [];
}

async function fetchFromEmbedFallback(integration: any): Promise<AppFolioListing[]> {
  // The AppFolio embed script renders listings in an iframe. We can scrape the
  // JSON-LD or the raw API endpoint the embed uses:
  // https://{subdomain}.appfolio.com/listings/embed.json?property_group=...
  const url = `https://${integration.instanceSubdomain}.appfolio.com/listings/embed.json${
    integration.propertyGroupFilter ? `?property_group=${encodeURIComponent(integration.propertyGroupFilter)}` : ""
  }`;
  const res = await fetch(url, { headers: { Accept: "application/json" } });
  if (!res.ok) throw new Error(`AppFolio embed fallback failed: ${res.status}`);
  const data = await res.json();
  return data.listings ?? data;
}

export async function syncListingsForOrg(orgId: string) {
  const integration = await prisma.appFolioIntegration.findUnique({ where: { orgId } });
  if (!integration) return { synced: 0, error: "No integration" };

  await prisma.appFolioIntegration.update({
    where: { orgId },
    data: { syncStatus: "syncing" },
  });

  try {
    const remoteListings = await fetchAppFolioListings(orgId);

    // Map property_group → Property record
    const properties = await prisma.property.findMany({ where: { orgId } });
    const propertyByGroup = new Map(properties.map(p => [p.backendPropertyGroup?.toLowerCase(), p]));

    let synced = 0;
    for (const rl of remoteListings) {
      const property = propertyByGroup.get(rl.property_group?.toLowerCase());
      if (!property) continue;                            // Skip listings for unknown properties

      await prisma.listing.upsert({
        where: {
          // Unique composite; add to schema if not already (propertyId + backendListingId)
          // For now, use id lookup
          id: (await prisma.listing.findFirst({
            where: { propertyId: property.id, backendListingId: rl.id },
            select: { id: true },
          }))?.id ?? "__create__",
        },
        create: {
          propertyId: property.id,
          backendListingId: rl.id,
          unitType: rl.unit_type,
          unitNumber: rl.unit_number,
          bedrooms: rl.bedrooms,
          bathrooms: rl.bathrooms,
          squareFeet: rl.square_feet,
          priceCents: rl.rent ? Math.round(rl.rent * 100) : null,
          isAvailable: rl.available ?? true,
          availableFrom: rl.available_from ? new Date(rl.available_from) : null,
          photoUrls: rl.photos ?? [],
          description: rl.description,
          raw: rl as any,
          lastSyncedAt: new Date(),
        },
        update: {
          unitType: rl.unit_type,
          unitNumber: rl.unit_number,
          bedrooms: rl.bedrooms,
          bathrooms: rl.bathrooms,
          squareFeet: rl.square_feet,
          priceCents: rl.rent ? Math.round(rl.rent * 100) : null,
          isAvailable: rl.available ?? true,
          availableFrom: rl.available_from ? new Date(rl.available_from) : null,
          photoUrls: rl.photos ?? [],
          description: rl.description,
          raw: rl as any,
          lastSyncedAt: new Date(),
        },
      });
      synced++;
    }

    // Update denormalized Property stats
    for (const p of properties) {
      const agg = await prisma.listing.aggregate({
        where: { propertyId: p.id, isAvailable: true },
        _min: { priceCents: true },
        _max: { priceCents: true },
        _count: true,
      });
      await prisma.property.update({
        where: { id: p.id },
        data: {
          priceMin: agg._min.priceCents ?? null,
          priceMax: agg._max.priceCents ?? null,
          availableCount: agg._count,
          lastSyncedAt: new Date(),
        },
      });
    }

    await prisma.appFolioIntegration.update({
      where: { orgId },
      data: { syncStatus: "idle", lastSyncAt: new Date(), lastError: null },
    });

    return { synced, error: null };
  } catch (err: any) {
    await prisma.appFolioIntegration.update({
      where: { orgId },
      data: { syncStatus: "error", lastError: err.message },
    });
    return { synced: 0, error: err.message };
  }
}
```

**Note:** The Prisma schema needs a compound unique on `Listing(propertyId, backendListingId)`. Add to `00-schema.prisma`:
```prisma
@@unique([propertyId, backendListingId])
```

Update the upsert above to use that compound key instead of the awkward pattern shown.

### 2. On-demand sync endpoint

```typescript
// app/api/tenant/appfolio/sync/route.ts
import { requireClient } from "@/lib/tenancy/scope";
import { syncListingsForOrg } from "@/lib/integrations/appfolio";
import { NextResponse } from "next/server";

export async function POST() {
  const scope = await requireClient();
  const result = await syncListingsForOrg(scope.orgId);
  return NextResponse.json(result);
}
```

Portal exposes a "Sync now" button on property detail pages that hits this.

### 3. Scheduled sync cron

```typescript
// app/api/cron/appfolio-sync/route.ts
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { syncListingsForOrg } from "@/lib/integrations/appfolio";

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const integrations = await prisma.appFolioIntegration.findMany({
    where: { autoSyncEnabled: true },
  });

  const cutoff = Date.now() - 60 * 60 * 1000;             // Only sync integrations older than 1h
  const results = [];
  for (const i of integrations) {
    if (i.lastSyncAt && i.lastSyncAt.getTime() > cutoff) continue;
    const r = await syncListingsForOrg(i.orgId);
    results.push({ orgId: i.orgId, ...r });
  }

  return NextResponse.json({ synced: results.length, results });
}
```

Register in `vercel.json`:
```json
{
  "crons": [
    { "path": "/api/cron/appfolio-sync", "schedule": "0 * * * *" }
  ]
}
```

### 4. AppFolio config UI

On `/portal/properties/[id]/settings`, expose fields for:
- AppFolio subdomain (e.g., `sgrealestate`)
- Property group filter (e.g., "Telegraph Commons")
- API key (encrypted on save)
- Toggle: "Use embed fallback" (no API key required)

```typescript
// app/api/tenant/appfolio/route.ts — PATCH updates integration
import { requireClient } from "@/lib/tenancy/scope";
import { encrypt } from "@/lib/crypto";
import { prisma } from "@/lib/db";

export async function PATCH(req: Request) {
  const scope = await requireClient();
  const body = await req.json();

  const update: any = {};
  if (body.instanceSubdomain !== undefined) update.instanceSubdomain = body.instanceSubdomain;
  if (body.propertyGroupFilter !== undefined) update.propertyGroupFilter = body.propertyGroupFilter;
  if (body.useEmbedFallback !== undefined) update.useEmbedFallback = body.useEmbedFallback;
  if (body.apiKey) update.apiKeyEncrypted = encrypt(body.apiKey);

  const integration = await prisma.appFolioIntegration.upsert({
    where: { orgId: scope.orgId },
    create: { orgId: scope.orgId, instanceSubdomain: body.instanceSubdomain ?? "", ...update },
    update,
  });

  return Response.json({ ok: true, integration: { ...integration, apiKeyEncrypted: undefined } });
}
```

### 5. Encryption helper

```typescript
// lib/crypto.ts
import crypto from "node:crypto";

const KEY = Buffer.from(process.env.ENCRYPTION_KEY!, "hex");              // 32-byte hex
const ALG = "aes-256-gcm";

export function encrypt(plaintext: string): string {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv(ALG, KEY, iv);
  const ct = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, ct]).toString("base64");
}

export function decrypt(payload: string): string {
  const buf = Buffer.from(payload, "base64");
  const iv = buf.subarray(0, 12);
  const tag = buf.subarray(12, 28);
  const ct = buf.subarray(28);
  const decipher = crypto.createDecipheriv(ALG, KEY, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(ct), decipher.final()]).toString("utf8");
}
```

Add `ENCRYPTION_KEY=$(openssl rand -hex 32)` to env.

### 6. Listings API for tenant site

```typescript
// app/api/tenant/listings/route.ts — public, returns live listings for current tenant hostname
import { headers } from "next/headers";
import { resolveTenantByHostname } from "@/lib/tenancy/resolve";
import { prisma } from "@/lib/db";

export async function GET(req: Request) {
  const h = await headers();
  const hostname = h.get("host") ?? "";
  const tenant = await resolveTenantByHostname(hostname);
  if (!tenant) return Response.json({ error: "Tenant not found" }, { status: 404 });

  const properties = await prisma.property.findMany({
    where: { orgId: tenant.orgId },
    include: {
      listings: {
        where: { isAvailable: true },
        orderBy: { priceCents: "asc" },
      },
    },
  });

  return Response.json({ properties });
}
```

### 7. Testing with Telegraph Commons

```bash
# Seed Norman's AppFolio config
pnpm tsx scripts/seed-telegraph-commons-appfolio.ts
```

```typescript
// scripts/seed-telegraph-commons-appfolio.ts
import { prisma } from "@/lib/db";
import { encrypt } from "@/lib/crypto";

async function main() {
  const org = await prisma.organization.findUnique({ where: { slug: "telegraph-commons" } });
  if (!org) throw new Error("Run seed first");

  await prisma.appFolioIntegration.upsert({
    where: { orgId: org.id },
    create: {
      orgId: org.id,
      instanceSubdomain: "sgrealestate",
      plan: "plus",
      propertyGroupFilter: "Telegraph Commons",
      apiKeyEncrypted: process.env.APPFOLIO_TEST_KEY ? encrypt(process.env.APPFOLIO_TEST_KEY) : null,
      useEmbedFallback: !process.env.APPFOLIO_TEST_KEY,
    },
    update: {},
  });

  console.log("Seeded Telegraph Commons AppFolio config");
}

main().catch(console.error).finally(() => prisma.$disconnect());
```

Run `syncListingsForOrg(tcOrgId)` manually from a test script. Verify listings populate in the DB and `Property.priceMin/priceMax/availableCount` denormalize correctly.

---

## Done when

- [ ] AppFolio integration stored encrypted per org
- [ ] On-demand sync button works in portal
- [ ] Hourly cron syncs all `autoSyncEnabled` integrations
- [ ] Property stats (price range, available count) refresh after each sync
- [ ] Embed fallback works for orgs without Plus API key
- [ ] Telegraph Commons listings appear in `prisma.listing` and match what's on sgrealestate.appfolio.com

## Handoff to Sprint 07
Listings are live in the database. Sprint 07 builds the tenant marketing site renderer — the public pages that consume these listings and render as `telegraphcommons.com`.

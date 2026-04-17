# Sprint 08 — Cursive Pixel Integration

**Duration:** 0.5 day
**Dependencies:** Sprint 07
**Goal:** Cursive pixel fires on every tenant marketing site, anonymous visitors flow into the `Visitor` table, identified visitors trigger outreach, weekly digest emails go out, and hashed emails sync to connected ad platforms for retargeting.

**Critical context:** Cursive is a separate product Adam already owns. We do NOT build an identity graph. This sprint is purely integration: provision pixel via Cursive API → install script on tenant sites → ingest events via webhook → display visitors in portal → sync to ad platforms. No ML, no enrichment logic on our side.

---

## Step-by-step

### 1. Cursive API client

```typescript
// lib/integrations/cursive.ts
const CURSIVE_BASE = process.env.CURSIVE_API_URL ?? "https://api.cursive.io/v1";

type CursiveProvisionResponse = {
  pixelId: string;
  scriptUrl: string;
  accountId: string;
};

export async function provisionCursivePixel(params: {
  domain: string;
  orgName: string;
  webhookUrl: string;
}): Promise<CursiveProvisionResponse> {
  const res = await fetch(`${CURSIVE_BASE}/pixels`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.CURSIVE_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      domain: params.domain,
      label: params.orgName,
      webhook_url: params.webhookUrl,
    }),
  });
  if (!res.ok) throw new Error(`Cursive provision failed: ${await res.text()}`);
  return res.json();
}

export async function fetchCursiveVisitors(params: {
  pixelId: string;
  since?: Date;
  limit?: number;
}) {
  const url = new URL(`${CURSIVE_BASE}/pixels/${params.pixelId}/visitors`);
  if (params.since) url.searchParams.set("since", params.since.toISOString());
  if (params.limit) url.searchParams.set("limit", String(params.limit));

  const res = await fetch(url.toString(), {
    headers: { Authorization: `Bearer ${process.env.CURSIVE_API_KEY}` },
  });
  if (!res.ok) throw new Error(`Cursive fetch failed: ${res.status}`);
  return res.json();
}
```

**Note on the Cursive API shape:** the exact endpoints and payload keys (`pixelId` vs `pixel_id`, etc.) depend on Cursive's current API. Before writing this sprint, check the actual Cursive API docs or admin UI and adjust field names. The structure above assumes a typical REST pattern — verify and fix.

### 2. Provision during tenant build

Extend `lib/build/provision-tenant.ts` (from Sprint 04) to call Cursive during the build phase, not at initial org creation:

```typescript
// lib/build/provision-cursive.ts
import { prisma } from "@/lib/db";
import { provisionCursivePixel } from "@/lib/integrations/cursive";

export async function provisionCursiveForOrg(orgId: string, hostname: string) {
  const org = await prisma.organization.findUnique({
    where: { id: orgId },
    include: { cursiveIntegration: true },
  });
  if (!org || !org.modulePixel) return;
  if (org.cursiveIntegration?.cursivePixelId) return;        // Already provisioned

  const webhookUrl = `${process.env.NEXT_PUBLIC_APP_URL}/api/webhooks/cursive`;
  const provisioned = await provisionCursivePixel({
    domain: hostname,
    orgName: org.name,
    webhookUrl,
  });

  await prisma.cursiveIntegration.upsert({
    where: { orgId },
    create: {
      orgId,
      cursivePixelId: provisioned.pixelId,
      cursiveAccountId: provisioned.accountId,
      pixelScriptUrl: provisioned.scriptUrl,
      installedOnDomain: hostname,
      provisionedAt: new Date(),
    },
    update: {
      cursivePixelId: provisioned.pixelId,
      cursiveAccountId: provisioned.accountId,
      pixelScriptUrl: provisioned.scriptUrl,
      installedOnDomain: hostname,
      provisionedAt: new Date(),
    },
  });
}
```

Trigger this when the agency flips an intake's status to `BUILD_IN_PROGRESS` and sets the domain — ideally from the client detail page, button: "Provision pixel".

### 3. Pixel loader component

```tsx
// components/pixel/cursive-pixel-loader.tsx
import Script from "next/script";
import { prisma } from "@/lib/db";

export async function CursivePixelLoader({ orgId }: { orgId: string }) {
  const integration = await prisma.cursiveIntegration.findUnique({
    where: { orgId },
  });
  if (!integration?.pixelScriptUrl) return null;

  return (
    <Script
      id="cursive-pixel"
      strategy="afterInteractive"
      src={integration.pixelScriptUrl}
      data-pixel-id={integration.cursivePixelId}
    />
  );
}
```

Already referenced in `app/_tenant/layout.tsx` from Sprint 07.

### 4. Webhook ingestion

```typescript
// app/api/webhooks/cursive/route.ts
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import crypto from "node:crypto";

export async function POST(req: NextRequest) {
  // Verify webhook signature (Cursive will send a signed header)
  const signature = req.headers.get("x-cursive-signature");
  const rawBody = await req.text();
  if (!verifySignature(rawBody, signature)) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  const payload = JSON.parse(rawBody);
  const { pixelId, visitors } = payload;

  // Resolve org from pixelId
  const integration = await prisma.cursiveIntegration.findFirst({
    where: { cursivePixelId: pixelId },
  });
  if (!integration) return NextResponse.json({ error: "Unknown pixel" }, { status: 404 });

  for (const v of visitors) {
    const hashedEmail = v.email ? sha256(v.email.toLowerCase().trim()) : null;

    await prisma.visitor.upsert({
      where: { cursiveVisitorId: v.visitor_id },
      create: {
        orgId: integration.orgId,
        cursiveVisitorId: v.visitor_id,
        visitorHash: v.visitor_hash,
        hashedEmail,
        status: v.identified ? "IDENTIFIED" : "ANONYMOUS",
        firstName: v.first_name,
        lastName: v.last_name,
        email: v.email,
        phone: v.phone,
        enrichedData: v.enrichment,
        firstSeenAt: v.first_seen_at ? new Date(v.first_seen_at) : new Date(),
        lastSeenAt: v.last_seen_at ? new Date(v.last_seen_at) : new Date(),
        sessionCount: v.session_count ?? 1,
        pagesViewed: v.pages_viewed,
        totalTimeSeconds: v.total_time_seconds ?? 0,
        referrer: v.referrer,
        utmSource: v.utm_source,
        utmMedium: v.utm_medium,
        utmCampaign: v.utm_campaign,
        intentScore: computeIntentScore(v),
      },
      update: {
        status: v.identified ? "IDENTIFIED" : "ANONYMOUS",
        firstName: v.first_name ?? undefined,
        lastName: v.last_name ?? undefined,
        email: v.email ?? undefined,
        phone: v.phone ?? undefined,
        hashedEmail: hashedEmail ?? undefined,
        enrichedData: v.enrichment ?? undefined,
        lastSeenAt: new Date(),
        sessionCount: v.session_count ?? 1,
        pagesViewed: v.pages_viewed,
        totalTimeSeconds: v.total_time_seconds ?? 0,
        intentScore: computeIntentScore(v),
      },
    });
  }

  await prisma.cursiveIntegration.update({
    where: { orgId: integration.orgId },
    data: {
      lastEventAt: new Date(),
      totalEventsCount: { increment: visitors.length },
    },
  });

  return NextResponse.json({ ok: true });
}

function verifySignature(body: string, sig: string | null): boolean {
  if (!sig || !process.env.CURSIVE_WEBHOOK_SECRET) return false;
  const expected = crypto
    .createHmac("sha256", process.env.CURSIVE_WEBHOOK_SECRET)
    .update(body)
    .digest("hex");
  return crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected));
}

function sha256(s: string): string {
  return crypto.createHash("sha256").update(s).digest("hex");
}

function computeIntentScore(v: any): number {
  // Simple heuristic: weight time on site, page views, and return visits
  let score = 0;
  if ((v.session_count ?? 1) > 1) score += 20;
  if ((v.total_time_seconds ?? 0) > 60) score += 20;
  if ((v.total_time_seconds ?? 0) > 300) score += 20;
  if (Array.isArray(v.pages_viewed) && v.pages_viewed.length > 3) score += 20;
  if (v.identified) score += 20;
  return Math.min(100, score);
}
```

### 5. Portal visitors view

`app/portal/visitors/page.tsx`:

```tsx
import { requireClient } from "@/lib/tenancy/scope";
import { prisma } from "@/lib/db";

export default async function VisitorsPage() {
  const scope = await requireClient();
  const since30d = new Date(Date.now() - 30 * 86400 * 1000);

  const visitors = await prisma.visitor.findMany({
    where: {
      orgId: scope.orgId,
      lastSeenAt: { gte: since30d },
    },
    orderBy: [{ intentScore: "desc" }, { lastSeenAt: "desc" }],
    take: 200,
  });

  const stats = {
    identified: visitors.filter(v => v.status === "IDENTIFIED" || v.status === "ENRICHED").length,
    total: visitors.length,
    converted: visitors.filter(v => v.convertedAt).length,
  };

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold">Website visitors (30d)</h1>
      <div className="grid grid-cols-3 gap-4">
        <div className="p-4 border rounded"><div className="text-sm">Total</div><div className="text-3xl font-bold">{stats.total}</div></div>
        <div className="p-4 border rounded"><div className="text-sm">Identified</div><div className="text-3xl font-bold">{stats.identified}</div><div className="text-xs">{stats.total ? Math.round(stats.identified / stats.total * 100) : 0}% ID rate</div></div>
        <div className="p-4 border rounded"><div className="text-sm">Converted to leads</div><div className="text-3xl font-bold">{stats.converted}</div></div>
      </div>

      <table className="w-full text-sm">
        <thead>
          <tr className="border-b">
            <th className="text-left p-2">Name</th>
            <th className="text-left p-2">Email</th>
            <th className="text-left p-2">Intent</th>
            <th className="text-left p-2">Sessions</th>
            <th className="text-left p-2">Time on site</th>
            <th className="text-left p-2">Last seen</th>
          </tr>
        </thead>
        <tbody>
          {visitors.map(v => (
            <tr key={v.id} className="border-b hover:bg-gray-50">
              <td className="p-2">{v.firstName} {v.lastName}</td>
              <td className="p-2">{v.email ?? <span className="text-muted-foreground">—</span>}</td>
              <td className="p-2">
                <div className="w-20 h-2 bg-gray-200 rounded"><div className="h-2 bg-green-500 rounded" style={{ width: `${v.intentScore}%` }} /></div>
              </td>
              <td className="p-2">{v.sessionCount}</td>
              <td className="p-2">{Math.round((v.totalTimeSeconds ?? 0) / 60)}m</td>
              <td className="p-2">{v.lastSeenAt.toLocaleDateString()}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
```

### 6. Warm outbound to identified visitors

Cron job `app/api/cron/visitor-outreach/route.ts` (hourly):

```typescript
import { prisma } from "@/lib/db";
import { sendVisitorOutreachEmail } from "@/lib/email/lead-emails";

export async function GET(req: Request) {
  const authHeader = req.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) return new Response("Unauthorized", { status: 401 });

  const candidates = await prisma.visitor.findMany({
    where: {
      status: "IDENTIFIED",
      email: { not: null },
      outreachSent: false,
      intentScore: { gte: 60 },
      firstSeenAt: { gte: new Date(Date.now() - 7 * 86400 * 1000) },
    },
    include: { org: true },
    take: 100,
  });

  let sent = 0;
  for (const v of candidates) {
    if (!v.org.moduleOutboundEmail && !v.org.moduleEmail) continue;
    await sendVisitorOutreachEmail({
      to: v.email!,
      firstName: v.firstName,
      orgName: v.org.name,
    });
    await prisma.visitor.update({
      where: { id: v.id },
      data: { outreachSent: true, outreachSentAt: new Date() },
    });
    sent++;
  }

  return Response.json({ sent, scanned: candidates.length });
}
```

Add to `vercel.json` crons: `{ "path": "/api/cron/visitor-outreach", "schedule": "15 * * * *" }`.

### 7. Weekly digest

Cron job `app/api/cron/pixel-weekly-digest/route.ts` (Monday 9am):

Fetch each org's `CursiveIntegration` with `weeklyDigestEnabled: true`. Aggregate last-7d visitor stats per org. Email the digest using Resend template.

```typescript
const digest = await prisma.visitor.aggregate({
  where: { orgId: org.id, lastSeenAt: { gte: weekAgo } },
  _count: true,
});
// ...
```

### 8. Ad platform sync (stub for v2)

Hash visitor emails and sync to Google Ads / Meta Custom Audiences. Populate `syncedToGoogleAds` / `syncedToMetaAds` flags. v1 sets up the data flow; actual sync can be manual via CSV export for first few clients and automated in a follow-up sprint.

```typescript
// app/api/tenant/visitors/export/route.ts — CSV export of hashed emails for manual upload
import { requireClient } from "@/lib/tenancy/scope";
import { prisma } from "@/lib/db";

export async function GET() {
  const scope = await requireClient();
  const visitors = await prisma.visitor.findMany({
    where: { orgId: scope.orgId, hashedEmail: { not: null } },
    select: { hashedEmail: true, firstName: true, lastName: true },
  });
  const csv = ["email,first_name,last_name"]
    .concat(visitors.map(v => `${v.hashedEmail},${v.firstName ?? ""},${v.lastName ?? ""}`))
    .join("\n");
  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv",
      "Content-Disposition": `attachment; filename="visitors-${scope.orgId}.csv"`,
    },
  });
}
```

### 9. Test plan

- [ ] Provision pixel via admin button, confirm Cursive returns pixelId and it's stored in DB
- [ ] Load `telegraphcommons.com` (or subdomain test) and confirm Cursive script tag present in rendered HTML
- [ ] Use Cursive's dashboard or test webhook tool to send a fake visitor event, verify it lands in `Visitor` table with correct org linkage
- [ ] Portal visitors page renders data
- [ ] Fire the cron manually (`GET /api/cron/visitor-outreach`) with test visitors above the threshold, verify email fires
- [ ] Weekly digest cron renders expected content

---

## Done when

- [ ] Provisioning from admin button works end-to-end
- [ ] Webhook signature verification blocks unsigned requests
- [ ] Visitors appear in portal within seconds of firing on tenant site
- [ ] Intent score sorts visitors correctly
- [ ] Outreach cron sends to high-intent identified visitors once, respecting module flags
- [ ] Weekly digest delivers
- [ ] CSV export works for manual ad audience upload

## Handoff to Sprint 09
Visitor data is flowing. Sprint 09 adds the chatbot so anonymous visitors get engaged and converted into identified leads without waiting for Cursive enrichment.

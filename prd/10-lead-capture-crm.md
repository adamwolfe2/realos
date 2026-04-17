# Sprint 10 — Lead Capture, CRM & Follow-Up Automation

**Duration:** 1 day
**Dependencies:** Sprint 07, 08, 09
**Goal:** Every lead (form, pixel, chatbot, referral, ads) gets the right follow-up at the right time automatically. Lapsed leads get recovered. Agency and client both see the pipeline clearly.

---

## Strategic reasoning

We already capture leads from 3 sources (form, chatbot, pixel). The missing layer is the time-based outreach engine: day 1 welcome, day 3 nudge, day 7 tour reminder, day 30 re-engagement, year 1 renewal. Most operators lose 60%+ of leads to poor follow-up. This sprint is the competitive moat against CLX — they send zero follow-up emails.

**Architecture pattern:** every Lead has an associated `LeadSequence` that tracks which cadence it's in and what's next. A cron job each hour scans for due actions and fires them via Resend. Clients can override the default cadence in portal settings.

Note: for v1, we hardcode the cadence in code rather than building a campaign builder UI. That's v2. For now, every lead follows the same canonical sequence, with opt-out respected.

---

## Fork from Wholesail

**Keep and adapt:**
- `lib/email/onboarding-drip-emails.ts` — pattern for drip emails, rewrite content
- `app/api/cron/intake-nurture/route.ts` — pattern for periodic nurture
- `app/api/cron/lapsed-clients/route.ts` → rename `lapsed-leads/route.ts`, rewrite

---

## Step-by-step

### 1. Email templates

Create `lib/email/lead-sequences.ts` with templated emails:

```typescript
import { Resend } from "resend";
import { brand } from "@/lib/brand";

const resend = new Resend(process.env.RESEND_API_KEY);

type SendParams = {
  to: string;
  firstName?: string | null;
  orgName: string;
  propertyName?: string | null;
  applyUrl: string;
  unsubUrl: string;
  replyTo: string;
};

export async function sendLeadDayOne(p: SendParams) {
  return resend.emails.send({
    from: `${p.orgName} <${p.replyTo}>`,
    to: p.to,
    replyTo: p.replyTo,
    subject: `Thanks for your interest in ${p.propertyName ?? p.orgName}`,
    html: `<p>Hi ${p.firstName ?? "there"},</p>
<p>Thanks for reaching out about ${p.propertyName ?? p.orgName}. A few things that might help:</p>
<ul>
<li><a href="${p.applyUrl}">Start your application</a></li>
<li>Reply to this email with any questions</li>
<li>Want to schedule a tour? Just reply with your availability.</li>
</ul>
<p>Looking forward to meeting you.</p>
<p>The ${p.orgName} team</p>
<p style="font-size: 11px; color: #888;"><a href="${p.unsubUrl}">Unsubscribe</a></p>`,
  });
}

export async function sendLeadDayThree(p: SendParams) {
  return resend.emails.send({
    from: `${p.orgName} <${p.replyTo}>`,
    to: p.to,
    replyTo: p.replyTo,
    subject: `Still thinking about ${p.propertyName ?? "us"}?`,
    html: `<p>Hi ${p.firstName ?? "there"},</p>
<p>Checking in. Did you have any questions I can help with?</p>
<p>Here's what makes ${p.propertyName ?? p.orgName} different:</p>
<ul>
<li>Walkable to campus</li>
<li>Included amenities and utilities</li>
<li>Flexible lease terms</li>
</ul>
<p><a href="${p.applyUrl}">Take a closer look →</a></p>
<p style="font-size: 11px; color: #888;"><a href="${p.unsubUrl}">Unsubscribe</a></p>`,
  });
}

export async function sendLeadDaySeven(p: SendParams) {
  // "Haven't heard back — is timing bad?"
}

export async function sendLeadDayThirty(p: SendParams) {
  // "Units are filling up for next term"
}

export async function sendLeadYearOne(p: SendParams) {
  // "We're now leasing for next year — want first pick?"
}
```

Customize copy per property type (student housing vs multifamily vs senior living). For v1 just ship student housing templates; add a lookup pattern so other types can slot in later.

### 2. Lead sequence tracker

Add to Prisma schema (`00-schema.prisma`) — append these fields to the `Lead` model (update the PRD schema file if Claude Code hasn't already migrated):

```prisma
// Additional fields to add to Lead model
  unsubscribedFromEmails Boolean  @default(false)
  unsubscribedAt         DateTime?
  lastEmailSentAt        DateTime?
  nextScheduledEmailAt   DateTime?
  emailsSent             Int       @default(0)
  cadenceStage           String?                         // day_one_sent, day_three_sent, etc.
```

If the migration was already run in Sprint 01, write a new migration for these additive columns.

### 3. Hourly cadence cron

```typescript
// app/api/cron/lead-nurture/route.ts
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import * as seq from "@/lib/email/lead-sequences";

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) return new Response("Unauthorized", { status: 401 });

  const now = Date.now();
  const cadence = [
    { stage: "day_one",     afterHours: 1,       send: seq.sendLeadDayOne },
    { stage: "day_three",   afterHours: 72,      send: seq.sendLeadDayThree },
    { stage: "day_seven",   afterHours: 7 * 24,  send: seq.sendLeadDaySeven },
    { stage: "day_thirty",  afterHours: 30 * 24, send: seq.sendLeadDayThirty },
    { stage: "year_one",    afterHours: 365 * 24, send: seq.sendLeadYearOne },
  ];

  let fired = 0;
  for (const step of cadence) {
    const prevStage = cadence[cadence.indexOf(step) - 1]?.stage;
    const cutoff = new Date(now - step.afterHours * 60 * 60 * 1000);

    const candidates = await prisma.lead.findMany({
      where: {
        email: { not: null },
        unsubscribedFromEmails: false,
        status: { notIn: ["LOST", "SIGNED", "UNQUALIFIED"] },
        cadenceStage: prevStage ?? null,
        createdAt: { lte: cutoff },
      },
      include: { org: true, property: true },
      take: 200,
    });

    for (const lead of candidates) {
      if (!lead.email) continue;
      if (!lead.org.moduleEmail) continue;

      try {
        await step.send({
          to: lead.email,
          firstName: lead.firstName,
          orgName: lead.org.name,
          propertyName: lead.property?.name,
          applyUrl: `https://${lead.org.domains?.[0]?.hostname ?? `${lead.org.slug}.${process.env.PLATFORM_DOMAIN}`}/apply`,
          unsubUrl: `https://${process.env.PLATFORM_DOMAIN}/unsub?lead=${lead.id}&token=${makeUnsubToken(lead.id)}`,
          replyTo: lead.org.primaryContactEmail ?? "noreply@example.com",
        });

        await prisma.lead.update({
          where: { id: lead.id },
          data: {
            cadenceStage: `${step.stage}_sent`,
            lastEmailSentAt: new Date(),
            emailsSent: { increment: 1 },
          },
        });
        fired++;
      } catch (err: any) {
        console.error(`Failed to send ${step.stage} to ${lead.email}`, err);
      }
    }
  }

  return NextResponse.json({ fired });
}

function makeUnsubToken(leadId: string): string {
  return require("crypto").createHmac("sha256", process.env.UNSUB_SECRET!).update(leadId).digest("hex").slice(0, 16);
}
```

Register in `vercel.json`: `{ "path": "/api/cron/lead-nurture", "schedule": "0 * * * *" }`.

### 4. Unsubscribe page

```typescript
// app/unsub/page.tsx
import { prisma } from "@/lib/db";
import crypto from "node:crypto";

export default async function UnsubPage({ searchParams }: { searchParams: Promise<{ lead?: string; token?: string }> }) {
  const { lead, token } = await searchParams;
  if (!lead || !token) return <div>Invalid link</div>;

  const expected = crypto.createHmac("sha256", process.env.UNSUB_SECRET!).update(lead).digest("hex").slice(0, 16);
  if (token !== expected) return <div>Invalid token</div>;

  await prisma.lead.update({
    where: { id: lead },
    data: { unsubscribedFromEmails: true, unsubscribedAt: new Date() },
  });

  return (
    <main className="max-w-md mx-auto py-24 text-center">
      <h1 className="text-2xl font-semibold mb-2">You're unsubscribed</h1>
      <p>Sorry to see you go. No more emails.</p>
    </main>
  );
}
```

### 5. Lapsed leads cron

`app/api/cron/lapsed-leads/route.ts` (daily): find leads with `status: CONTACTED` or `TOUR_SCHEDULED` but no activity in 14+ days. Auto-move to `LOST` and notify the assigned user. This is Wholesail's `lapsed-clients` pattern adapted to leads.

```typescript
export async function GET(req: NextRequest) {
  // auth
  const cutoff = new Date(Date.now() - 14 * 86400 * 1000);
  const lapsed = await prisma.lead.findMany({
    where: {
      status: { in: ["CONTACTED", "TOUR_SCHEDULED", "TOURED"] },
      lastActivityAt: { lt: cutoff },
    },
  });
  for (const l of lapsed) {
    await prisma.lead.update({ where: { id: l.id }, data: { status: "LOST" } });
    // Optional: fire a last-chance email
  }
  return Response.json({ lapsed: lapsed.length });
}
```

### 6. Lead score refresh cron

Compute and update `Lead.score` daily based on:
- Recency of activity (+20 if last 7d, +10 if 14d, 0 if older)
- Source (+30 if chatbot capture, +20 form, +10 pixel-only)
- Completeness (+10 if email + phone + name, +5 if just email)
- Engagement (+20 if replied to email, +20 if visited site 3+ times post-capture)

Simple linear scoring for v1. No ML.

### 7. Tour scheduling

Inline CTA on tenant site: "Schedule a tour" button → form captures date/time preference → creates Tour row with status `REQUESTED`. Notification to tenant leasing team (email + Slack if configured).

Agency/client can accept via portal tour detail view; on accept, email confirmation goes to lead with calendar `.ics` attachment.

### 8. Portal CRM upgrades

Enhance `/portal/leads/[id]`:
- Activity timeline: email sent, email opened (via Resend webhook), replied, tour scheduled, application started, etc.
- Quick actions: "Send custom email" (opens compose modal), "Log call", "Schedule tour", "Mark won", "Mark lost"
- Cadence override: toggle per-lead to pause automated emails if team is doing manual outreach
- Related entities: visitor record, chatbot conversation(s), tours, applications all linked

### 9. Resend webhook for email events

```typescript
// app/api/webhooks/resend/route.ts
import { prisma } from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  const body = await req.json();
  // { type: "email.opened" | "email.clicked" | "email.bounced" | ..., data: { to, email_id, ... } }

  // Map Resend event → AuditEvent or LeadActivity
  // For v1, just log to AuditEvent so we have the trail
  await prisma.auditEvent.create({
    data: {
      orgId: "unknown",                                   // Resolve via email lookup, below
      action: "UPDATE",
      entityType: "EmailEvent",
      entityId: body.data?.email_id,
      description: `${body.type}: ${body.data?.to}`,
      diff: body,
    },
  });
  return NextResponse.json({ ok: true });
}
```

Enhance: look up the `Lead` by email address and update `lastActivityAt` on open/click events.

### 10. Per-client cadence config (stubbed for v2)

Add a `leadSequenceConfig` JSON column to Organization for later overrides. For v1 everyone uses the canonical cadence.

---

## Done when

- [ ] Every new Lead enters the cadence with `cadenceStage: null`
- [ ] Hourly cron advances leads through day_one → day_three → day_seven → day_thirty → year_one
- [ ] Unsubscribe link works and halts all future emails for that lead
- [ ] Lapsed leads cron moves stale leads to LOST after 14d inactive
- [ ] Lead score refresh cron runs daily
- [ ] Portal lead detail shows activity timeline
- [ ] Tour scheduling flow works end-to-end

## Handoff to Sprint 11
Leads are flowing and nurtured. Sprint 11 adds the last client-facing piece: the creative studio where clients submit ad creative requests and the agency fulfills them.

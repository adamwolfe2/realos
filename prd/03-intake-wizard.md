# Sprint 03 — Intake Wizard (Real Estate)

**Duration:** 1 day
**Dependencies:** Sprint 02
**Goal:** 4-step wizard at `/onboarding` that captures real estate prospect details, creates an `IntakeSubmission`, notifies the agency via Slack + email, and books a consultation call.

---

## Fork from Wholesail

Wholesail's intake wizard lives at `components/intake/`. Keep the framework; rewrite the steps.

**Keep as-is:**
- `components/intake/index.tsx` — wizard state machine
- `components/intake/option-button.tsx` — toggle chip component
- `components/intake/cal-embed.tsx` — Cal.com booking embed
- `components/intake/constants.ts` — pattern, but replace content

**Rewrite:**
- `components/intake/types.ts` — new form shape
- `components/intake/step-company.tsx` — company info
- `components/intake/step-distribution.tsx` → rename `step-portfolio.tsx`
- `components/intake/step-features.tsx` → rewrite as `step-services.tsx`
- `components/intake/step-booking.tsx` — lightly adapt

---

## Step-by-step

### 1. New types

```typescript
// components/intake/types.ts
export type IntakeFormState = {
  // Step 1
  companyName: string;
  shortName: string;
  websiteUrl: string;
  propertyType: "RESIDENTIAL" | "COMMERCIAL" | "MIXED" | "";
  residentialSubtype?: "STUDENT_HOUSING" | "MULTIFAMILY" | "SENIOR_LIVING" | "SINGLE_FAMILY_RENTAL" | "CO_LIVING" | "SHORT_TERM_RENTAL";
  commercialSubtype?: "OFFICE" | "RETAIL" | "INDUSTRIAL" | "MIXED_USE" | "FLEX_SPACE" | "MEDICAL_OFFICE";
  primaryContactName: string;
  primaryContactEmail: string;
  primaryContactPhone: string;
  primaryContactRole: string;
  hqCity: string;
  hqState: string;

  // Step 2
  numberOfProperties: number | null;
  currentBackendPlatform: "APPFOLIO" | "YARDI_BREEZE" | "YARDI_VOYAGER" | "BUILDIUM" | "RENTMANAGER" | "ENTRATA" | "REALPAGE" | "PROPERTYWARE" | "MRI" | "VTS" | "OTHER" | "NONE" | "";
  backendPlanTier: string;
  currentVendor: string;                              // "Conversion Logix", "REACH", etc.
  currentMonthlySpend: number | null;
  biggestPainPoint: string;                           // "Leads don't convert", "Agency is slow", "Site doesn't rank", etc.

  // Step 3 — module selection (all default false except moduleWebsite + moduleLeadCapture)
  modules: {
    website: boolean;
    pixel: boolean;
    chatbot: boolean;
    googleAds: boolean;
    metaAds: boolean;
    seo: boolean;
    email: boolean;
    outboundEmail: boolean;
    referrals: boolean;
    creativeStudio: boolean;
    leadCapture: boolean;
  };

  // Step 4
  goLiveTarget: "asap" | "one_month" | "three_months" | "exploring" | "";
  bookedCallAt?: string;
  calBookingId?: string;
};
```

### 2. Step 1 — Company info

```tsx
// components/intake/step-company.tsx
"use client";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { OptionButton } from "./option-button";

export function StepCompany({ state, update }: { state: IntakeFormState; update: (patch: Partial<IntakeFormState>) => void }) {
  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-semibold">Tell us about your company</h2>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Input label="Company name" value={state.companyName} onChange={v => update({ companyName: v })} required />
        <Input label="Short name (URL slug)" value={state.shortName} onChange={v => update({ shortName: v })} placeholder="e.g. sg-realestate" />
      </div>

      <Input label="Current website URL" value={state.websiteUrl} onChange={v => update({ websiteUrl: v })} placeholder="https://..." />

      <div>
        <label>Property type</label>
        <div className="grid grid-cols-3 gap-3 mt-2">
          <OptionButton selected={state.propertyType === "RESIDENTIAL"} onClick={() => update({ propertyType: "RESIDENTIAL" })}>Residential</OptionButton>
          <OptionButton selected={state.propertyType === "COMMERCIAL"} onClick={() => update({ propertyType: "COMMERCIAL" })}>Commercial</OptionButton>
          <OptionButton selected={state.propertyType === "MIXED"} onClick={() => update({ propertyType: "MIXED" })}>Both</OptionButton>
        </div>
      </div>

      {state.propertyType === "RESIDENTIAL" && (
        <div>
          <label>Residential type</label>
          <div className="grid grid-cols-2 gap-3 mt-2">
            {["STUDENT_HOUSING", "MULTIFAMILY", "SENIOR_LIVING", "SINGLE_FAMILY_RENTAL", "CO_LIVING", "SHORT_TERM_RENTAL"].map(sub => (
              <OptionButton key={sub} selected={state.residentialSubtype === sub} onClick={() => update({ residentialSubtype: sub as any })}>
                {sub.replace(/_/g, " ").toLowerCase()}
              </OptionButton>
            ))}
          </div>
        </div>
      )}

      {state.propertyType === "COMMERCIAL" && (
        <div>
          <label>Commercial type</label>
          <div className="grid grid-cols-2 gap-3 mt-2">
            {["OFFICE", "RETAIL", "INDUSTRIAL", "MIXED_USE", "FLEX_SPACE", "MEDICAL_OFFICE"].map(sub => (
              <OptionButton key={sub} selected={state.commercialSubtype === sub} onClick={() => update({ commercialSubtype: sub as any })}>
                {sub.replace(/_/g, " ").toLowerCase()}
              </OptionButton>
            ))}
          </div>
        </div>
      )}

      <h3 className="text-lg font-semibold mt-8">Primary contact</h3>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Input label="Full name" value={state.primaryContactName} onChange={v => update({ primaryContactName: v })} required />
        <Input label="Role" value={state.primaryContactRole} onChange={v => update({ primaryContactRole: v })} placeholder="VP of Operations" />
        <Input label="Email" type="email" value={state.primaryContactEmail} onChange={v => update({ primaryContactEmail: v })} required />
        <Input label="Phone" value={state.primaryContactPhone} onChange={v => update({ primaryContactPhone: v })} />
        <Input label="HQ city" value={state.hqCity} onChange={v => update({ hqCity: v })} />
        <Input label="HQ state" value={state.hqState} onChange={v => update({ hqState: v })} />
      </div>
    </div>
  );
}
```

### 3. Step 2 — Portfolio

```tsx
// components/intake/step-portfolio.tsx
"use client";
import { OptionButton } from "./option-button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

const BACKENDS = [
  { key: "APPFOLIO", label: "AppFolio" },
  { key: "YARDI_BREEZE", label: "Yardi Breeze" },
  { key: "YARDI_VOYAGER", label: "Yardi Voyager" },
  { key: "BUILDIUM", label: "Buildium" },
  { key: "RENTMANAGER", label: "Rent Manager" },
  { key: "ENTRATA", label: "Entrata" },
  { key: "REALPAGE", label: "RealPage" },
  { key: "PROPERTYWARE", label: "Propertyware" },
  { key: "MRI", label: "MRI" },
  { key: "VTS", label: "VTS" },
  { key: "OTHER", label: "Other" },
  { key: "NONE", label: "None" },
];

const PAIN_POINTS = [
  "Current agency underperforms",
  "Site doesn't rank on Google",
  "Chatbot is useless",
  "Leads don't convert to tours",
  "Don't know which visitors are real prospects",
  "Ad spend feels wasted",
  "Too much manual follow-up",
  "No unified dashboard",
  "Other",
];

export function StepPortfolio({ state, update }: { state: IntakeFormState; update: (patch: Partial<IntakeFormState>) => void }) {
  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-semibold">About your portfolio</h2>

      <Input
        label="Number of properties"
        type="number"
        value={state.numberOfProperties?.toString() ?? ""}
        onChange={v => update({ numberOfProperties: v ? parseInt(v) : null })}
        placeholder="e.g. 3"
      />

      <div>
        <label>Current backend platform</label>
        <div className="grid grid-cols-3 gap-3 mt-2">
          {BACKENDS.map(b => (
            <OptionButton key={b.key} selected={state.currentBackendPlatform === b.key} onClick={() => update({ currentBackendPlatform: b.key as any })}>
              {b.label}
            </OptionButton>
          ))}
        </div>
      </div>

      {state.currentBackendPlatform === "APPFOLIO" && (
        <Input
          label="AppFolio plan"
          value={state.backendPlanTier}
          onChange={v => update({ backendPlanTier: v })}
          placeholder="Core / Plus / Max"
        />
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Input label="Current marketing vendor" value={state.currentVendor} onChange={v => update({ currentVendor: v })} placeholder="e.g. Conversion Logix" />
        <Input label="Current monthly marketing spend ($)" type="number" value={state.currentMonthlySpend?.toString() ?? ""} onChange={v => update({ currentMonthlySpend: v ? parseInt(v) : null })} />
      </div>

      <div>
        <label>Biggest pain point</label>
        <div className="grid grid-cols-2 gap-3 mt-2">
          {PAIN_POINTS.map(p => (
            <OptionButton key={p} selected={state.biggestPainPoint === p} onClick={() => update({ biggestPainPoint: p })}>
              {p}
            </OptionButton>
          ))}
        </div>
      </div>
    </div>
  );
}
```

### 4. Step 3 — Service selection

Bundled tiers + per-module toggles. Show price previews.

```tsx
// components/intake/step-services.tsx
"use client";
import { Switch } from "@/components/ui/switch";

const MODULES = [
  { key: "website", label: "Marketing Website + Hosting", desc: "Custom-built site with live AppFolio listings, on your domain.", priceHint: "Included in all plans" },
  { key: "leadCapture", label: "Lead Capture & Forms", desc: "Exit-intent popups, inline forms, automated follow-up.", priceHint: "Included" },
  { key: "pixel", label: "Identity Graph Pixel", desc: "Capture 70% of anonymous visitors with full contact info.", priceHint: "+$297/mo" },
  { key: "chatbot", label: "Proactive AI Chatbot", desc: "Fires within 5 seconds, captures leads 24/7, routes hot leads to your team.", priceHint: "+$297/mo" },
  { key: "googleAds", label: "Google Ads Management", desc: "Geo-fenced campaigns, pixel-powered retargeting, creative included.", priceHint: "15% of spend" },
  { key: "metaAds", label: "Meta/Instagram Ads", desc: "Story + feed campaigns, retargeting, competitive tracking.", priceHint: "15% of spend" },
  { key: "seo", label: "SEO & AEO", desc: "Rank in Google, ChatGPT, Perplexity. Dedicated landing pages, local SEO.", priceHint: "+$597/mo" },
  { key: "email", label: "Email Nurture Sequences", desc: "Automated drips for every lead source; day 1 / week 1 / month 1 / year 1.", priceHint: "+$197/mo" },
  { key: "outboundEmail", label: "Outbound Cold Email", desc: "Domain + inbox purchase, warming, campaign management to external lists.", priceHint: "+$697/mo" },
  { key: "referrals", label: "Student Referral Program", desc: "Referral tracking and automated payouts for existing tenants who refer new leases.", priceHint: "+$197/mo" },
  { key: "creativeStudio", label: "Ad Creative Studio", desc: "On-demand creative requests for ads, stories, emails. Unlimited revisions.", priceHint: "+$497/mo" },
];

export function StepServices({ state, update }: { state: IntakeFormState; update: (patch: Partial<IntakeFormState>) => void }) {
  const toggle = (key: keyof IntakeFormState["modules"]) => {
    update({ modules: { ...state.modules, [key]: !state.modules[key] } });
  };

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-semibold">Which services do you want managed?</h2>
      <p className="text-muted-foreground">Pick what you need. We'll finalize bundling and pricing on the call.</p>

      <div className="space-y-3">
        {MODULES.map(m => (
          <div key={m.key} className="flex items-start justify-between p-4 border rounded-lg">
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <h3 className="font-semibold">{m.label}</h3>
                <span className="text-sm text-muted-foreground">{m.priceHint}</span>
              </div>
              <p className="text-sm text-muted-foreground mt-1">{m.desc}</p>
            </div>
            <Switch
              checked={state.modules[m.key as keyof IntakeFormState["modules"]]}
              onCheckedChange={() => toggle(m.key as keyof IntakeFormState["modules"])}
            />
          </div>
        ))}
      </div>
    </div>
  );
}
```

### 5. Step 4 — Booking

Keep Wholesail's `components/intake/step-booking.tsx` mostly intact. Update copy to reflect real estate context and confirm no self-serve payment.

### 6. Submit API

```typescript
// app/api/onboarding/route.ts
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { sendSlackAlert } from "@/lib/integrations/slack";
import { sendIntakeReceivedEmail } from "@/lib/email/onboarding-emails";
import { ratelimit } from "@/lib/rate-limit";
import { z } from "zod";

const schema = z.object({
  companyName: z.string().min(1),
  shortName: z.string().optional(),
  websiteUrl: z.string().url().optional().or(z.literal("")),
  propertyType: z.enum(["RESIDENTIAL", "COMMERCIAL", "MIXED"]),
  residentialSubtype: z.string().optional(),
  commercialSubtype: z.string().optional(),
  primaryContactName: z.string().min(1),
  primaryContactEmail: z.string().email(),
  primaryContactPhone: z.string().optional(),
  primaryContactRole: z.string().optional(),
  hqCity: z.string().optional(),
  hqState: z.string().optional(),
  numberOfProperties: z.number().optional().nullable(),
  currentBackendPlatform: z.string().optional(),
  backendPlanTier: z.string().optional(),
  currentVendor: z.string().optional(),
  currentMonthlySpend: z.number().optional().nullable(),
  biggestPainPoint: z.string().optional(),
  selectedModules: z.array(z.string()),
  goLiveTarget: z.enum(["asap", "one_month", "three_months", "exploring"]),
  bookedCallAt: z.string().optional(),
  calBookingId: z.string().optional(),
});

export async function POST(req: NextRequest) {
  const ip = req.headers.get("x-forwarded-for") ?? "unknown";
  const { success } = await ratelimit.limit(ip);
  if (!success) return NextResponse.json({ error: "Rate limited" }, { status: 429 });

  const body = await req.json();
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const data = parsed.data;

  const submission = await prisma.intakeSubmission.create({
    data: {
      companyName: data.companyName,
      shortName: data.shortName,
      websiteUrl: data.websiteUrl || null,
      propertyType: data.propertyType,
      residentialSubtype: data.residentialSubtype as any,
      commercialSubtype: data.commercialSubtype as any,
      primaryContactName: data.primaryContactName,
      primaryContactEmail: data.primaryContactEmail,
      primaryContactPhone: data.primaryContactPhone,
      primaryContactRole: data.primaryContactRole,
      hqCity: data.hqCity,
      hqState: data.hqState,
      numberOfProperties: data.numberOfProperties,
      currentBackendPlatform: (data.currentBackendPlatform || "NONE") as any,
      backendPlanTier: data.backendPlanTier,
      currentVendor: data.currentVendor,
      currentMonthlySpendCents: data.currentMonthlySpend ? data.currentMonthlySpend * 100 : null,
      biggestPainPoint: data.biggestPainPoint,
      selectedModules: data.selectedModules,
      goLiveTarget: data.goLiveTarget,
      bookedCallAt: data.bookedCallAt ? new Date(data.bookedCallAt) : null,
      calBookingId: data.calBookingId,
      ipAddress: ip,
      userAgent: req.headers.get("user-agent") ?? undefined,
      referrer: req.headers.get("referer") ?? undefined,
      raw: data,
    },
  });

  // Notifications
  await Promise.all([
    sendSlackAlert({
      channel: "#intake",
      message: `New intake: *${data.companyName}* (${data.propertyType}) — ${data.numberOfProperties ?? "?"} properties, on ${data.currentBackendPlatform}. Pain: "${data.biggestPainPoint}". Spend: $${data.currentMonthlySpend ?? 0}/mo with ${data.currentVendor || "unknown"}.`,
    }),
    sendIntakeReceivedEmail({
      to: data.primaryContactEmail,
      name: data.primaryContactName,
      companyName: data.companyName,
      bookedCallAt: data.bookedCallAt,
    }),
  ]);

  return NextResponse.json({ ok: true, submissionId: submission.id });
}
```

### 7. Convert submission → Organization (agency action)

Add an admin action in Sprint 04 that converts an `IntakeSubmission` into a real `Organization`, seeds starter `Property` record, creates a `Project` with 28 default tasks, and kicks off the provisioning pipeline. For now just scaffold the endpoint:

```typescript
// app/api/admin/intake/[id]/convert/route.ts
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAgency } from "@/lib/tenancy/scope";
import { provisionTenant } from "@/lib/build/provision-tenant";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  await requireAgency();
  const { id } = await params;

  const submission = await prisma.intakeSubmission.findUnique({ where: { id } });
  if (!submission) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (submission.orgId) return NextResponse.json({ error: "Already converted" }, { status: 400 });

  const org = await provisionTenant(submission);
  return NextResponse.json({ ok: true, orgId: org.id });
}
```

`provisionTenant()` is implemented in Sprint 04.

### 8. Onboarding page

```tsx
// app/onboarding/page.tsx
import { IntakeWizard } from "@/components/intake";
export default function OnboardingPage() {
  return (
    <main className="max-w-3xl mx-auto py-12 px-4">
      <IntakeWizard />
    </main>
  );
}
```

---

## Done when

- [ ] `/onboarding` loads the 4-step wizard
- [ ] Each step validates required fields before advancing
- [ ] Submit creates an `IntakeSubmission`, fires Slack + confirmation email, books Cal
- [ ] Admin can see submissions in `/admin/intake` (Sprint 04 builds the list view)
- [ ] Rate limiting in place to prevent spam
- [ ] Mobile responsive

## Handoff to Sprint 04
Submissions land in the database. Sprint 04 builds the master admin dashboard, intake review queue, fulfillment pipeline, and the conversion flow that turns an IntakeSubmission into a provisioned tenant Organization.
